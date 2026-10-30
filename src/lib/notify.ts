import { fmtTime, kindIcon, kindLabel } from './time';
import type { Sleep } from './types';

const TAG = 'sleep';
let lastKey: string | null = null;

export async function requestNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

/**
 * Web notifications can't tick like a native chronometer, so we show the
 * start time and set `timestamp`, which Android renders in the header.
 */
export async function syncNotification(running: Sleep | null, force = false) {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;

  const key = running ? `${running.id}|${running.start}|${running.kind}` : null;
  if (key === lastKey && !force) return;
  lastKey = key;

  if (!running) {
    for (const n of await reg.getNotifications({ tag: TAG })) n.close();
    return;
  }

  await reg.showNotification(`${kindIcon[running.kind]} Schläft seit ${fmtTime(running.start)}`, {
    tag: TAG,
    body: `${kindLabel[running.kind]} · tippen zum Öffnen`,
    icon: 'pwa-192x192.png',
    badge: 'pwa-64x64.png',
    silent: true,
    requireInteraction: true,
    timestamp: Date.parse(running.start),
    actions: [{ action: 'stop', title: 'Aufgewacht' }],
    data: { id: running.id },
  } as NotificationOptions);
}
