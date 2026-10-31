/// <reference path="../pb_data/types.d.ts" />

// The Android app registers its FCM token as a subscription with kind "fcm"
// (endpoint = token, no web push keys).
migrate(
  (app) => {
    const subs = app.findCollectionByNameOrId('push_subscriptions');
    subs.fields.add(new SelectField({ name: 'kind', values: ['webpush', 'fcm'], maxSelect: 1 }));
    subs.fields.getByName('p256dh').required = false;
    subs.fields.getByName('auth').required = false;
    app.save(subs);
  },
  (app) => {
    const subs = app.findCollectionByNameOrId('push_subscriptions');
    subs.fields.removeByName('kind');
    app.save(subs);
  },
);
