/// <reference path="../pb_data/types.d.ts" />

// Short wake-ups during a sleep: [{ start, end }], end null while still awake.
migrate(
  (app) => {
    const sleeps = app.findCollectionByNameOrId('sleeps');
    sleeps.fields.add(new JSONField({ name: 'pauses', maxSize: 0 }));
    app.save(sleeps);
  },
  (app) => {
    const sleeps = app.findCollectionByNameOrId('sleeps');
    sleeps.fields.removeByName('pauses');
    app.save(sleeps);
  },
);
