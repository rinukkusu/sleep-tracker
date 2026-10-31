/// <reference path="../pb_data/types.d.ts" />

// Keep parents logged in for 90 days (default is 7). The app extends the
// token whenever it comes to the foreground.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.authToken.duration = 90 * 24 * 60 * 60;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.authToken.duration = 7 * 24 * 60 * 60;
    app.save(users);
  },
);
