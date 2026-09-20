'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventQueue, QueueLockedError, makeEventId } = require('../dist/queue');
const { tmpDir } = require('./helpers');

const ev = (n, extra = {}) => ({
  id: makeEventId('DEV', String(1000 + n), `2026-09-20T08:${String(n % 60).padStart(2, '0')}:00+06:00`, 1, 0),
  deviceUserId: String(1000 + n),
  timestamp: `2026-09-20T08:${String(n % 60).padStart(2, '0')}:00+06:00`,
  verifyType: 1,
  inOutState: 0,
  ...extra,
});

test('event id is deterministic and sensitive to every field', () => {
  const a = makeEventId('D', '1', '2026-09-20T08:00:00+06:00', 1, 0);
  assert.equal(a, makeEventId('D', '1', '2026-09-20T08:00:00+06:00', 1, 0));
  assert.match(a, /^[0-9a-f]{32}$/);
  for (const b of [
    makeEventId('E', '1', '2026-09-20T08:00:00+06:00', 1, 0),
    makeEventId('D', '2', '2026-09-20T08:00:00+06:00', 1, 0),
    makeEventId('D', '1', '2026-09-20T08:00:01+06:00', 1, 0),
    makeEventId('D', '1', '2026-09-20T08:00:00+06:00', 15, 0),
    makeEventId('D', '1', '2026-09-20T08:00:00+06:00', 1, 1),
  ]) assert.notEqual(a, b);
});

test('pending events survive close/reopen (restart)', () => {
  const dir = tmpDir();
  let q = EventQueue.open(dir);
  q.enqueue([ev(1), ev(2), ev(3)]);
  q.markSyncing([ev(1).id]);
  q.markSynced([ev(1).id]);
  q.close();
  q = EventQueue.open(dir);
  assert.deepEqual({ ...q.counts() }, { pending: 2, syncing: 0, synced: 1, failed: 0, dedupeIndex: 0 });
  assert.equal(q.peekPending(10)[0].id, ev(2).id);
  q.close();
});

test('crash mid-write: truncated last line is ignored, log repaired, no data glued together', () => {
  const dir = tmpDir();
  let q = EventQueue.open(dir);
  q.enqueue([ev(1), ev(2), ev(3)]);
  const file = q.logFile;
  // simulate crash while the OS was writing the last line: no close(), cut the file mid-line
  const size = fs.statSync(file).size;
  fs.truncateSync(file, size - 25);
  q.close();
  q = EventQueue.open(dir);
  assert.equal(q.loadInfo.corruptLines + (q.loadInfo.incompleteTail ? 1 : 0) > 0, true);
  assert.equal(q.counts().pending, 2, 'two intact events kept, torn third dropped');
  // the device re-read brings the lost event back exactly once
  const added = q.enqueue([ev(1), ev(2), ev(3)]);
  assert.equal(added.length, 1);
  q.close();
  q = EventQueue.open(dir);
  assert.equal(q.counts().pending, 3);
  assert.equal(q.loadInfo.corruptLines, 0, 'repair rewrote a clean log');
  q.close();
});

test('garbage in the middle of the log is skipped, valid lines around it survive', () => {
  const dir = tmpDir();
  let q = EventQueue.open(dir);
  q.enqueue([ev(1)]);
  q.close();
  fs.appendFileSync(path.join(dir, 'queue.jsonl'), '{"op":"put","e":{"id":\n');
  q = EventQueue.open(dir);
  q.enqueue([ev(2)]);
  q.close();
  q = EventQueue.open(dir);
  assert.equal(q.counts().pending, 2);
  q.close();
});

test("'syncing' left by a crash reverts to pending at startup", () => {
  const dir = tmpDir();
  let q = EventQueue.open(dir);
  q.enqueue([ev(1), ev(2)]);
  q.markSyncing([ev(1).id, ev(2).id]);
  assert.equal(q.counts().syncing, 2);
  q.close(); // "crash": no reply ever recorded
  q = EventQueue.open(dir);
  assert.equal(q.loadInfo.recoveredSyncing, 2);
  assert.equal(q.counts().pending, 2);
  assert.equal(q.counts().syncing, 0);
  q.close();
  q = EventQueue.open(dir); // and the revert itself is durable
  assert.equal(q.counts().pending, 2);
  q.close();
});

test('synced entries are pruned after N days but ids stay in the dedupe index', () => {
  const dir = tmpDir();
  let q = EventQueue.open(dir);
  q.enqueue([ev(1), ev(2)]);
  q.markSynced([ev(1).id]);
  const future = Date.now() + 8 * 86400000;
  const r = q.prune(7, 400, future);
  assert.equal(r.pruned, 1);
  assert.equal(q.counts().synced, 0);
  assert.equal(q.counts().dedupeIndex, 1);
  assert.equal(q.has(ev(1).id), true);
  assert.equal(q.enqueue([ev(1)]).length, 0, 'pruned id is not re-enqueued');
  q.compact();
  q.close();
  q = EventQueue.open(dir);
  assert.equal(q.enqueue([ev(1)]).length, 0, 'dedupe index survives restart + compaction');
  assert.equal(q.counts().pending, 1);
  q.close();
});

