import { fmtDuration, fmtTime, kindIcon, kindLabel } from './time';
import type { Kind } from './types';

// Shared by the app and the service worker (push updates).

export const SLEEP_TAG = 'sleep';

export interface NotifySleep {
  id: string;
  start: string;
  end?: string | null;
  kind: Kind;
}

/** Accepts ISO strings as well as PocketBase's "2026-10-30 21:32:23.638Z". */
export function parseDate(v: string): number {
  return Date.parse(v.replace(' ', 'T'));
}

export function runningNotification(s: NotifySleep, now = Date.now()): [string, NotificationOptions] {
  const start = parseDate(s.start);
  return [
    `${kindIcon[s.kind]} Schläft seit ${fmtDuration(now - start)}`,
    {
      tag: SLEEP_TAG,
      body: `${kindLabel[s.kind]} seit ${fmtTime(start)}`,
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
  const start = parseDate(s.start);
  const end = s.end ? parseDate(s.end) : Date.now();
  return [
    `☀️ Aufgewacht um ${fmtTime(end)}`,
    {
      tag: SLEEP_TAG,
      body: `${fmtDuration(end - start)} geschlafen (${kindLabel[s.kind]})`,
      icon: 'pwa-192x192.png',
      badge: 'badge-96x96.png',
      silent: true,
      timestamp: end,
    } as NotificationOptions,
  ];
}
