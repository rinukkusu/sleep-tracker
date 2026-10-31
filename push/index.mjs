// Tiny web push sender for PocketBase hooks (PocketBase can't do the payload
// encryption itself). Listens on localhost only; PocketBase passes the
// subscriptions and payload, we encrypt, send and report dead subscriptions.
import fs from 'node:fs';
import http from 'node:http';
import webpush from 'web-push';

const PORT = Number(process.env.PORT || 8091);
const KEYS_FILE = process.env.VAPID_FILE || '/data/vapid.json';
const SUBJECT = process.env.VAPID_SUBJECT || 'https://pb.bin-ary.de';

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

http
  .createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/key') return reply(res, 200, { publicKey: keys.publicKey });
      if (req.method === 'POST' && req.url === '/send') return reply(res, 200, await handleSend(await readJson(req)));
      reply(res, 404, { error: 'not found' });
    } catch (e) {
      console.error(e);
      reply(res, 500, { error: String(e) });
    }
  })
  .listen(PORT, '127.0.0.1', () => console.log(`push sidecar on 127.0.0.1:${PORT}`));
