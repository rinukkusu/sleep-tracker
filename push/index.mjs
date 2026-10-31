// Tiny push sender for PocketBase hooks (PocketBase can't do the payload
// encryption itself). Listens on localhost only; PocketBase passes the
// subscriptions and payload, we encrypt, send and report dead subscriptions.
// Web push for the PWA, Firebase Cloud Messaging for the Android app.
import fs from 'node:fs';
import http from 'node:http';
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import webpush from 'web-push';

const PORT = Number(process.env.PORT || 8091);
const KEYS_FILE = process.env.VAPID_FILE || '/data/vapid.json';
const SUBJECT = process.env.VAPID_SUBJECT || 'https://pb.bin-ary.de';
// Firebase service account key, without it only web push works.
const FIREBASE_FILE = process.env.FIREBASE_FILE || '/data/firebase.json';

function loadKeys() {
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  } catch {
    const keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys), { mode: 0o600 });
    console.log('generated new VAPID keys');
    return keys;
  }
}

const keys = loadKeys();
webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);

let messaging = null;
if (fs.existsSync(FIREBASE_FILE)) {
  messaging = getMessaging(initializeApp({ credential: cert(JSON.parse(fs.readFileSync(FIREBASE_FILE, 'utf8'))) }));
} else {
  console.log(`no ${FIREBASE_FILE}, FCM disabled`);
}

function reply(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let data = '';
  for await (const chunk of req) data += chunk;
  return JSON.parse(data);
}

async function handleSend(body) {
  const gone = [];
  const payload = JSON.stringify(body.payload);
  const options = { TTL: body.ttl ?? 60, urgency: body.urgency ?? 'normal' };
  await Promise.all(
    (body.subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload, options);
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) gone.push(sub.endpoint);
        else console.warn('push failed', e.statusCode, e.body ?? e.message);
      }
    }),
  );
  return { sent: (body.subscriptions?.length ?? 0) - gone.length, gone };
}

// Data-only messages: the app updates its widget and notification itself.
async function handleFcm(body) {
  const tokens = body.tokens ?? [];
  if (!messaging || !tokens.length) return { sent: 0, gone: [] };
  const data = Object.fromEntries(Object.entries(body.data ?? {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  const res = await messaging.sendEach(tokens.map((token) => ({ token, data, android: { priority: 'high', ttl: (body.ttl ?? 300) * 1000 } })));
  const gone = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code;
    const badToken = code === 'messaging/invalid-argument' && /registration token/i.test(r.error?.message ?? '');
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || badToken) gone.push(tokens[i]);
    else console.warn('fcm failed', code, r.error?.message);
  });
  return { sent: res.successCount, gone };
}

http
  .createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/key') return reply(res, 200, { publicKey: keys.publicKey });
      if (req.method === 'POST' && req.url === '/send') return reply(res, 200, await handleSend(await readJson(req)));
      if (req.method === 'POST' && req.url === '/fcm') return reply(res, 200, await handleFcm(await readJson(req)));
      reply(res, 404, { error: 'not found' });
    } catch (e) {
      console.error(e);
      reply(res, 500, { error: String(e) });
    }
  })
  .listen(PORT, '127.0.0.1', () => console.log(`push sidecar on 127.0.0.1:${PORT}`));
