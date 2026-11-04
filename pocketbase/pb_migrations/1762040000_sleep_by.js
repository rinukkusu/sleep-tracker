/// <reference path="../pb_data/types.d.ts" />

// Who last created or changed a sleep, set by pb_hooks/sleep_by.pb.js.
migrate(
  (app) => {
    const sleeps = app.findCollectionByNameOrId('sleeps');
    sleeps.fields.add(new TextField({ name: 'by', max: 100 }));
    app.save(sleeps);
  },
  (app) => {
    const sleeps = app.findCollectionByNameOrId('sleeps');
    sleeps.fields.removeByName('by');
    app.save(sleeps);
  },
);
