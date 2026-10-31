import { ClientResponseError, type RecordModel } from 'pocketbase';
import { newId, pb } from './pb';
import { addDays, startOfDay } from './time';
import { openPause } from './stats';
import type { Kind, Pause, Sleep } from './types';

const COLLECTION = 'sleeps';
const CACHE_KEY = 'sleeps_cache';
const QUEUE_KEY = 'sleeps_queue';
const HISTORY_KEY = 'sleeps_history';

type Op = { t: 'put'; s: Sleep } | { t: 'del'; id: string };

const opId = (op: Op) => (op.t === 'put' ? op.s.id : op.id);

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked - in-memory state still works */
  }
}

/** PocketBase returns dates as "2026-10-30 12:00:00.000Z" and empty dates as "". */
function pbDate(v: string): string | null {
  return v ? new Date(v.replace(' ', 'T')).toISOString() : null;
}

function fromRecord(r: RecordModel): Sleep {
  return {
    id: r.id,
    start: pbDate(r.start_at) ?? new Date().toISOString(),
    end: pbDate(r.end_at),
    kind: r.kind === 'night' ? 'night' : 'nap',
    note: r.note ?? '',
    pauses: Array.isArray(r.pauses) ? (r.pauses as Pause[]) : [],
  };
}

function toRecord(s: Sleep) {
  return { start_at: s.start, end_at: s.end ?? '', kind: s.kind, note: s.note, pauses: s.pauses ?? [] };
}

function isNetworkError(e: unknown) {
  return e instanceof ClientResponseError && e.status === 0;
}

/**
 * Local-first store: every change is applied locally right away, queued in
 * localStorage and pushed to PocketBase when online. Realtime events from the
 * other phone are merged in unless we still have local changes for that id.
 */
class SleepStore {
  sessions = $state<Record<string, Sleep>>(load(CACHE_KEY, {}));
  pendingCount = $state(0);
  online = $state(navigator.onLine);
  /** Oldest day currently loaded from the server */
  from = $state(addDays(startOfDay(new Date()), -14));

  sorted = $derived(Object.values(this.sessions).sort((a, b) => b.start.localeCompare(a.start)));
  running = $derived(this.sorted.find((s) => !s.end) ?? null);
  lastWake = $derived(
    this.sorted.reduce<string | null>((max, s) => (s.end && (!max || s.end > max) ? s.end : max), null),
  );

