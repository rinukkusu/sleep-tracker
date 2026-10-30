/// <reference path="../pb_data/types.d.ts" />

// Login only via Google OAuth2. Since users.createRule is null, Google can only
// log into user records that already exist with a matching e-mail address.
// The Google client id/secret are set in the admin UI (users -> Options -> OAuth2).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.oauth2.enabled = true;
    users.passwordAuth.enabled = false;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.oauth2.enabled = false;
    users.passwordAuth.enabled = true;
    app.save(users);
  },
);
