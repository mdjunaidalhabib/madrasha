'use strict';
// v1.1 connector scenarios: user sync, card enrollment (realtime swipe / K40 menu fallback / expiry / cancel /
// duplicate card), clock auto-sync. All against tools/fake-k40.js + tools/fake-cloud.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeEnv, waitFor } = require('./helpers');

const lastHb = (env, pred) => [...env.cloud.heartbeats].reverse().find(pred);
const devUser = (env, pin) => env.k40.users.get(String(pin));
const enrollmentStatus = (env, id) => env.cloud.enrollments.get(id).status;

test('user sync: creates / updates, never deletes users it did not create, reports in heartbeat', async () => {
  const env = await makeEnv();
  try {
    env.k40.addUser('1', 'Manual Admin'); // typed in on the K40: must survive everything
    env.k40.addUser('10002', 'Typed By Hand', 555); // exists before the connector, also in the cloud list
    env.cloud.setUsers([
      { pin: '10001', name: 'Karim', card: null },
      { pin: '10002', name: 'Rahim', card: null, attendee_type: 'TEACHER' },
      { pin: '10003', name: 'Salma', card: '123456', attendee_type: 'STAFF' },
    ]);
    const c = env.newConnector();
    await c.start();
    const v1 = env.cloud.usersVersion;
    await waitFor(() => env.cloud.heartbeats.some((h) => h.users_synced_version === v1), 8000, 'sync v1 reported');
    const hb = lastHb(env, (h) => h.users_synced_version === v1);
    assert.equal(hb.user_sync_error, null);
    assert.equal(hb.device_user_count, 4);
    assert.equal(devUser(env, '10001').name, 'Karim');
    assert.equal(devUser(env, '10003').card, 123456);
    const rahim = devUser(env, '10002');
    assert.equal(rahim.name, 'Rahim', 'renamed');
    assert.equal(rahim.card, 555, 'device card kept when cloud card is null');
    assert.equal(rahim.uid, 2, 'uid kept on rewrite');
    const state = JSON.parse(fs.readFileSync(path.join(env.cfg.localQueuePath, 'user-sync.json'), 'utf8'));
    assert.deepEqual(state.managed, ['10001', '10003']);
    assert.equal(state.version, v1);
    assert.ok(env.k40.stats.refreshCalls >= 1);

    // remove everybody from the cloud list: only the connector-created users go away
    env.cloud.setUsers([{ pin: '10003', name: 'Salma Begum', card: '654321' }]);
    const v2 = env.cloud.usersVersion;
    await waitFor(() => env.cloud.heartbeats.some((h) => h.users_synced_version === v2), 8000, 'sync v2 reported');
    assert.equal(devUser(env, '10001'), undefined, 'connector-created user deleted');
    assert.ok(devUser(env, '1'), 'manual user kept');
    assert.ok(devUser(env, '10002'), 'pre-existing user kept although no longer desired');
    assert.equal(devUser(env, '10003').name, 'Salma Begum');
    assert.equal(devUser(env, '10003').card, 654321);
    assert.equal(env.k40.disabled, false);
    // no further writes when nothing changed
    const writes = env.k40.stats.userWrites;
    const calls = env.cloud.stats.usersCalls;
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(env.k40.stats.userWrites, writes);
    assert.equal(env.cloud.stats.usersCalls, calls, 'user list only fetched when the version changes');
  } finally {
    await env.cleanup();
  }
});

test('user sync writes 28-byte records on a 28-byte device (auto-detected)', async () => {
  const env = await makeEnv({ k40: { userFormat: 28 } });
  try {
    env.k40.addUser('7', 'Old');
    env.cloud.setUsers([{ pin: '10001', name: 'Abdullah Al Mamun', card: '42' }]);
    const c = env.newConnector();
    await c.start();
    await waitFor(() => devUser(env, '10001'), 8000, 'user written');
    assert.equal(env.k40.lastUserWriteSize, 28);
    assert.equal(devUser(env, '10001').name, 'Abdullah');
    assert.equal(env.k40.stats.userWriteRejects, 0);
    const v = env.cloud.usersVersion;
    await waitFor(() => env.cloud.heartbeats.some((h) => h.users_synced_version === v), 5000, 'reported');
  } finally {
    await env.cleanup();
  }
});

test('user sync failure is reported as user_sync_error and retried', async () => {
  const env = await makeEnv({ config: { userRecordSize: 28 } }); // device is 72-byte -> strict fake refuses
  try {
    env.cloud.setUsers([{ pin: '10001', name: 'Karim', card: null }]);
    const c = env.newConnector();
    await c.start();
    await waitFor(() => env.cloud.heartbeats.some((h) => h.user_sync_error), 8000, 'error reported');
    assert.match(lastHb(env, (h) => h.user_sync_error).user_sync_error, /refused/);
    assert.equal(devUser(env, '10001'), undefined);
    await waitFor(() => env.cloud.stats.usersCalls >= 2, 5000, 'retried with backoff');
    assert.ok(!env.cloud.heartbeats.some((h) => h.users_synced_version), 'never claims a version it did not write');
  } finally {
    await env.cleanup();
  }
});

