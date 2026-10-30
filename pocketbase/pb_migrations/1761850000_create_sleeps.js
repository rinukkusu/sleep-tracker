/// <reference path="../pb_data/types.d.ts" />

// Creates the "sleeps" collection and turns off public sign-up,
// so only accounts created in the admin UI can log in.
migrate(
  (app) => {
    const authed = '@request.auth.id != "" && @request.auth.collectionName = "users"';

    const sleeps = new Collection({
      type: 'base',
      name: 'sleeps',
      listRule: authed,
      viewRule: authed,
      createRule: authed,
      updateRule: authed,
      deleteRule: authed,
      fields: [
        { name: 'start_at', type: 'date', required: true },
        { name: 'end_at', type: 'date' },
        { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['nap', 'night'] },
        { name: 'note', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_sleeps_start_at ON sleeps (start_at)'],
    });
    app.save(sleeps);

    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    app.save(users);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('sleeps'));
  },
);
