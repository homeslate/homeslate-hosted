#!/usr/bin/env node
import { usage } from './_env.ts';
import { findUserByEmail, getDb, listOwnedDisplays } from './_db.ts';

const email = process.argv[2];
if (!email || email.startsWith('-')) {
  usage('Usage: npm run ops:lookup-user -- <email>');
}

const db = getDb();
const user = await findUserByEmail(db, email);

if (!user) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}

const ownedDisplays = await listOwnedDisplays(db, user.id);

console.log('User');
console.log(JSON.stringify(user, null, 2));
console.log('');
console.log(`Owned displays (${ownedDisplays.length})`);
if (ownedDisplays.length === 0) {
  console.log('  (none)');
} else {
  for (const display of ownedDisplays) {
    console.log(`  - ${display.name}  internal=${display.id}  public=${display.displayId}`);
  }
}
