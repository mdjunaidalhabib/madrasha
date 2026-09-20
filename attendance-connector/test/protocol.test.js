'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../dist/protocol');
const { FakeK40, expectedCommKey, checksum: fakeChecksum } = require('../tools/fake-k40');

test('timestamp encode/decode roundtrip and known values', () => {
  assert.deepEqual(P.decodeTime(0), { year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 });
  const t = { year: 2026, month: 9, day: 20, hour: 8, minute: 5, second: 7 };
  const enc = P.encodeTime(t);
  assert.equal(enc, ((26 * 12 + 8) * 31 + 19) * 86400 + (8 * 60 + 5) * 60 + 7);
  assert.deepEqual(P.decodeTime(enc), t);
  for (const x of [
    { year: 2031, month: 12, day: 31, hour: 23, minute: 59, second: 59 },
    { year: 2010, month: 2, day: 28, hour: 0, minute: 0, second: 1 },
  ]) {
    assert.deepEqual(P.decodeTime(P.encodeTime(x)), x);
  }
  assert.equal(P.zkTimeToIso(t, '+06:00'), '2026-09-20T08:05:07+06:00');
});

test('checksum matches the independent implementation in the simulator', () => {
  for (let n = 8; n < 40; n++) {
    const b = Buffer.alloc(n);
    for (let i = 0; i < n; i++) b[i] = (i * 37 + n * 11) & 0xff;
    assert.equal(P.checksum(b), fakeChecksum(b), `len ${n}`);
  }
});

test('makeCommKey: hand-derived vector and agreement with simulator', () => {
  // key 0, session 0, ticks 50: bytes 5a 4b 53 4f -> swap halves 53 4f 5a 4b -> xor ticks(0x32)
  assert.deepEqual([...P.makeCommKey(0, 0)], [0x61, 0x7d, 0x32, 0x79]);
  for (const key of [1, 1234, 999999, 0xffffffff]) {
    for (const s of [1, 500, 65000]) assert.deepEqual(P.makeCommKey(key, s), expectedCommKey(key, s));
  }
});

test('packet framing: header magic, length, fragmentation, coalescing, garbage resync', () => {
  const { packet, nextReplyId } = P.buildPacket(P.CMD.GET_TIME, 77, 65534, Buffer.from([1, 2, 3]));
  assert.equal(nextReplyId, 0); // (65534 + 1) mod 65535
  assert.deepEqual([...packet.subarray(0, 4)], [0x50, 0x50, 0x82, 0x7d]);
  assert.equal(packet.readUInt32LE(4), 8 + 3);
  const r = new P.PacketReader();
  const two = Buffer.concat([Buffer.from([0xde, 0xad]), packet, packet]); // leading garbage
  const got = [];
  for (const b of two) {
    r.push(Buffer.from([b])); // byte by byte
    for (let p = r.pop(); p; p = r.pop()) got.push(p);
  }
  assert.equal(got.length, 2);
  assert.equal(got[0].command, P.CMD.GET_TIME);
  assert.equal(got[0].sessionId, 77);
  assert.deepEqual([...got[0].data], [1, 2, 3]);
});

function attlogFrom(format, punches) {
  const k = new FakeK40({ format });
  for (const p of punches) k.addPunch(p.user, p.time, p.verify, p.inOut);
  return { raw: k._attlogBuffer(), k };
}

const SAMPLE = [
  { user: '1001', time: '2026-09-20 08:01:02', verify: 1, inOut: 0 },
  { user: '1002', time: '2026-09-20 08:05:00', verify: 15, inOut: 1 },
  { user: '1001', time: '2026-09-20 13:30:59', verify: 1, inOut: 1 },
];

test('parse 40-byte records (auto-detected without count hint)', () => {
  const { raw } = attlogFrom(40, SAMPLE);
  const r = P.parseAttendance(raw);
  assert.equal(r.recordSize, 40);
  assert.equal(r.punches.length, 3);
  assert.equal(r.punches[1].userId, '1002');
  assert.equal(r.punches[1].verifyType, 15);
  assert.equal(r.punches[1].inOutState, 1);
  assert.equal(P.zkTimeToIso(r.punches[2].time, '+06:00'), '2026-09-20T13:30:59+06:00');
});

test('parse 8-byte records, resolving uid -> user id through the user list', () => {
  const { raw, k } = attlogFrom(8, SAMPLE);
  const users = P.parseUsers(k._usersBuffer(), 2);
  assert.equal(users.length, 2);
  const uidMap = new Map(users.map((u) => [u.uid, u.userId]));
  const r = P.parseAttendance(raw, { recordsHint: 3, uidMap });
  assert.equal(r.recordSize, 8);
  assert.deepEqual(r.punches.map((p) => p.userId), ['1001', '1002', '1001']);
  // without a user list: falls back to the numeric uid
  assert.deepEqual(P.parseAttendance(raw, { recordsHint: 3 }).punches.map((p) => p.userId), ['1', '2', '1']);
});

test('parse 16-byte records', () => {
  const { raw } = attlogFrom(16, SAMPLE);
  const r = P.parseAttendance(raw, { recordsHint: 3 });
  assert.equal(r.recordSize, 16);
  assert.deepEqual(r.punches.map((p) => p.userId), ['1001', '1002', '1001']);
  assert.equal(r.punches[0].time.hour, 8);
});

test('record size heuristics when count hint is missing or ambiguous (total divisible by 8, 16 and 40)', () => {
  // 2 x 40 = 80 bytes: divisible by 40, 16 and 8 -> plausibility must choose 40
  const two = attlogFrom(40, SAMPLE.slice(0, 2)).raw;
  assert.equal(P.parseAttendance(two).recordSize, 40);
  // 10 x 8 = 80 bytes: also ambiguous -> must choose 8
  const many = Array.from({ length: 10 }, (_, i) => ({ user: '1001', time: `2026-09-20 08:0${i}:00`, verify: 1, inOut: 0 }));
  assert.equal(P.parseAttendance(attlogFrom(8, many).raw).recordSize, 8);
  // wrong hint is ignored
  assert.equal(P.parseAttendance(two, { recordsHint: 7 }).recordSize, 40);
});

test('empty / short buffers and truncation flag', () => {
  assert.deepEqual(P.parseAttendance(Buffer.alloc(0)).punches, []);
  assert.deepEqual(P.parseAttendance(Buffer.from([0, 0, 0, 0])).punches, []);
  const { raw } = attlogFrom(40, SAMPLE);
  const cut = raw.subarray(0, raw.length - 45); // lose a record and a half
  const r = P.parseAttendance(cut, { recordsHint: 3 });
  assert.equal(r.truncated, true);
  assert.equal(r.punches.length, 1);
});

test('parse user lists in 28 and 72 byte layouts', () => {
  for (const uf of [28, 72]) {
    const k = new FakeK40({ userFormat: uf });
    k.addUser('501', 'Karim');
    k.addUser('502', 'Rahim');
    const users = P.parseUsers(k._usersBuffer(), 2);
    assert.deepEqual(users.map((u) => u.userId), ['501', '502']);
    assert.equal(users[0].name, 'Karim');
  }
});
