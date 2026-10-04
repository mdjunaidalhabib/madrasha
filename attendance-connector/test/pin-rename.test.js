'use strict';
// v2.1 "PIN = registration number": the cloud changes a person's PIN and sends the old one as prev_pin. The connector
// must rewrite the SAME K40 record (same uid -> fingerprints kept) with the new user id instead of creating a duplicate.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DU = require('../dist/device-users');
const { makeEnv, waitFor } = require('./helpers');

const devUser = (env, pin) => env.k40.users.get(String(pin));
const managedOf = (env) => JSON.parse(fs.readFileSync(path.join(env.cfg.localQueuePath, 'user-sync.json'), 'utf8')).managed;
const synced = (env) => {
  const v = env.cloud.usersVersion;
  return waitFor(() => env.cloud.heartbeats.some((h) => h.users_synced_version === v), 8000, `sync of ${v.slice(0, 8)}`);
};

test('planUserSync: prev_pin rename rules', () => {
  const dev = [
    { uid: 3, userId: '501', name: 'Old', privilege: 14, card: 777, password: 'pw', groupId: '1' },
    { uid: 4, userId: '601', name: 'Q managed', privilege: 0, card: 0 },
    { uid: 5, userId: '10601', name: 'P exists', privilege: 0, card: 0 },
    { uid: 6, userId: '602', name: 'Q manual', privilege: 0, card: 0 },
    { uid: 7, userId: '10602', name: 'P exists 2', privilege: 0, card: 0 },
    { uid: 8, userId: '700', name: 'Also desired', privilege: 0, card: 0 },
  ];
  const desired = [
    { pin: '10501', name: 'New', card: null, attendee_type: 'STUDENT', prev_pin: '501' },
    { pin: '10601', name: 'P exists', card: null, attendee_type: 'STUDENT', prev_pin: '601' },
    { pin: '10602', name: 'P exists 2', card: null, attendee_type: 'STUDENT', prev_pin: '602' },
    { pin: '10700', name: 'Steal', card: null, attendee_type: 'STUDENT', prev_pin: '700' }, // 700 is itself desired
    { pin: '700', name: 'Also desired', card: null, attendee_type: 'STUDENT', prev_pin: null },
    { pin: '10800', name: 'Gone', card: null, attendee_type: 'STUDENT', prev_pin: '800' }, // prev not on device
  ];
  const plan = DU.planUserSync(dev, desired, ['601', '501'], 72);
  assert.equal(plan.rename.length, 1);
  const r = plan.rename[0];
  assert.deepEqual([r.fromPin, r.pin, r.uid, r.card, r.privilege, r.password, r.groupId], ['501', '10501', 3, 777, 14, 'pw', '1']);
  assert.deepEqual(plan.create.map((w) => w.pin).sort(), ['10700', '10800'], 'never steals a desired pin; prev missing -> create');
  assert.deepEqual(plan.delete.map((d) => d.pin), ['601'], 'P and Q both exist: managed Q deleted, renamed 501 never deleted');
  assert.equal(plan.update.length, 0);
  // cloud card wins over the device card on a rename, like an update
  const p2 = DU.planUserSync(dev, [{ ...desired[0], card: '4242' }], [], 72);
  assert.equal(p2.rename[0].card, 4242);
});

test('rename keeps uid + fingerprint, card rules, no duplicate; unmanaged Q -> P becomes managed', async () => {
  const env = await makeEnv();
  try {
    env.k40.addUser('501', 'Karim Old', 777); // typed in by hand (unmanaged), with fingerprint and card
    env.k40.addUser('502', 'Rahim Old', 0);
    env.k40.addFingerprint('501', 'FP-KARIM');
    env.k40.addFingerprint('502', 'FP-RAHIM');
    const uid501 = devUser(env, '501').uid;
    const uid502 = devUser(env, '502').uid;
    env.cloud.setUsers([
      { pin: '10501', name: 'Karim', card: null, prev_pin: '501' },
      { pin: '10502', name: 'Rahim', card: '888', prev_pin: '502' },
    ]);
    const c = env.newConnector();
    await c.start();
    await synced(env);
    const k = devUser(env, '10501');
    assert.equal(k.uid, uid501, 'same uid');
    assert.equal(env.k40.templateOf('10501'), 'FP-KARIM', 'fingerprint survives');
    assert.equal(k.card, 777, 'device card kept when cloud card is null');
    assert.equal(k.name, 'Karim');
    const r = devUser(env, '10502');
    assert.equal(r.uid, uid502);
    assert.equal(r.card, 888, 'cloud card written');
    assert.equal(env.k40.templateOf('10502'), 'FP-RAHIM');
    assert.equal(devUser(env, '501'), undefined);
    assert.equal(devUser(env, '502'), undefined);
    assert.equal(env.k40.users.size, 2, 'no duplicate created');
    assert.equal(env.k40.stats.userDeletes, 0);
    assert.deepEqual(managedOf(env), ['10501', '10502'], 'renamed records become managed');
    assert.equal(env.cloud.heartbeats.find((h) => h.users_synced_version === env.cloud.usersVersion).device_user_count, 2);
  } finally {
    await env.cleanup();
  }
});

