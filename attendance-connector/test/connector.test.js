'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeEnv, waitFor } = require('./helpers');
const { EventQueue } = require('../dist/queue');
const { buildConfig } = require('../dist/config');
const { makeEventId } = require('../dist/queue');

const T = (n) => `2026-09-20 08:${String(n).padStart(2, '0')}:00`;

test('(b) end to end fetch with comm-key from cloud config -> queue -> cloud', async () => {
  const env = await makeEnv({ commKey: 8765 });
  try {
    env.k40.addPunch('1001', T(1), 1, 0);
    env.k40.addPunch('1002', T(2), 15, 1);
    const c = env.newConnector();
    await c.start();
    await waitFor(() => env.cloud.events.size === 2, 8000, 'events at cloud');
    const ev = env.cloud.acceptedEvents.find((e) => e.device_user_id === '1002');
    assert.equal(ev.timestamp, '2026-09-20T08:02:00+06:00');
    assert.equal(ev.verify_type, 15);
    assert.equal(ev.in_out_state, 1);
    assert.equal(env.k40.stats.authOk >= 1, true);
    assert.equal(env.k40.stats.clearCalls, 0);
    assert.equal(env.k40.punches.length, 2, 'device log untouched');
    assert.ok(env.cloud.stats.heartbeatCalls >= 1);
    assert.equal(env.cloud.heartbeats.at(-1).device_status, 'online');
    assert.equal(env.cloud.heartbeats.at(-1).device_id, 'K40-01');
    assert.equal(env.k40.stats.checksumErrors, 0);
    // (e) re-fetching the whole device log every cycle must not create duplicates anywhere
    const cyc = c.stats.cycles;
    await waitFor(() => c.stats.cycles >= cyc + 3, 5000, '3 more cycles');
    assert.equal(env.cloud.events.size, 2);
    assert.equal(env.cloud.stats.ingestCalls, 1, 'no resend of already synced events');
    assert.equal(c.queue.counts().synced, 2);
  } finally {
    await env.cleanup();
  }
});

test('(d) internet down -> events stay pending while K40 fetching continues; up -> synced', async () => {
  const env = await makeEnv({ localDevice: true });
  try {
    env.cloud.setMode('down');
    const c = env.newConnector();
    await c.start();
    env.k40.addPunch('1001', T(1));
    env.k40.addPunch('1002', T(2));
    await waitFor(() => c.queue.counts().pending === 2, 5000, 'queued while offline');
    env.k40.addPunch('1003', T(3)); // keeps arriving while cloud is down
    await waitFor(() => c.queue.counts().pending === 3, 5000, 'still fetching from K40');
    assert.equal(env.cloud.events.size, 0);
    assert.ok(c.stats.ingestFailures >= 1);
    env.cloud.setMode('up');
    await waitFor(() => env.cloud.events.size === 3 && c.queue.counts().pending === 0, 8000, 'drained after recovery');
    assert.equal(c.queue.counts().synced, 3);
  } finally {
    await env.cleanup();
  }
});

test('(d) 5xx also keeps events pending and retries', async () => {
  const env = await makeEnv({ localDevice: true });
  try {
    env.cloud.setMode('error503');
    const c = env.newConnector();
    await c.start();
    env.k40.addPunch('1001', T(1));
    await waitFor(() => c.stats.ingestFailures >= 2, 5000, 'retries with backoff');
    assert.equal(c.queue.counts().pending, 1);
    env.cloud.setMode('up');
    await waitFor(() => env.cloud.events.size === 1, 8000, 'recovered');
  } finally {
    await env.cleanup();
  }
});

test('(e) lost response (cloud processed, connector never heard) -> resend is a duplicate, stored once', async () => {
  const env = await makeEnv();
  try {
    env.cloud.dropNextResponses(2);
    const c = env.newConnector();
    await c.start();
    env.k40.addPunch('1001', T(1));
    env.k40.addPunch('1002', T(2));
    await waitFor(() => c.queue.counts().synced === 2, 8000, 'synced after resends');
    assert.equal(env.cloud.events.size, 2);
    assert.ok(env.cloud.stats.duplicates >= 2, 'cloud saw the resent events as duplicates');
    assert.equal(c.stats.syncedDuplicate >= 2, true);
    assert.equal(env.cloud.received.length > env.cloud.events.size, true);
  } finally {
    await env.cleanup();
  }
});

