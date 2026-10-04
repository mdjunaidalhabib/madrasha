'use strict';
// v1.1: user record encoding, realtime events, user sync planning (pure + on the fake K40).
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../dist/protocol');
const DU = require('../dist/device-users');
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
const client = (port, extra = {}) => new P.ZKClient({ host: '127.0.0.1', port, connectTimeoutMs: 800, timeoutMs: 1500, ...extra });

test('encodeUserRecord: 72-byte layout matches pyzk <HB8s24s4sx7sx24s', () => {
  const b = P.encodeUserRecord({ uid: 0x0102, userId: '10001', name: 'Karim Uddin', privilege: 14, password: 'pw', card: 0x01020304, groupId: '1' }, 72);
  assert.equal(b.length, 72);
  assert.equal(b.readUInt16LE(0), 0x0102);
  assert.equal(b[2], 14);
  assert.equal(b.subarray(3, 5).toString(), 'pw');
  assert.equal(b.subarray(11, 22).toString(), 'Karim Uddin');
  assert.equal(b[22], 0);
  assert.equal(b.readUInt32LE(35), 0x01020304);
  assert.equal(b[39], 0, 'pad byte');
  assert.equal(b.subarray(40, 41).toString(), '1');
  assert.equal(b[47], 0, 'pad byte');
  assert.equal(b.subarray(48, 53).toString(), '10001');
  const raw = Buffer.concat([Buffer.from([72, 0, 0, 0]), b]);
  const [u] = P.parseUsers(raw, 1);
  assert.deepEqual(
    { uid: u.uid, userId: u.userId, name: u.name, privilege: u.privilege, card: u.card, password: u.password, groupId: u.groupId },
    { uid: 0x0102, userId: '10001', name: 'Karim Uddin', privilege: 14, card: 0x01020304, password: 'pw', groupId: '1' },
  );
});

test('encodeUserRecord: 28-byte layout matches pyzk <HB5s8sIxBHI (numeric user id)', () => {
  const b = P.encodeUserRecord({ uid: 7, userId: '10002', name: 'LongerThan8', card: 4000000000, groupId: '3' }, 28);
  assert.equal(b.length, 28);
  assert.equal(b.readUInt16LE(0), 7);
  assert.equal(b.subarray(8, 16).toString(), 'LongerTh', 'name truncated to 8 bytes');
  assert.equal(b.readUInt32LE(16), 4000000000);
  assert.equal(b[20], 0);
  assert.equal(b[21], 3);
  assert.equal(b.readUInt16LE(22), 0);
  assert.equal(b.readUInt32LE(24), 10002);
  const [u] = P.parseUsers(Buffer.concat([Buffer.from([28, 0, 0, 0]), b]), 1);
  assert.equal(u.userId, '10002');
  assert.equal(u.card, 4000000000);
  assert.throws(() => P.encodeUserRecord({ uid: 1, userId: 'AB12', name: 'x' }, 28), /numeric user id/);
  assert.throws(() => P.encodeUserRecord({ uid: 1, userId: '1', name: 'x', card: 2 ** 32 }, 72), /u32/);
  assert.throws(() => P.encodeUserRecord({ uid: 0, userId: '1', name: 'x' }, 72), /uid/);
  assert.equal(P.deviceStoredName('Abdullah Al Mamun', 28), 'Abdullah');
});

test('extractCardFromEvent: u32 LE, ASCII digits, non-card codes', () => {
  const u32 = Buffer.alloc(4);
  u32.writeUInt32LE(3456789);
  assert.equal(P.extractCardFromEvent({ code: 1024, data: u32 }, [1024, 2048]), '3456789');
  assert.equal(P.extractCardFromEvent({ code: 2048, data: Buffer.from('0012345678\0\0') }, [1024, 2048]), '12345678');
  assert.equal(P.extractCardFromEvent({ code: 1, data: u32 }, [1024, 2048]), undefined, 'attendance event is not a card');
  assert.equal(P.extractCardFromEvent({ code: 1024, data: Buffer.alloc(4) }, [1024]), undefined, 'card 0 ignored');
  assert.equal(P.extractCardFromEvent({ code: 1024, data: Buffer.from([1, 2]) }, [1024]), undefined);
});

test('ZKClient setUser / deleteUser / refreshData / setTime against the fake K40 (72 and 28 byte)', async () => {
  for (const uf of [72, 28]) {
    await withK40({ userFormat: uf }, async (k, port) => {
      k.addUser('500', 'Manual');
      const c = client(port);
      try {
        await c.connect();
        const before = await c.getUsers();
        assert.equal(c.userRecordSize, uf, 'record size remembered from the user list');
        await c.setUser({ uid: 2, userId: '10001', name: 'New Kid', card: 99887766 }, uf);
        await c.refreshData();
        let users = await c.getUsers();
        const nu = users.find((u) => u.userId === '10001');
        assert.equal(nu.card, 99887766);
        assert.equal(nu.uid, 2);
        assert.equal(users.length, before.length + 1);
        await c.deleteUser(2);
        await c.refreshData();
        users = await c.getUsers();
        assert.deepEqual(users.map((u) => u.userId), ['500']);
        // wrong layout is refused by a strict device
        await assert.rejects(c.setUser({ uid: 3, userId: '3', name: 'x' }, uf === 72 ? 28 : 72), (e) => e.code === 'DEVICE_ERROR');
        // clock
        await c.setTime({ year: 2030, month: 1, day: 2, hour: 3, minute: 4, second: 5 });
        const t = await c.getTime();
        assert.deepEqual([t.year, t.month, t.day, t.hour, t.minute], [2030, 1, 2, 3, 4]);
      } finally {
        await c.close();
      }
      assert.equal(k.stats.refreshCalls, 2);
      assert.equal(k.stats.setTimeCalls, 1);
      assert.equal(k.stats.checksumErrors, 0);
    });
  }
});

