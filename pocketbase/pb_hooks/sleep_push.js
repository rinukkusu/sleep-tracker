// Helpers for sleep_push.pb.js. Pushes are encrypted and sent by the push
// sidecar (push/ in the repo) listening on 127.0.0.1:8091: web push for the
// PWA, FCM data messages for the Android app (subscriptions with kind "fcm").

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

function post(path, body) {
  return $http.send({
    url: PUSH_URL + path,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    timeout: 15,
  });
}

/** FCM data values must be strings; dates as ISO for the app. */
function fcmData(state) {
  const s = state.sleep;
  const iso = (v) => (v ? v.replace(' ', 'T') : '');
  return {
    type: state.type,
    id: s.id,
    start: iso(s.start),
    end: iso(s.end),
    kind: s.kind,
    pauses: JSON.stringify(
      (s.pauses || []).map((p) => ({ start: iso(p.start), end: p.end ? iso(p.end) : null })),
    ),
  };
}

/** Web push always; the Android app only on changes, its timers tick by themselves. */
function send(app, payload, excludeUserId, withFcm) {
  const web = [];
  const fcm = [];
  for (const s of app.findAllRecords('push_subscriptions')) {
    if (excludeUserId && s.getString('user') === excludeUserId) continue;
    if (s.getString('kind') === 'fcm') fcm.push(s.getString('endpoint'));
    else web.push({ endpoint: s.getString('endpoint'), keys: { p256dh: s.getString('p256dh'), auth: s.getString('auth') } });
  }

  let gone = [];
  if (web.length) {
    const res = post('/send', { subscriptions: web, payload: payload, ttl: 60, urgency: 'high' });
    gone = gone.concat((res.json && res.json.gone) || []);
  }
  if (withFcm && fcm.length) {
    const res = post('/fcm', { tokens: fcm, data: fcmData(payload), ttl: 300 });
    gone = gone.concat((res.json && res.json.gone) || []);
  }

  // Drop subscriptions the push service reports as gone (app uninstalled etc.).
  for (const endpoint of gone) {
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
      if (state.sleep) send(e.app, state, e.auth ? e.auth.id : null, true);
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