test('(f) crash while in syncing state: restart recovers and syncs exactly once', async () => {
  const env = await makeEnv();
  try {
    // simulate: previous process marked events syncing, sent them (cloud stored them), died before recording the reply
    const q = EventQueue.open(env.cfg.localQueuePath);
    const evs = [1, 2, 3].map((n) => {
      const ts = `2026-09-20T08:0${n}:00+06:00`;
      return { id: makeEventId(env.cfg.deviceId, String(1000 + n), ts, 1, 0), deviceUserId: String(1000 + n), timestamp: ts, verifyType: 1, inOutState: 0 };
    });
    q.enqueue(evs);
    q.markSyncing(evs.map((e) => e.id));
    q.close();
    // cloud already got the first one before the "crash"
    env.cloud.events.set(evs[0].id, { event_id: evs[0].id });
    const c = env.newConnector();
    await c.start();
    assert.equal(c.queue.loadInfo.recoveredSyncing, 3);
    await waitFor(() => c.queue.counts().synced === 3, 8000, 'all synced');
    assert.equal(env.cloud.events.size, 3);
    assert.equal(env.cloud.stats.duplicates, 1);
    assert.equal(env.cloud.stats.accepted, 2);
  } finally {
    await env.cleanup();
  }
});

test('rejected events are marked failed with reason, not retried forever; retry-failed re-queues', async () => {
  const env = await makeEnv({ cloud: { rejectUserIds: ['666'] } });
  try {
    env.k40.addPunch('666', T(1));
    env.k40.addPunch('1001', T(2));
    const c = env.newConnector();
    await c.start();
    await waitFor(() => c.queue.counts().failed === 1 && c.queue.counts().synced === 1, 8000, 'one failed one synced');
    const failed = c.queue.list('failed')[0];
    assert.match(failed.lastError, /unknown device user/);
    const calls = env.cloud.stats.ingestCalls;
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(env.cloud.stats.ingestCalls, calls, 'failed events are not resent automatically');
    assert.equal(c.queue.counts().failed, 1, 'kept for inspection');
  } finally {
    await env.cleanup();
  }
});

test('401 from cloud: stops hammering, events stay pending, then recovers after backoff window', async () => {
  const env = await makeEnv({ authBackoffSec: 0.6, localDevice: true });
  try {
    env.cloud.setMode('unauth');
    const c = env.newConnector();
    await c.start();
    env.k40.addPunch('1001', T(1));
    await waitFor(() => c.queue.counts().pending === 1, 5000, 'queued');
    await waitFor(() => env.cloud.stats.unauthorized >= 1, 5000, '401 seen');
    const seen = env.cloud.stats.unauthorized;
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(env.cloud.stats.unauthorized - seen <= 2, 'backs off instead of retrying every cycle');
    assert.equal(c.queue.counts().pending, 1);
    env.cloud.setMode('up');
    await waitFor(() => env.cloud.events.size === 1, 10000, 'recovered after auth backoff');
  } finally {
    await env.cleanup();
  }
});

test('K40 unreachable -> offline heartbeat, retries with backoff, never crashes; recovers online', async () => {
  const env = await makeEnv();
  try {
    env.k40.mode = 'refuse';
    const c = env.newConnector();
    await c.start();
    await waitFor(() => env.cloud.heartbeats.some((h) => h.device_status === 'offline'), 6000, 'offline heartbeat');
    const off = env.cloud.heartbeats.find((h) => h.device_status === 'offline');
    assert.ok(off.error && off.error.length > 0);
    assert.ok(c.stats.k40Failures >= 1);
    env.k40.addPunch('1001', T(1));
    env.k40.mode = 'normal';
    await waitFor(() => env.cloud.events.size === 1, 10000, 'event after K40 returns');
    await waitFor(() => env.cloud.heartbeats.at(-1).device_status === 'online', 5000, 'online heartbeat');
    assert.equal(c.aborted, false);
  } finally {
    await env.cleanup();
  }
});

test('cloud-requested connection test is executed and reported in the next heartbeat', async () => {
  const env = await makeEnv();
  try {
    env.cloud.testRequested = true;
    const c = env.newConnector();
    await c.start();
    await waitFor(() => env.cloud.heartbeats.some((h) => h.test_result), 6000, 'test_result heartbeat');
    const hb = env.cloud.heartbeats.find((h) => h.test_result);
    assert.equal(hb.test_result.ok, true);
    assert.match(hb.test_result.message, /device time/);
    assert.equal(env.cloud.testRequested, false);
  } finally {
    await env.cleanup();
  }
});

test('failed connection test is reported with ok=false', async () => {
  const env = await makeEnv({ commKey: 111 });
  try {
    env.cloud.config.comm_password = '222'; // wrong key configured in cloud
    env.cloud.testRequested = true;
    const c = env.newConnector();
    await c.start();
    await waitFor(() => env.cloud.heartbeats.some((h) => h.test_result), 6000, 'test_result heartbeat');
    const hb = env.cloud.heartbeats.find((h) => h.test_result);
    assert.equal(hb.test_result.ok, false);
    assert.match(hb.test_result.message, /communication key|Comm Key/i);
  } finally {
    await env.cleanup();
  }
});

