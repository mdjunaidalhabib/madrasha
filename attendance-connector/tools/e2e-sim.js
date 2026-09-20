#!/usr/bin/env node
'use strict';
/**
 * End-to-end simulation (no hardware, no real cloud):
 *   fake K40 (comm key + 40-byte records) -> Connector -> fake cloud
 * Scenario: normal sync -> cloud goes down while punches keep arriving -> connector restarts (PC reboot) while
 * still offline -> cloud returns (first reply is lost on purpose) -> verify everything arrived exactly once.
 *
 * Run: npm run e2e     (needs `npm run build` first; the npm script does it)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FakeK40 } = require('./fake-k40');
const { FakeCloud } = require('./fake-cloud');
const { buildConfig } = require('../dist/config');
const { Logger } = require('../dist/logger');
const { Connector } = require('../dist/connector');

const t0 = Date.now();
const say = (m) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms, what) {
  const s = Date.now();
  while (!(await fn())) {
    if (Date.now() - s > ms) throw new Error(`timeout waiting for: ${what}`);
    await sleep(30);
  }
}

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  say(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
};

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-e2e-'));
  const COMM_KEY = 4321;
  const k40 = new FakeK40({ commKey: COMM_KEY, format: 40, chunkSize: 512 });
  ['1001', '1002', '1003', '1004', '1005'].forEach((id) => k40.addUser(id, 'Student ' + id));
  const k40Port = await k40.start();
  const cloud = new FakeCloud({ port: k40Port, commPassword: String(COMM_KEY), rejectUserIds: [] });
  await cloud.start();
  say(`fake K40 on 127.0.0.1:${k40Port} (comm key ${COMM_KEY}, 40-byte records); fake cloud on ${cloud.url}`);

  const cfg = buildConfig(
    {
      apiBaseUrl: cloud.url,
      allowInsecureHttp: true,
      madrasaSlug: cloud.slug,
      institutionId: cloud.institutionId,
      deviceId: cloud.deviceId,
      localQueuePath: path.join(dir, 'data'),
      logDir: path.join(dir, 'logs'),
      logLevel: 'info',
      pollIntervalSec: 0.3,
      preferCloudSettings: false,
      batchSize: 4, // small so multi-batch draining is visible
      retry: { baseSec: 0.2, maxSec: 1, jitter: 0.1 },
      httpTimeoutMs: 2000,
      connectTimeoutMs: 1000,
      commandTimeoutMs: 2000,
    },
    dir,
    cloud.deviceKey,
    'env',
  );
  const log = new Logger({ dir: cfg.logDir, level: 'info', console: false });
  const mk = () => new Connector(cfg, log, { protectCache: false });

  let seq = 0;
  const punch = (user) => {
    seq++;
    const mm = String(Math.floor(seq / 60)).padStart(2, '0');
    const ss = String(seq % 60).padStart(2, '0');
    k40.addPunch(user, `2026-09-20 08:${mm}:${ss}`, seq % 3 === 0 ? 15 : 1, seq % 2);
  };

  // ---- phase 1: normal operation
  say('PHASE 1: normal operation, 5 punches on the K40');
  let conn = mk();
  await conn.start();
  ['1001', '1002', '1003', '1004', '1005'].forEach(punch);
  await waitFor(() => cloud.events.size === 5, 8000, 'phase 1 events at cloud');
  say(`cloud has ${cloud.events.size}/5 events; queue ${JSON.stringify(conn.queue.counts())}`);
  check('phase 1: 5 punches synced', cloud.events.size === 5);

  // ---- phase 2: cloud goes down, punches keep coming
  say('PHASE 2: CLOUD DOWN (internet outage). K40 keeps receiving punches');
  cloud.setMode('down');
  ['1001', '1002', '1003'].forEach(punch);
  await waitFor(() => conn.queue.counts().pending === 3, 6000, '3 pending');
  say(`queue while offline: ${JSON.stringify(conn.queue.counts())}`);
  ['1004', '1005', '1001', '1002', '1003'].forEach(punch);
  await waitFor(() => conn.queue.counts().pending === 8, 6000, '8 pending');
  say(`queue while offline: ${JSON.stringify(conn.queue.counts())}  (cloud still has ${cloud.events.size})`);
  check('phase 2: queue grows while cloud is down', conn.queue.counts().pending === 8 && cloud.events.size === 5);
  check('phase 2: K40 fetching continued while offline', conn.stats.cycles >= 3);

  // ---- phase 3: connector restart while still offline
  say('PHASE 3: connector process restarts (PC reboot) while cloud is still down');
  await conn.stop();
  ['1002', '1003'].forEach(punch); // punched while the connector was not running
  conn = mk();
  await conn.start();
  const afterRestart = conn.queue.counts();
  say(`after restart, queue on disk: ${JSON.stringify(afterRestart)}`);
  check('phase 3: pending events survived restart', afterRestart.pending + afterRestart.syncing === 8);
  await waitFor(() => conn.queue.counts().pending === 10, 6000, 'missed punches fetched after restart');
  check('phase 3: punches made during downtime fetched from K40 log after restart', conn.queue.counts().pending === 10);

  // ---- phase 4: cloud returns; first reply is lost
  say('PHASE 4: CLOUD BACK. The first ingest reply is deliberately lost (cloud stores, connector never hears)');
  cloud.dropNextResponses(1);
  cloud.setMode('up');
  await waitFor(() => conn.queue.counts().synced >= 10 && conn.queue.counts().pending === 0, 10000, 'all synced');
  const total = k40.punches.length;
  const ids = cloud.acceptedEvents.map((e) => e.event_id);
  say(`K40 holds ${total} punches; cloud stored ${cloud.events.size}; cloud saw ${cloud.received.length} event copies in ${cloud.stats.ingestCalls} ingest calls`);
  check('phase 4: every punch reached the cloud', cloud.events.size === total, `${cloud.events.size}/${total}`);
  check('phase 4: exactly once (unique event ids, no duplicates stored)', new Set(ids).size === ids.length && ids.length === total);
  check('phase 4: lost reply produced a resend that the cloud de-duplicated', cloud.stats.duplicates >= 1, `duplicates seen=${cloud.stats.duplicates}`);
  check('queue drained', conn.queue.counts().pending === 0 && conn.queue.counts().failed === 0);

  // ---- phase 5: cloud-requested connection test
  say('PHASE 5: admin presses "Test connection" in the panel');
  cloud.testRequested = true;
  await waitFor(() => cloud.heartbeats.some((h) => h.test_result), 6000, 'test_result heartbeat');
  const tr = cloud.heartbeats.find((h) => h.test_result).test_result;
  say(`heartbeat test_result: ${JSON.stringify(tr)}`);
  check('phase 5: connection test reported', tr.ok === true);

  // ---- phase 6: no re-fetch duplicates
  const calls = cloud.stats.ingestCalls;
  const cyc = conn.stats.cycles;
  await waitFor(() => conn.stats.cycles >= cyc + 3, 5000, '3 idle cycles');
  check('idle cycles re-read the whole device log but send nothing new', cloud.stats.ingestCalls === calls && cloud.events.size === total);
  check('device log never cleared', k40.stats.clearCalls === 0 && k40.punches.length === total);
  check('device re-enabled after every session', k40.disabled === false && k40.stats.checksumErrors === 0);

  await conn.stop();

  // ---- report
  const hbOnline = cloud.heartbeats.filter((h) => h.device_status === 'online').length;
  const hbOffline = cloud.heartbeats.filter((h) => h.device_status === 'offline').length;
  console.log('\n================ E2E REPORT ================');
  console.log(`punches on K40                : ${total}`);
  console.log(`events stored at cloud        : ${cloud.events.size}`);
  console.log(`event copies received (all)   : ${cloud.received.length}   (cloud de-duplicated ${cloud.stats.duplicates})`);
  console.log(`ingest calls / batch sizes    : ${cloud.stats.ingestCalls} / [${cloud.ingestBatches.join(',')}]`);
  console.log(`refused connections (outage)  : ${cloud.stats.refused}`);
  console.log(`heartbeats received           : ${cloud.stats.heartbeatCalls} (online ${hbOnline}, offline ${hbOffline})`);
  console.log(`K40 sessions / auth ok        : ${k40.stats.connections} / ${k40.stats.authOk}`);
  console.log(`K40 checksum errors           : ${k40.stats.checksumErrors}`);
  console.log(`K40 CLEAR_ATTLOG calls        : ${k40.stats.clearCalls}`);
  console.log('checks:');
  for (const c of checks) console.log(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.name}${c.detail ? ' - ' + c.detail : ''}`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed ? `\nRESULT: ${failed} CHECK(S) FAILED` : `\nRESULT: ALL ${checks.length} CHECKS PASSED`);

  await k40.stop();
  await cloud.stop();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E ERROR:', e);
  process.exit(2);
});
