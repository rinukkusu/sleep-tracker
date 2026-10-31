import { addDays } from './time';
import type { Kind, Pause, Sleep } from './types';

export interface Segment {
  sleep: Sleep;
  /** 0..1 position within the day */
  from: number;
  to: number;
  /** Pauses within the segment, same scale */
  gaps: { from: number; to: number }[];
}

export interface DayStats {
  segments: Segment[];
  total: number;
  byKind: Record<Kind, number>;
  naps: number;
}

export function endMs(s: Sleep, now: number): number {
  return s.end ? Date.parse(s.end) : now;
}

/** The pause that is still going on, if any. */
export function openPause(s: Sleep): Pause | null {
  return s.end ? null : ((s.pauses ?? []).find((p) => !p.end) ?? null);
}

function overlap(a: number, b: number, from: number, to: number): number {
  return Math.max(0, Math.min(b, to) - Math.max(a, from));
}

/** Time asleep (without pauses) within [from, to]. */
export function sleptMs(s: Sleep, now: number, from = -Infinity, to = Infinity): number {
  const end = endMs(s, now);
  let ms = overlap(Date.parse(s.start), end, from, to);
  for (const p of s.pauses ?? []) ms -= overlap(Date.parse(p.start), p.end ? Date.parse(p.end) : end, from, to);
  return Math.max(0, ms);
}

/** Time awake during pauses. */
export function pausedMs(s: Sleep, now: number): number {
  return endMs(s, now) - Date.parse(s.start) - sleptMs(s, now);
}

/** Clips all sessions to one calendar day; sessions across midnight are split. */
export function dayStats(sleeps: Sleep[], day: Date, now: number): DayStats {
  const dayStart = +day;
  const dayEnd = +addDays(day, 1);
  const len = dayEnd - dayStart;
  const pos = (t: number) => (Math.min(Math.max(t, dayStart), dayEnd) - dayStart) / len;
  const stats: DayStats = { segments: [], total: 0, byKind: { nap: 0, night: 0 }, naps: 0 };

  for (const s of sleeps) {
    const a = Math.max(Date.parse(s.start), dayStart);
    const end = endMs(s, now);
    const b = Math.min(end, dayEnd);
    if (b <= a) continue;
    const gaps = (s.pauses ?? [])
      .map((p) => ({ from: pos(Date.parse(p.start)), to: pos(p.end ? Date.parse(p.end) : end) }))
      .filter((g) => g.to > g.from);
    stats.segments.push({ sleep: s, from: pos(a), to: pos(b), gaps });
    const slept = sleptMs(s, now, dayStart, dayEnd);
    stats.total += slept;
    stats.byKind[s.kind] += slept;
    if (s.kind === 'nap') stats.naps++;
  }
  stats.segments.sort((x, y) => x.from - y.from);
  return stats;
}