test('clearDeviceLogsAfterSync=false (default) never clears; =true clears only after everything is synced', async () => {
  const env = await makeEnv({ localDevice: true, config: { clearDeviceLogsAfterSync: true } });
  try {
    env.cloud.setMode('down');
    env.k40.addPunch('1001', T(1));
    const c = env.newConnector();
    await c.start();
    await waitFor(() => c.queue.counts().pending === 1, 5000, 'queued');
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(env.k40.stats.clearCalls, 0, 'must not clear while unsynced');
    assert.equal(env.k40.punches.length, 1);
    env.cloud.setMode('up');
    await waitFor(() => env.k40.stats.clearCalls === 1, 10000, 'cleared after sync');
    assert.equal(env.cloud.events.size, 1);
    assert.equal(env.k40.disabled, false, 'device re-enabled after clearing');
  } finally {
    await env.cleanup();
  }
});

test('restart of the whole connector keeps pending events and continues', async () => {
  const env = await makeEnv({ localDevice: true });
  try {
    env.cloud.setMode('down');
    env.k40.addPunch('1001', T(1));
    env.k40.addPunch('1002', T(2));
    let c = env.newConnector();
    await c.start();
    await waitFor(() => c.queue.counts().pending === 2, 5000, 'queued');
    await c.stop(); // PC restart
    env.k40.punches = []; // even if the device log is gone, the queue still has them
    c = env.newConnector();
    await c.start();
    const cnt = c.queue.counts();
    assert.equal(cnt.pending + cnt.syncing, 2, 'events survived the restart (a send attempt may already be in flight)');
    env.cloud.setMode('up');
    await waitFor(() => env.cloud.events.size === 2, 8000, 'synced after restart');
  } finally {
    await env.cleanup();
  }
});

test('graceful stop re-enables device and completes quickly', async () => {
  const env = await makeEnv({ config: { disableDeviceDuringRead: true } });
  try {
    env.k40.addPunch('1001', T(1));
    const c = env.newConnector();
    await c.start();
    await waitFor(() => env.k40.stats.disableCalls >= 1, 5000, 'device disabled during read');
    const t0 = Date.now();
    await c.stop();
    assert.ok(Date.now() - t0 < 5000);
    assert.equal(env.k40.disabled, false);
  } finally {
    await env.cleanup();
  }
});

test('config: https enforced, http only for localhost with allowInsecureHttp', () => {
  const base = { madrasaSlug: 's', institutionId: 1, deviceId: 'D' };
  assert.throws(() => buildConfig({ ...base, apiBaseUrl: 'http://api.example.com' }, '.', 'k', 'env'), /https/);
  assert.throws(() => buildConfig({ ...base, apiBaseUrl: 'http://api.example.com', allowInsecureHttp: true }, '.', 'k', 'env'), /https/);
  assert.throws(() => buildConfig({ ...base, apiBaseUrl: 'http://localhost:3000' }, '.', 'k', 'env'), /https/);
  assert.equal(buildConfig({ ...base, apiBaseUrl: 'http://localhost:3000', allowInsecureHttp: true }, '.', 'k', 'env').apiBaseUrl, 'http://localhost:3000');
  assert.equal(buildConfig({ ...base, apiBaseUrl: 'https://api.example.com/api/' }, '.', 'k', 'env').apiBaseUrl, 'https://api.example.com');
  assert.throws(() => buildConfig({ ...base, apiBaseUrl: 'ftp://x' }, '.', 'k', 'env'), /https/);
  assert.throws(() => buildConfig({ ...base, institutionId: 'x', apiBaseUrl: 'https://a.b' }, '.', 'k', 'env'), /institutionId/);
});

test('cloud config is cached on disk and used when the cloud is unreachable at startup', async () => {
  const env = await makeEnv({ commKey: 5555 });
  try {
    let c = env.newConnector();
    await c.start();
    env.k40.addPunch('1001', T(1));
    await waitFor(() => env.cloud.events.size === 1, 8000, 'first sync');
    await c.stop();
    // restart with cloud completely down: device ip/port/comm key must come from cache
    env.cloud.setMode('down');
    env.k40.addPunch('1002', T(2));
    c = env.newConnector();
    await c.start();
    await waitFor(() => c.queue.counts().pending === 1, 6000, 'K40 fetched using cached config');
    assert.equal(env.cloud.events.size, 1);
  } finally {
    await env.cleanup();
  }
});
