/// <reference path="../pb_data/types.d.ts" />

// Web push subscriptions, one per device. Users only see and manage their own.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const own = '@request.auth.id != "" && user = @request.auth.id';

    const subs = new Collection({
      type: 'base',
      name: 'push_subscriptions',
      listRule: own,
      viewRule: own,
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: null,
      deleteRule: own,
      fields: [
        { name: 'user', type: 'relation', required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
        { name: 'endpoint', type: 'text', required: true, max: 1000 },
        { name: 'p256dh', type: 'text', required: true },
        { name: 'auth', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_push_subscriptions_endpoint ON push_subscriptions (endpoint)'],
    });
    app.save(subs);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('push_subscriptions'));
  },
);