test('recent synced entries are not pruned; failed entries are kept and can be retried', () => {
  const dir = tmpDir();
  const q = EventQueue.open(dir);
  q.enqueue([ev(1), ev(2)]);
  q.markSynced([ev(1).id]);
  q.markFailed(ev(2).id, 'rejected: unknown user');
  assert.equal(q.prune(7, 400).pruned, 0);
  assert.equal(q.counts().failed, 1);
  assert.equal(q.get(ev(2).id).lastError, 'rejected: unknown user');
  assert.equal(q.retryFailed(), 1);
  assert.equal(q.counts().pending, 1);
  q.close();
});

test('release() increments attempts and keeps the error', () => {
  const dir = tmpDir();
  const q = EventQueue.open(dir);
  q.enqueue([ev(1)]);
  q.markSyncing([ev(1).id]);
  q.release([ev(1).id], 'HTTP 503');
  const e = q.get(ev(1).id);
  assert.equal(e.state, 'pending');
  assert.equal(e.attempts, 1);
  assert.equal(e.lastError, 'HTTP 503');
  q.close();
});

test('compaction shrinks the log and preserves state', () => {
  const dir = tmpDir();
  const q = EventQueue.open(dir, { compactSlack: 1000000 });
  q.enqueue([ev(1)]);
  for (let i = 0; i < 200; i++) {
    q.markSyncing([ev(1).id]);
    q.release([ev(1).id], 'x');
  }
  const before = fs.statSync(q.logFile).size;
  q.compact();
  assert.ok(fs.statSync(q.logFile).size < before / 10);
  assert.equal(q.get(ev(1).id).attempts, 200);
  q.close();
  const q2 = EventQueue.open(dir);
  assert.equal(q2.get(ev(1).id).attempts, 200);
  q2.close();
});

test('exclusive lock: second opener is refused, stale lock is reclaimed', () => {
  const dir = tmpDir();
  const q = EventQueue.open(dir);
  assert.throws(() => EventQueue.open(dir), QueueLockedError);
  const ro = EventQueue.open(dir, { readOnly: true }); // read-only status never needs the lock
  assert.equal(ro.counts().pending, 0);
  q.close();
  fs.writeFileSync(path.join(dir, 'queue.lock'), '999999999'); // dead pid
  const q2 = EventQueue.open(dir);
  q2.close();
});

test('state.json meta roundtrip and corrupt meta tolerated', () => {
  const dir = tmpDir();
  let q = EventQueue.open(dir);
  q.setMeta({ lastSyncAt: 'x', deviceOnline: true });
  q.close();
  q = EventQueue.open(dir);
  assert.equal(q.getMeta().lastSyncAt, 'x');
  q.close();
  fs.writeFileSync(path.join(dir, 'state.json'), '{bad');
  q = EventQueue.open(dir);
  assert.deepEqual(q.getMeta(), {});
  q.close();
});

test('hard kill (SIGKILL/TerminateProcess) mid-append: every acknowledged event is still there after restart', async () => {
  const { spawn } = require('node:child_process');
  const dir = tmpDir();
  const script = `
    const { EventQueue } = require(${JSON.stringify(path.join(__dirname, '..', 'dist', 'queue.js'))});
    const q = EventQueue.open(${JSON.stringify(dir)}, { lock: false });
    let n = 0;
    setInterval(() => {}, 1000);
    (function loop() {
      for (let i = 0; i < 20; i++) {
        n++;
        q.enqueue([{ id: 'e' + n, deviceUserId: String(n), timestamp: '2026-09-20T08:00:00+06:00' }]);
        if (n % 7 === 0) { q.markSyncing(['e' + n]); }
        process.stdout.write('ack ' + n + '\\n');
      }
      setImmediate(loop);
    })();
  `;
  const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
  let acked = 0;
  child.stdout.on('data', (d) => {
    for (const m of d.toString().matchAll(/ack (\d+)/g)) acked = Math.max(acked, Number(m[1]));
  });
  await new Promise((r) => setTimeout(r, 700));
  child.kill('SIGKILL');
  await new Promise((r) => child.on('exit', r));
  assert.ok(acked > 20, `child made progress (acked=${acked})`);
  const q = EventQueue.open(dir);
  const c = q.counts();
  assert.ok(c.pending + c.syncing + c.synced >= acked, `no acknowledged event lost: ${JSON.stringify(c)} acked=${acked}`);
  assert.equal(c.syncing, 0, 'in-flight states reverted to pending');
  q.close();
});