test('rename of a managed Q: managed set swaps Q -> P; later removal deletes P', async () => {
  const env = await makeEnv();
  try {
    env.cloud.setUsers([{ pin: '701', name: 'Salma' }]);
    const c = env.newConnector();
    await c.start();
    await synced(env);
    assert.deepEqual(managedOf(env), ['701']);
    env.k40.addFingerprint('701', 'FP-SALMA');
    const uid = devUser(env, '701').uid;
    env.cloud.setUsers([{ pin: '10701', name: 'Salma', prev_pin: '701' }]);
    await synced(env);
    assert.equal(devUser(env, '10701').uid, uid);
    assert.equal(env.k40.templateOf('10701'), 'FP-SALMA');
    assert.equal(devUser(env, '701'), undefined);
    assert.equal(env.k40.users.size, 1);
    assert.deepEqual(managedOf(env), ['10701']);
    env.cloud.setUsers([]);
    await synced(env);
    assert.equal(env.k40.users.size, 0, 'P is managed now, so it is deleted when removed in the cloud');
  } finally {
    await env.cleanup();
  }
});

test('P and Q both on the device: P updated, Q deleted only if managed', async () => {
  const env = await makeEnv();
  try {
    env.cloud.setUsers([{ pin: '601', name: 'Managed Q' }]);
    const c = env.newConnector();
    await c.start();
    await synced(env); // 601 created by the connector -> managed
    env.k40.addUser('10601', 'Typed P'); // P already typed in by hand
    env.k40.addUser('602', 'Manual Q'); // unmanaged Q
    env.k40.addUser('10602', 'Typed P2');
    env.k40.addFingerprint('602', 'FP-602');
    const uidP = devUser(env, '10601').uid;
    env.cloud.setUsers([
      { pin: '10601', name: 'Abdul', prev_pin: '601' },
      { pin: '10602', name: 'Fatema', prev_pin: '602' },
    ]);
    await synced(env);
    assert.equal(devUser(env, '10601').name, 'Abdul');
    assert.equal(devUser(env, '10601').uid, uidP, 'P updated in place');
    assert.equal(devUser(env, '601'), undefined, 'managed Q deleted');
    assert.equal(devUser(env, '10602').name, 'Fatema');
    assert.ok(devUser(env, '602'), 'unmanaged Q left alone');
    assert.equal(env.k40.templateOf('602'), 'FP-602');
    assert.equal(env.k40.users.size, 3);
    assert.deepEqual(managedOf(env), []);
  } finally {
    await env.cleanup();
  }
});

test('enrollment of a converted person renames prev_pin in place (no duplicate, fingerprint kept)', async () => {
  const env = await makeEnv();
  try {
    env.k40.addUser('901', 'Old Pin', 0);
    env.k40.addFingerprint('901', 'FP-901');
    const uid = devUser(env, '901').uid;
    env.cloud.setUsers([{ pin: '10901', name: 'Converted', prev_pin: '901' }]);
    // connector not started -> no user sync runs: the enrollment itself must do the rename
    const c = env.newConnector();
    const wire = (e) => ({ id: e.id, device_user_id: e.device_user_id, name: e.name, card_number: null, attendee_type: 'STUDENT', expires_at: new Date(e.expiresAt).toISOString() });
    const e = env.cloud.createEnrollment({ pin: '10901', name: 'Converted' });
    const run = c.handleEnrollment(wire(e), new Date().toISOString());
    await waitFor(() => env.cloud.enrollments.get(e.id).status === 'waiting', 8000, 'waiting');
    assert.equal(devUser(env, '10901').uid, uid);
    assert.equal(env.k40.templateOf('10901'), 'FP-901');
    assert.equal(devUser(env, '901'), undefined);
    env.k40.swipeCard(5151);
    assert.match(await run, /^completed/);
    assert.equal(env.k40.users.size, 1, 'no duplicate person');
    assert.equal(devUser(env, '10901').card, 5151);
    assert.deepEqual(c.userState.managed, ['10901']);
  } finally {
    await env.cleanup();
  }
});