test('enrollment: realtime card swipe -> captured -> card written to the device', async () => {
  const env = await makeEnv();
  try {
    const c = env.newConnector();
    await c.start();
    const e = env.cloud.createEnrollment({ pin: '10005', name: 'New Kid' });
    await waitFor(() => enrollmentStatus(env, e.id) === 'waiting', 8000, 'connector waiting for card');
    assert.equal(devUser(env, '10005').name, 'New Kid', 'person written before waiting');
    assert.equal(env.k40.eventListeners, 1);
    env.k40.swipeCard(3456789);
    await waitFor(() => enrollmentStatus(env, e.id) === 'completed', 5000, 'completed');
    assert.equal(env.cloud.enrollments.get(e.id).card_number, '3456789');
    await waitFor(() => devUser(env, '10005').card === 3456789, 3000, 'card on device');
    await waitFor(() => env.k40.eventListeners === 0, 3000, 'events unregistered / session closed');
    assert.equal(env.k40.disabled, false);
    assert.ok(env.k40.stats.eventAcks >= 1, 'event ACKed');
    const reports = env.cloud.enrollmentReports.filter((r) => r.id === e.id).map((r) => r.status);
    assert.deepEqual(reports, ['waiting', 'captured']);
    // the next user sync sees the card already there: no rewrite of that user
    const v = env.cloud.usersVersion;
    await waitFor(() => env.cloud.heartbeats.some((h) => h.users_synced_version === v), 8000, 'post-enrollment sync');
    assert.equal(devUser(env, '10005').card, 3456789);
    assert.equal(c.enrollStats.completed, 1);
    // punch fetching kept working around the enrollment session
    env.k40.addPunch('10005', '2026-09-20 08:00:00');
    await waitFor(() => env.cloud.events.size === 1, 5000, 'punch after enrollment');
  } finally {
    await env.cleanup();
  }
});

test('regression: enrollment arriving before the first cloud config (no device IP yet) still runs', async () => {
  // At startup the first /commands answer can beat the first /config fetch of the fetch loop. Reproduce
  // deterministically: a connector that never fetched the config (not started, no cache) gets the enrollment.
  const env = await makeEnv();
  try {
    const c = env.newConnector();
    assert.equal(c.effectiveSettings(), undefined, 'no device IP known yet');
    const e = env.cloud.createEnrollment({ pin: '10010', name: 'Early Bird' });
    const wire = { id: e.id, device_user_id: e.device_user_id, name: e.name, card_number: null, attendee_type: 'STUDENT', expires_at: new Date(e.expiresAt).toISOString() };
    const run = c.handleEnrollment(wire, new Date().toISOString());
    await waitFor(() => enrollmentStatus(env, e.id) === 'waiting', 8000, 'waiting');
    env.k40.swipeCard(5150);
    assert.match(await run, /^completed/);
    assert.equal(devUser(env, '10010').card, 5150);
  } finally {
    await env.cleanup();
  }
});

test('enrollment fallback: card enrolled through the K40 menu is detected from the user list', async () => {
  // realtime card events "unsupported": nothing in cardEventCodes matches what the device sends
  const env = await makeEnv({ config: { cardEventCodes: [7777] } });
  try {
    const c = env.newConnector();
    await c.start();
    const e = env.cloud.createEnrollment({ pin: '10006', name: 'Menu Kid' });
    await waitFor(() => enrollmentStatus(env, e.id) === 'waiting', 8000, 'waiting');
    env.k40.swipeCard(111); // ignored (wrong code)
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(enrollmentStatus(env, e.id), 'waiting');
    env.k40.setUserCard('10006', 24680);
    await waitFor(() => enrollmentStatus(env, e.id) === 'completed', 5000, 'completed via menu');
    assert.equal(env.cloud.enrollments.get(e.id).card_number, '24680');
    assert.equal(devUser(env, '10006').card, 24680);
  } finally {
    await env.cleanup();
  }
});

test('enrollment expiry: no card -> expired reported, session closed', async () => {
  const env = await makeEnv();
  try {
    const c = env.newConnector();
    await c.start();
    const e = env.cloud.createEnrollment({ pin: '10007', name: 'Slow', ttlSec: 1.5 });
    await waitFor(() => env.cloud.enrollmentReports.some((r) => r.id === e.id && r.status === 'expired'), 8000, 'expired report');
    assert.equal(enrollmentStatus(env, e.id), 'expired');
    await waitFor(() => env.k40.eventListeners === 0, 3000, 'unregistered');
    assert.equal(c.enrollStats.expired, 1);
    assert.equal(devUser(env, '10007').card, 0);
  } finally {
    await env.cleanup();
  }
});

