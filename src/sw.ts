/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { awakeNotification, runningNotification, type NotifySleep } from './lib/notification';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Sent by PocketBase every minute while she sleeps and on every change made
// on the other phone. Durations are computed here, so delayed pushes are still right.
self.addEventListener('push', (event) => {
  const data = event.data?.json() as { type: 'running' | 'awake'; sleep: NotifySleep | null } | undefined;
  if (!data?.sleep) return;
  const [title, options] = data.type === 'running' ? runningNotification(data.sleep) : awakeNotification(data.sleep);
  event.waitUntil(self.registration.showNotification(title, options));
});

// "Aufgewacht" action stops the running session. The click time is passed
// along so the end time is right even if the app takes a moment to open.
self.addEventListener('notificationclick', (event) => {
  const at = Date.now();
  const stop = event.action === 'stop';
  if (stop) event.notification.close();

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = windows[0];
      if (client) {
        if (stop) client.postMessage({ type: 'stop', at });
        await client.focus();
        return;
      }
      const url = new URL(self.registration.scope);
      if (stop) url.searchParams.set('stop', String(at));
      await self.clients.openWindow(url.href);
    })(),
  );
});
