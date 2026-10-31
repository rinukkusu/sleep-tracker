/// <reference path="../pb_data/types.d.ts" />

// Keeps the "schläft seit …" notification current on every device via web push.
// Handlers run in isolated contexts (no access to top-level declarations),
// so each one requires the helpers itself.

cronAdd('sleep_push_tick', '* * * * *', () => {
  require(`${__hooks}/sleep_push.js`).pushTick($app);
});

onRecordCreateRequest((e) => {
  e.next();
  require(`${__hooks}/sleep_push.js`).pushChangeSafe(e);
}, 'sleeps');

onRecordUpdateRequest((e) => {
  e.next();
  require(`${__hooks}/sleep_push.js`).pushChangeSafe(e);
}, 'sleeps');

onRecordDeleteRequest((e) => {
  e.next();
  require(`${__hooks}/sleep_push.js`).pushChangeSafe(e);
}, 'sleeps');

routerAdd('GET', '/api/push/key', (e) => {
  return e.json(200, require(`${__hooks}/sleep_push.js`).publicKey());
});