test('enrollment cancelled by admin: captured card is refused by the cloud and NOT written', async () => {
  const env = await makeEnv();
  try {
    const c = env.newConnector();
    await c.start();
    const e = env.cloud.createEnrollment({ pin: '10008', name: 'Cancel Me' });
    await waitFor(() => enrollmentStatus(env, e.id) === 'waiting', 8000, 'waiting');
    env.cloud.cancelEnrollment(e.id);
    env.k40.swipeCard(13579);
    await waitFor(() => env.cloud.enrollmentReports.some((r) => r.id === e.id && r.status === 'captured'), 5000, 'captured posted');
    await waitFor(() => env.k40.eventListeners === 0, 3000, 'session ended');
    assert.equal(enrollmentStatus(env, e.id), 'cancelled');
    assert.equal(devUser(env, '10008').card, 0, 'card not written after cancellation');
    assert.equal(c.enrollStats.rejected, 1);
  } finally {
    await env.cleanup();
  }
});

test('enrollment with a card already used by another person -> failed, device untouched', async () => {
  const env = await makeEnv();
  try {
    env.cloud.setUsers([{ pin: '10001', name: 'Owner', card: '999' }]);
    const c = env.newConnector();
    await c.start();
    const e = env.cloud.createEnrollment({ pin: '10009', name: 'Second' });
    await waitFor(() => enrollmentStatus(env, e.id) === 'waiting', 8000, 'waiting');
    env.k40.swipeCard(999);
    await waitFor(() => enrollmentStatus(env, e.id) === 'failed', 5000, 'failed');
    assert.match(env.cloud.enrollments.get(e.id).message, /already used by Owner/);
    await waitFor(() => env.k40.eventListeners === 0, 3000, 'session ended');
    assert.equal(devUser(env, '10009').card, 0);
  } finally {
    await env.cleanup();
  }
});

test('old backend without /commands: connector keeps fetching punches', async () => {
  const env = await makeEnv({ cloud: { commandsEnabled: false } });
  try {
    const c = env.newConnector();
    await c.start();
    env.k40.addPunch('1001', '2026-09-20 08:01:00');
    await waitFor(() => env.cloud.events.size === 1, 6000, 'punch synced');
  } finally {
    await env.cleanup();
  }
});

test('clock auto-sync: drift > 60 s is corrected and reported; auto_time_sync=false only reports', async () => {
  const env = await makeEnv({ k40: { timeSkewSec: 600 } });
  try {
    const c = env.newConnector();
    await c.start();
    await waitFor(() => env.k40.stats.setTimeCalls >= 1, 6000, 'SET_TIME');
    await waitFor(() => env.cloud.heartbeats.some((h) => typeof h.clock_drift_sec === 'number' && Math.abs(h.clock_drift_sec) <= 2), 5000, 'drift ~0');
    assert.ok(Math.abs(env.k40.timeSkewSec) <= 2, `device clock corrected (skew ${env.k40.timeSkewSec})`);
    assert.equal(env.k40.stats.setTimeCalls, 1, 'corrected once, not every cycle');
  } finally {
    await env.cleanup();
  }
  const env2 = await makeEnv({ k40: { timeSkewSec: -300 }, cloud: { autoTimeSync: false } });
  try {
    const c = env2.newConnector();
    await c.start();
    await waitFor(() => env2.cloud.heartbeats.some((h) => typeof h.clock_drift_sec === 'number'), 6000, 'drift reported');
    const d = lastHb(env2, (h) => typeof h.clock_drift_sec === 'number').clock_drift_sec;
    assert.ok(Math.abs(d + 300) <= 2, `drift ${d}`);
    assert.equal(env2.k40.stats.setTimeCalls, 0);
  } finally {
    await env2.cleanup();
  }
});

test('config: userRecordSize / cardEventCodes / commandsWaitSec validation', () => {
  const { buildConfig } = require('../dist/config');
  const base = { madrasaSlug: 's', institutionId: 1, deviceId: 'D', apiBaseUrl: 'https://a.b' };
  const d = buildConfig(base, '.', 'k', 'env');
  assert.equal(d.userRecordSize, 'auto');
  assert.deepEqual(d.cardEventCodes, [1024, 2048]);
  assert.equal(d.commandsWaitSec, 15);
  assert.equal(d.userSyncEnabled, true);
  assert.equal(buildConfig({ ...base, userRecordSize: 28 }, '.', 'k', 'env').userRecordSize, 28);
  assert.throws(() => buildConfig({ ...base, userRecordSize: 40 }, '.', 'k', 'env'), /userRecordSize/);
  assert.throws(() => buildConfig({ ...base, cardEventCodes: [] }, '.', 'k', 'env'), /cardEventCodes/);
  assert.throws(() => buildConfig({ ...base, cardEventCodes: ['x'] }, '.', 'k', 'env'), /cardEventCodes/);
  assert.equal(buildConfig({ ...base, commandsWaitSec: 99 }, '.', 'k', 'env').commandsWaitSec, 25);
});
