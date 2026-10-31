import { fmtDuration, fmtTime, kindIcon, kindLabel } from './time';
import type { Kind, Pause } from './types';

// Shared by the app and the service worker (push updates).

export const SLEEP_TAG = 'sleep';

export interface NotifySleep {
  id: string;
  start: string;
  end?: string | null;
  kind: Kind;
  pauses?: Pause[] | null;
}

/** [time asleep, start of the pause still going on] */
function slept(s: NotifySleep, end: number): [number, number | null] {
  let ms = end - parseDate(s.start);
  let open: number | null = null;
  for (const p of s.pauses ?? []) {
    const a = parseDate(p.start);
    if (!p.end) open = a;
    ms -= (p.end ? parseDate(p.end) : end) - a;
  }
  return [Math.max(0, ms), open];
}

/** Accepts ISO strings as well as PocketBase's "2026-10-30 21:32:23.638Z". */
export function parseDate(v: string): number {
  return Date.parse(v.replace(' ', 'T'));
}

export function runningNotification(s: NotifySleep, now = Date.now()): [string, NotificationOptions] {
  const start = parseDate(s.start);
  const [ms, pausedAt] = slept(s, now);
  return [
    pausedAt ? `⏸ Kurz wach seit ${fmtTime(pausedAt)}` : `${kindIcon[s.kind]} Schläft seit ${fmtDuration(ms)}`,
    {
      tag: SLEEP_TAG,
      body: pausedAt ? `${fmtDuration(ms)} geschlafen (${kindLabel[s.kind]})` : `${kindLabel[s.kind]} seit ${fmtTime(start)}`,
      icon: 'pwa-192x192.png',
      badge: 'badge-96x96.png',
      silent: true,
      requireInteraction: true,
      timestamp: start,
      actions: [{ action: 'stop', title: 'Aufgewacht' }],
      data: { id: s.id },
    } as NotificationOptions,
  ];
}

export function awakeNotification(s: NotifySleep): [string, NotificationOptions] {
  const end = s.end ? parseDate(s.end) : Date.now();
  return [
    `☀️ Aufgewacht um ${fmtTime(end)}`,
    {
      tag: SLEEP_TAG,
      body: `${fmtDuration(slept(s, end)[0])} geschlafen (${kindLabel[s.kind]})`,
      icon: 'pwa-192x192.png',
      badge: 'badge-96x96.png',
      silent: true,
      timestamp: end,
    } as NotificationOptions,
  ];
}
