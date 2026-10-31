/// <reference path="../pb_data/types.d.ts" />

// E-mail + password login next to Google. Passwords are set by the admin in
// the dashboard (users.createRule stays null, so nobody can sign up).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.passwordAuth.enabled = true;
    users.passwordAuth.identityFields = ['email'];
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.passwordAuth.enabled = false;
    app.save(users);
  },
);
