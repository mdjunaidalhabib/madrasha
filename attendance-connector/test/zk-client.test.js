'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ZKClient, ZKError, zkTimeToIso } = require('../dist/protocol');
const { FakeK40 } = require('../tools/fake-k40');

async function withK40(opts, fn) {
  const k = new FakeK40(opts);
  const port = await k.start();
  try {
    await fn(k, port);
  } finally {
    await k.stop();
  }
}
const client = (port, extra = {}) => new ZKClient({ host: '127.0.0.1', port, connectTimeoutMs: 800, timeoutMs: 1500, ...extra });

async function fetchAll(port, extra) {
  const c = client(port, extra);
  try {
    await c.connect();
    return await c.getAttendance(true);
  } finally {
    await c.close();
  }
}

test('fetch with comm-key authentication (40-byte format, chunked + fragmented TCP)', async () => {
  await withK40({ commKey: 4321, format: 40, chunkSize: 64 }, async (k, port) => {
    k.addPunch('1001', '2026-09-20 08:01:02', 1, 0);
    k.addPunch('1002', '2026-09-20 08:05:00', 15, 1);
    const r = await fetchAll(port, { commKey: 4321 });
    assert.equal(r.recordSize, 40);
    assert.equal(r.punches.length, 2);
    assert.equal(r.punches[0].userId, '1001');
    assert.equal(zkTimeToIso(r.punches[1].time, '+06:00'), '2026-09-20T08:05:00+06:00');
    assert.equal(k.stats.authOk, 1);
    assert.equal(k.stats.unauthReplies, 1);
    assert.equal(k.stats.checksumErrors, 0);
    assert.equal(k.stats.clearCalls, 0, 'must never clear device logs by default');
    assert.equal(k.punches.length, 2);
  });
});

test('wrong comm key -> AUTH_FAILED, session closed cleanly', async () => {
  await withK40({ commKey: 4321 }, async (k, port) => {
    const c = client(port, { commKey: 1 });
    await assert.rejects(c.connect(), (e) => e instanceof ZKError && e.code === 'AUTH_FAILED');
    await c.close();
    assert.equal(k.stats.authFailed, 1);
  });
});

test('no comm key configured but device requires one -> AUTH_FAILED', async () => {
  await withK40({ commKey: 999 }, async (k, port) => {
    const c = client(port);
    await assert.rejects(c.connect(), (e) => e.code === 'AUTH_FAILED');
    await c.close();
  });
});

for (const fmt of [8, 16]) {
  test(`fetch ${fmt}-byte format`, async () => {
    await withK40({ format: fmt, userFormat: fmt === 8 ? 72 : 28 }, async (k, port) => {
      k.addUser('1001', 'A');
      k.addUser('1002', 'B');
      k.addPunch('1002', '2026-09-20 09:00:00', 1, 0);
      k.addPunch('1001', '2026-09-20 09:01:00', 1, 0);
      const r = await fetchAll(port);
      assert.equal(r.recordSize, fmt);
      assert.deepEqual(r.punches.map((p) => p.userId), ['1002', '1001']);
    });
  });
}

for (const style of ['ack', 'prepare', 'prepare-push']) {
  test(`data transfer style ${style}: large log spanning several READ_BUFFER chunks`, async () => {
    await withK40({ prepareStyle: style, chunkSize: 1500, splitWrites: false }, async (k, port) => {
      for (let i = 0; i < 3000; i++) {
        const hh = String(8 + Math.floor(i / 3600)).padStart(2, '0');
        const mm = String(Math.floor(i / 60) % 60).padStart(2, '0');
        const ss = String(i % 60).padStart(2, '0');
        k.addPunch(String(1000 + (i % 50)), `2026-09-20 ${hh}:${mm}:${ss}`, 1, i % 2);
      }
      const r = await fetchAll(port, { timeoutMs: 5000 });
      assert.equal(r.punches.length, 3000); // 3000*40 = 120000 > 0xFFC0 -> 2 chunks
      assert.equal(r.punches[2999].userId, String(1000 + (2999 % 50)));
    });
  });
}

test('small payload returned directly as CMD_DATA', async () => {
  await withK40({ directThreshold: 100000 }, async (k, port) => {
    k.addPunch('7', '2026-09-20 10:00:00');
    const r = await fetchAll(port);
    assert.equal(r.punches.length, 1);
  });
});

test('works when device does not report record count (heuristic detection)', async () => {
  await withK40({ recordsInSizes: false, format: 40 }, async (k, port) => {
    k.addPunch('42', '2026-09-20 10:00:00');
    k.addPunch('43', '2026-09-20 10:01:00');
    const r = await fetchAll(port);
    assert.equal(r.recordSize, 40);
    assert.equal(r.punches.length, 2);
  });
});

test('empty log', async () => {
  await withK40({}, async (k, port) => {
    assert.deepEqual((await fetchAll(port)).punches, []);
  });
});

test('device time, name, sizes and users', async () => {
  await withK40({}, async (k, port) => {
    k.addUser('11', 'Alpha');
    const c = client(port);
    try {
      await c.connect();
      const t = await c.getTime();
      assert.ok(t.year >= 2026);
      assert.equal(await c.getOption('~DeviceName'), 'K40 (fake)');
      assert.equal((await c.getFreeSizes()).users, 1);
      assert.equal((await c.getUsers())[0].name, 'Alpha');
    } finally {
      await c.close();
    }
  });
});

test('close() always re-enables a disabled device and ends the session', async () => {
  await withK40({}, async (k, port) => {
    const c = client(port);
    await c.connect();
    await c.disableDevice();
    assert.equal(k.disabled, true);
    await c.close();
    assert.equal(k.disabled, false);
    assert.ok(k.stats.enableCalls >= 1);
  });
});

test('timeouts: silent device -> TIMEOUT; refusing device -> error; nothing hangs', async () => {
  await withK40({}, async (k, port) => {
    k.mode = 'silent';
    const c = client(port, { timeoutMs: 300 });
    const t0 = Date.now();
    await assert.rejects(c.connect(), (e) => e.code === 'TIMEOUT');
    assert.ok(Date.now() - t0 < 2000);
    await c.close();
    k.mode = 'refuse';
    const c2 = client(port, { timeoutMs: 300 });
    await assert.rejects(c2.connect(), (e) => e instanceof ZKError);
    await c2.close();
  });
  const c3 = client(1, { connectTimeoutMs: 500 }); // closed port
  await assert.rejects(c3.connect(), (e) => e.code === 'CONNECT_FAILED');
  await c3.close();
});

test('CLEAR_ATTLOG only when explicitly called', async () => {
  await withK40({}, async (k, port) => {
    k.addPunch('1', '2026-09-20 10:00:00');
    const c = client(port);
    try {
      await c.connect();
      await c.clearAttendance();
    } finally {
      await c.close();
    }
    assert.equal(k.stats.clearCalls, 1);
    assert.equal(k.punches.length, 0);
  });
});