test('REG_EVENT: realtime packets are routed away from command replies and ACKed (pyzk __ack_ok)', async () => {
  await withK40({ replyDelayMs: 60, chunkSize: 16 }, async (k, port) => {
    for (let i = 0; i < 20; i++) k.addUser(String(1000 + i), 'U' + i);
    const c = client(port);
    try {
      await c.connect();
      await c.regEvent(P.REG_EVENT_ALL);
      assert.equal(k.eventListeners, 1);
      // fire an event while a multi-packet command reply is in flight
      const pending = c.getUsers();
      setTimeout(() => k.swipeCard(3456789), 20);
      setTimeout(() => k.swipeCard(42), 90);
      const users = await pending;
      assert.equal(users.length, 20, 'command reply intact despite interleaved events');
      const e1 = await c.waitForEvent(1000);
      const e2 = await c.waitForEvent(1000);
      assert.equal(e1.code, 1024);
      assert.equal(P.extractCardFromEvent(e1, [1024]), '3456789');
      assert.equal(P.extractCardFromEvent(e2, [1024]), '42');
      assert.equal(await c.waitForEvent(100), null, 'timeout -> null');
      // the reply counter is undisturbed: further commands still work and checksums verify
      assert.ok((await c.getTime()).year >= 2026);
      await c.regEvent(0);
      assert.equal(k.eventListeners, 0);
    } finally {
      await c.close();
    }
    assert.equal(k.stats.eventAcks, 2);
    assert.equal(k.stats.checksumErrors, 0);
  });
});

test('planUserSync: create / update (keep uid, device card when cloud card null) / delete only managed', () => {
  const dev = [
    { uid: 1, userId: '1', name: 'Manual Admin', privilege: 14, card: 0 },
    { uid: 5, userId: '10001', name: 'Old Name', privilege: 0, card: 777, password: 'x' },
    { uid: 6, userId: '10002', name: 'Same', privilege: 0, card: 0 },
    { uid: 7, userId: '10003', name: 'Gone', privilege: 0, card: 0 },
    { uid: 8, userId: '9999', name: 'Manual Gone', privilege: 0, card: 0 },
  ];
  const desired = [
    { pin: '10001', name: 'New Name', card: null, attendee_type: 'STUDENT' },
    { pin: '10002', name: 'Same', card: '123', attendee_type: 'TEACHER' },
    { pin: '10004', name: 'Brand New', card: null, attendee_type: 'STAFF' },
  ];
  const plan = DU.planUserSync(dev, desired, ['10001', '10003', '10005'], 72);
  assert.deepEqual(plan.create.map((w) => [w.pin, w.card]), [['10004', 0]]);
  assert.deepEqual(plan.update.map((w) => [w.pin, w.uid, w.card, w.reason]), [
    ['10001', 5, 777, 'name differs'],
    ['10002', 6, 123, 'card differs'],
  ]);
  assert.equal(plan.update[0].password, 'x', 'password preserved on rewrite');
  assert.deepEqual(plan.delete.map((d) => d.pin), ['10003'], 'only connector-created users are deleted (never 1 / 9999)');
  assert.deepEqual(plan.forget, ['10005']);
  const alloc = new DU.UidAllocator(dev);
  assert.equal(alloc.take(), 9);
  assert.equal(alloc.take(), 10);
  assert.equal(new DU.UidAllocator([{ uid: 65534 }, { uid: 1 }]).take(), 2, 'wraps to the smallest free uid');
  assert.equal(DU.cardToU32('0004294967295'), 4294967295);
  assert.equal(DU.cardToU32('4294967296'), undefined);
  assert.equal(DU.resolveRecordSize('auto', undefined, undefined), 72);
  assert.equal(DU.resolveRecordSize('auto', 28, 72), 28);
  assert.equal(DU.resolveRecordSize(28, 72, 72), 28);
});

test('AsyncMutex runs sessions one at a time in FIFO order', async () => {
  const m = new DU.AsyncMutex();
  const order = [];
  let active = 0;
  const job = (n, ms) =>
    m.run(async () => {
      active++;
      assert.equal(active, 1);
      order.push(n);
      await new Promise((r) => setTimeout(r, ms));
      active--;
      if (n === 2) throw new Error('boom');
      return n;
    });
  const r = await Promise.allSettled([job(1, 30), job(2, 5), job(3, 1)]);
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(r[1].status, 'rejected');
  assert.equal(r[2].value, 3);
});
