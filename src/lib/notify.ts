import { isNative, Sleep } from './native';
import { pb } from './pb';
import { runningNotification, SLEEP_TAG } from './notification';
import type { Sleep as SleepEntry } from './types';

export async function requestNotifyPermission() {
  if (isNative) {
    await Sleep.requestNotificationPermission();
    return;
  }
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  await ensurePushSubscription();
}

/**
 * Shows or clears the "schläft seit …" notification. Called every minute while
 * the app is alive; in the background the server keeps it current via push.
 */
export async function syncNotification(running: SleepEntry | null) {
  if (isNative) return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;

  if (running) {
    await reg.showNotification(...runningNotification(running));
    return;
  }
  for (const n of await reg.getNotifications({ tag: SLEEP_TAG })) {
    // Leave "Aufgewacht um …" from the other phone alone, only clear running ones.
    if (n.data?.id) n.close();
  }
}

/** Registers this device for server pushes and stores the subscription in PocketBase. */
export async function ensurePushSubscription() {
  if (isNative) return ensureFcmSubscription();
  if (!('PushManager' in window) || Notification.permission !== 'granted') return;
  const userId = pb.authStore.record?.id;
  if (!userId) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await pb.send<{ publicKey: string }>('/api/push/key', {});
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      });
    }

    const { endpoint, keys } = sub.toJSON();
    if (!endpoint || !keys) return;
    const existing = await pb
      .collection('push_subscriptions')
      .getList(1, 1, { filter: pb.filter('endpoint = {:endpoint}', { endpoint }) });
    if (existing.items.length) return;
    await pb.collection('push_subscriptions').create({ user: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth });
  } catch (e) {
    console.warn('push subscription failed', e);
  }
}

/** Android app: FCM data messages keep widget and notification current while it's closed. */
async function ensureFcmSubscription() {
  const userId = pb.authStore.record?.id;
  if (!userId) return;
  try {
    const { token } = await Sleep.fcmToken();
    const existing = await pb
      .collection('push_subscriptions')
      .getList(1, 1, { filter: pb.filter('endpoint = {:token}', { token }) });
    if (existing.items.length) return;
    await pb.collection('push_subscriptions').create({ user: userId, endpoint: token, kind: 'fcm' });
  } catch (e) {
    console.warn('FCM registration failed', e);
  }
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
