// Helpers for sleep_push.pb.js. Pushes are encrypted and sent by the push
// sidecar (push/ in the repo) listening on 127.0.0.1:8091.

const PUSH_URL = 'http://127.0.0.1:8091';

function sleepJson(r) {
  let pauses = [];
  try {
    pauses = JSON.parse(r.getString('pauses') || '[]') || [];
  } catch (_) {}
  return {
    id: r.id,
    start: r.getString('start_at'),
    end: r.getString('end_at') || null,
    kind: r.getString('kind'),
    pauses: pauses,
  };
}

function currentState(app) {
  const running = app.findRecordsByFilter('sleeps', "end_at = ''", '-start_at', 1, 0);
  if (running.length) return { type: 'running', sleep: sleepJson(running[0]) };
  const last = app.findRecordsByFilter('sleeps', "end_at != ''", '-end_at', 1, 0);
  return { type: 'awake', sleep: last.length ? sleepJson(last[0]) : null };
}

function send(app, payload, excludeUserId) {
  const subs = app.findAllRecords('push_subscriptions');
  const targets = [];
  for (const s of subs) {
    if (excludeUserId && s.getString('user') === excludeUserId) continue;
    targets.push({ endpoint: s.getString('endpoint'), keys: { p256dh: s.getString('p256dh'), auth: s.getString('auth') } });
  }
  if (!targets.length) return;

  const res = $http.send({
    url: PUSH_URL + '/send',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscriptions: targets, payload: payload, ttl: 60, urgency: 'high' }),
    timeout: 15,
  });

  // Drop subscriptions the push service reports as gone (app uninstalled etc.).
  for (const endpoint of (res.json && res.json.gone) || []) {
    try {
      app.delete(app.findFirstRecordByData('push_subscriptions', 'endpoint', endpoint));
    } catch (_) {}
  }
}

module.exports = {
  /**
   * After a change made through the API: tell the other devices right away.
   * A failed push must never fail the request itself.
   */
  pushChangeSafe(e) {
    try {
      const state = currentState(e.app);
      if (state.sleep) send(e.app, state, e.auth ? e.auth.id : null);
    } catch (err) {
      e.app.logger().warn('sleep push failed', 'error', String(err));
    }
  },

  /** Every minute: refresh the duration on all devices while she sleeps. */
  pushTick(app) {
    try {
      const state = currentState(app);
      if (state.type === 'running') send(app, state, null);
    } catch (err) {
      app.logger().warn('sleep push tick failed', 'error', String(err));
    }
  },

  publicKey() {
    return $http.send({ url: PUSH_URL + '/key', method: 'GET', timeout: 5 }).json;
  },
};
