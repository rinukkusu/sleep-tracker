/// <reference path="../pb_data/types.d.ts" />

// Remembers who last created or changed a sleep: the user's name, or the part
// of the e-mail before the @ if no name is set. Clients can't set it themselves.

onRecordCreateRequest((e) => {
  const auth = e.auth;
  if (auth && !auth.isSuperuser()) e.record.set('by', auth.getString('name') || auth.email().split('@')[0]);
  e.next();
}, 'sleeps');

onRecordUpdateRequest((e) => {
  const auth = e.auth;
  if (auth && !auth.isSuperuser()) e.record.set('by', auth.getString('name') || auth.email().split('@')[0]);
  e.next();
}, 'sleeps');