  private queue: Op[] = load(QUEUE_KEY, []);
  private flushing = false;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.pendingCount = this.queue.length;
  }

  async init() {
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    document.addEventListener('visibilitychange', this.onVisible);
    await this.flush();
    await this.refresh();
    try {
      this.unsubscribe = await pb.collection(COLLECTION).subscribe('*', (e) => {
        if (this.hasPending(e.record.id)) return;
        if (e.action === 'delete') delete this.sessions[e.record.id];
        else this.sessions[e.record.id] = fromRecord(e.record);
        this.save();
      });
    } catch (e) {
      console.warn('realtime subscribe failed', e);
    }
  }

  teardown() {
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  clear() {
    this.teardown();
    this.sessions = {};
    this.queue = [];
    this.pendingCount = 0;
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(HISTORY_KEY);
  }

  start(kind: Kind, at = new Date()) {
    this.put({ id: newId(), start: at.toISOString(), end: null, kind, note: '', pauses: [] });
  }

  /** Stopping during a pause means she stayed awake: the sleep ends where the pause began. */
  stop(at = new Date()) {
    for (const s of this.sorted.filter((s) => !s.end)) {
      const open = openPause(s);
      const pauses = (s.pauses ?? []).filter((p) => p !== open);
      const end = open ? Date.parse(open.start) : Math.max(+at, Date.parse(s.start));
      this.put({ ...s, end: new Date(end).toISOString(), pauses });
    }
  }

  /** Briefly awake - stays part of the same sleep. */
  pause(at = new Date()) {
    const s = this.running;
    if (!s || openPause(s)) return;
    this.put({ ...s, pauses: [...(s.pauses ?? []), { start: at.toISOString(), end: null }] });
  }

  resume(at = new Date()) {
    const s = this.running;
    const open = s && openPause(s);
    if (!s || !open) return;
    const end = new Date(Math.max(+at, Date.parse(open.start))).toISOString();
    this.put({ ...s, pauses: (s.pauses ?? []).map((p) => (p === open ? { ...p, end } : p)) });
  }

  put(s: Sleep) {
    this.sessions[s.id] = s;
    this.enqueue({ t: 'put', s: $state.snapshot(s) });
  }

  remove(id: string) {
    delete this.sessions[id];
    this.enqueue({ t: 'del', id });
  }

  async loadMore(days = 30) {
    this.from = addDays(this.from, -days);
    await this.refresh();
  }

  /** Re-fetches the loaded range from the server and re-applies pending local changes. */
  async refresh() {
    if (!pb.authStore.isValid) return;
    try {
      const records = await pb.collection(COLLECTION).getFullList({
        filter: pb.filter('start_at >= {:from} || end_at = ""', { from: this.from }),
        sort: '-start_at',
      });
      const next: Record<string, Sleep> = {};
      const fromIso = this.from.toISOString();
      for (const s of Object.values(this.sessions)) if (s.start < fromIso && s.end) next[s.id] = s;
      for (const r of records) next[r.id] = fromRecord(r);
      for (const op of this.queue) {
        if (op.t === 'put') next[op.s.id] = op.s;
        else delete next[op.id];
      }
      this.sessions = next;
      this.save();
    } catch (e) {
      if (!isNetworkError(e)) console.warn('refresh failed', e);
    }
  }

  /** The whole history as last fetched (instant, for the first render of the statistics). */
  cachedAll(): Sleep[] {
    return this.withLocal(load(HISTORY_KEY, {}));
  }

  /**
   * The whole history (for statistics), merged with local changes. Not kept in
   * the store, but cached separately so the statistics also work offline.
   */
  async fetchAll(): Promise<Sleep[]> {
    let all: Record<string, Sleep>;
    try {
      const records = await pb.collection(COLLECTION).getFullList({ sort: 'start_at', batch: 1000 });
      all = {};
      for (const r of records) all[r.id] = fromRecord(r);
      persist(HISTORY_KEY, all);
    } catch (e) {
      if (!isNetworkError(e)) console.warn('fetching history failed', e);
      all = load(HISTORY_KEY, {});
    }
    return this.withLocal(all);
  }

  private withLocal(all: Record<string, Sleep>): Sleep[] {
    for (const s of Object.values($state.snapshot(this.sessions))) all[s.id] = s;
    for (const op of this.queue) if (op.t === 'del') delete all[op.id];
    return Object.values(all);
  }

  private enqueue(op: Op) {
    // A newer op for the same id supersedes older queued ones.
    const id = opId(op);
    this.queue = this.queue.filter((o) => opId(o) !== id);
    this.queue.push(op);
    this.save();
    void this.flush();
  }

  private async flush() {
    if (this.flushing || !pb.authStore.isValid) return;
    this.flushing = true;
    try {
      while (this.queue.length) {
        const op = this.queue[0];
        try {
          if (op.t === 'put') await this.upsert(op.s);
          else await pb.collection(COLLECTION).delete(op.id).catch((e) => {
            if (!(e instanceof ClientResponseError && e.status === 404)) throw e;
          });
        } catch (e) {
          if (isNetworkError(e)) break;
          // Anything else (validation, permissions) would block the queue forever.
          console.error('dropping sync op', op, e);
        }
        this.queue.shift();
        this.save();
      }
    } finally {
      this.flushing = false;
    }
  }

  private async upsert(s: Sleep) {
    try {
      await pb.collection(COLLECTION).update(s.id, toRecord(s));
    } catch (e) {
      if (e instanceof ClientResponseError && e.status === 404) {
        await pb.collection(COLLECTION).create({ id: s.id, ...toRecord(s) });
      } else throw e;
    }
  }

  private hasPending(id: string) {
    return this.queue.some((o) => opId(o) === id);
  }

  private save() {
    this.pendingCount = this.queue.length;
    persist(CACHE_KEY, $state.snapshot(this.sessions));
    persist(QUEUE_KEY, this.queue);
  }

  private onOnline = async () => {
    this.online = true;
    await this.flush();
    await this.refresh();
  };

  private onOffline = () => {
    this.online = false;
  };

  private onVisible = async () => {
    if (document.visibilityState !== 'visible') return;
    await this.flush();
    await this.refresh();
  };
}

export const store = new SleepStore();
