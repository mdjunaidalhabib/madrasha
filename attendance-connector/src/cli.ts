#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { defaultConfigPath, loadConfig, validateApiBaseUrl, type AppConfig } from './config';
import { Connector, deviceDriftSec, friendlyDeviceError, punchesToEvents, readDevicePunches, testDevice } from './connector';
import { CONNECTOR_VERSION } from './cloud';
import { Logger, registerSecret } from './logger';
import { EventQueue, QueueLockedError } from './queue';
import { dpapiAvailable, writeProtectedFile, type ProtectScope } from './secret';
import { zkTimeToText } from './protocol';

const HELP = `attendance-connector ${CONNECTOR_VERSION}  (K40 -> local queue -> HTTPS cloud)

Usage: connector <command> [options]

Commands:
  run                     run the connector (poll K40, sync queue, heartbeat) until stopped
  setup [--user-scope]    interactive setup; stores the device key protected with Windows DPAPI
  test-device             connect to the K40, print device time / user count / record count
  fetch-once [--dry-run]  read punches once; --dry-run prints them without touching the queue
  status                  queue counts (pending/syncing/synced/failed), last sync, last K40 contact
  retry-failed            move 'failed' events back to 'pending' (stop the service first)
  version | help

Options:
  --config <file>         config file (default: env CONNECTOR_CONFIG or ./config.json)
`;

function makeLogger(cfg: AppConfig | undefined, quietFile = false): Logger {
  return new Logger({
    dir: quietFile || !cfg ? undefined : cfg.logDir,
    level: quietFile ? 'warn' : (cfg?.logLevel ?? 'info'),
    maxSizeBytes: (cfg?.logMaxSizeMB ?? 5) * 1024 * 1024,
    keep: cfg?.logKeep ?? 5,
    console: true,
  });
}

/* ------------------------------------------------------------- prompting */

type LineIter = AsyncIterator<string>;

/** line-buffered prompt (also works when answers are piped on stdin) */
async function ask(it: LineIter, q: string, def?: string): Promise<string> {
  process.stdout.write(def ? `${q} [${def}]: ` : `${q}: `);
  const r = await it.next();
  const v = r.done ? '' : String(r.value).trim();
  if (!process.stdin.isTTY) process.stdout.write('\n');
  return v || def || '';
}

function askHidden(q: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`${q}: `);
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin });
      rl.once('line', (l) => {
        rl.close();
        resolve(l.trim());
      });
      return;
    }
    let buf = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(buf.trim());
        }
        if (c === '\u0003') process.exit(130);
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function cmdSetup(cfgPath: string, args: string[]): Promise<number> {
  const scope: ProtectScope = args.includes('--user-scope') ? 'user' : 'machine';
  let existing: Record<string, any> = {};
  if (fs.existsSync(cfgPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch {
      /* ignore */
    }
  }
  console.log(`Connector setup -> ${cfgPath}\n(press Enter to keep the value in brackets)\n`);
  const rl = readline.createInterface({ input: process.stdin });
  const it: LineIter = rl[Symbol.asyncIterator]();
  const apiBaseUrl = await ask(it, 'API base URL (https://...)', existing.apiBaseUrl);
  const madrasaSlug = await ask(it, 'Madrasa slug (X-Madrasa-Slug)', existing.madrasaSlug);
  const institutionId = await ask(it, 'Institution ID (number)', existing.institutionId ? String(existing.institutionId) : undefined);
  const deviceId = await ask(it, 'Device ID / code (from admin panel)', existing.deviceId);
  const useLocal = (await ask(it, 'Override K40 IP/port/comm key locally instead of using cloud values? (y/N)', existing.device ? 'y' : 'n')).toLowerCase().startsWith('y');
  let device: Record<string, unknown> | undefined;
  if (useLocal) {
    const ip = await ask(it, 'K40 IP address', existing.device?.ip);
    const port = await ask(it, 'K40 port', String(existing.device?.port ?? 4370));
    const ck = await ask(it, 'K40 comm key (0 = none)', String(existing.device?.commKey ?? 0));
    device = { ip, port: Number(port), commKey: Number(ck) };
  }
  rl.close();
  try {
    validateApiBaseUrl(apiBaseUrl, existing.allowInsecureHttp === true);
    if (!madrasaSlug || !deviceId || !(Number(institutionId) > 0)) throw new Error('slug, institution id and device id are required');
  } catch (e) {
    console.error(`Setup aborted: ${(e as Error).message}`);
    return 1;
  }
  const key = process.env.DEVICE_KEY || (await askHidden('Device key (input hidden; or set env DEVICE_KEY to skip this prompt)'));
  if (!key) {
    console.error('Device key is empty - aborted.');
    return 1;
  }
  registerSecret(key);
  const cfg: Record<string, unknown> = {
    apiBaseUrl,
    madrasaSlug,
    institutionId: Number(institutionId),
    deviceId,
    localQueuePath: existing.localQueuePath ?? './data',
    logDir: existing.logDir ?? './logs',
    pollIntervalSec: existing.pollIntervalSec ?? 30,
    batchSize: existing.batchSize ?? 200,
    deviceTimezoneOffset: existing.deviceTimezoneOffset ?? '+06:00',
    ...(existing.allowInsecureHttp === true ? { allowInsecureHttp: true } : {}),
    ...(device ? { device } : {}),
  };
  const dir = path.dirname(cfgPath);
  if (dpapiAvailable()) {
    const keyFile = path.join(dir, 'secrets', 'device.key');
    await writeProtectedFile(keyFile, key, scope);
    cfg.deviceKeyFile = './secrets/device.key';
    console.log(`\nDevice key stored protected with Windows DPAPI (${scope === 'machine' ? 'LocalMachine: works for SYSTEM service on this PC' : 'CurrentUser: run the service as THIS user'}): ${keyFile}`);
  } else {
    console.log('\nWindows DPAPI not available on this OS. The key is NOT written to disk; set the DEVICE_KEY environment variable when running.');
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  console.log(`Config written: ${cfgPath}`);
  try {
    await loadConfig(cfgPath, { requireKey: false });
  } catch (e) {
    console.error(`config validation problem: ${(e as Error).message}`);
    return 1;
  }
  console.log('Next: "connector test-device", then install the service (install-service.ps1).');
  return 0;
}

/* --------------------------------------------------------------- commands */

async function cmdRun(cfg: AppConfig): Promise<number> {
  const log = makeLogger(cfg);
  const conn = new Connector(cfg, log);
  let stopping = false;
  const shutdown = (sig: string) => {
    if (stopping) return;
    stopping = true;
    log.info(`received ${sig}`);
    void conn.stop().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 30_000).unref(); // hard limit if a socket hangs
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGBREAK', () => shutdown('SIGBREAK'));
  process.on('unhandledRejection', (r) => log.error(`unhandledRejection (continuing): ${(r as Error)?.stack ?? r}`));
  process.on('uncaughtException', (e) => {
    log.error(`uncaughtException: ${e.stack ?? e}`);
    process.exit(1); // wrapper (run.cmd / Task Scheduler) restarts us
  });
  log.info(`config: ${cfg.apiBaseUrl} slug=${cfg.madrasaSlug} institution=${cfg.institutionId} device=${cfg.deviceId} keySource=${cfg.deviceKeySource}`);
  try {
    await conn.start();
  } catch (e) {
    log.error(`cannot start: ${(e as Error).message}`);
    return e instanceof QueueLockedError ? 3 : 1;
  }
  await conn.waitUntilStopped();
  return 0;
}

async function cmdTestDevice(cfg: AppConfig): Promise<number> {
  const log = makeLogger(cfg, true);
  const conn = new Connector(cfg, log, { queue: undefined });
  const s = await conn.resolveSettings();
  if (!s) {
    console.error('No K40 IP known: set "device.ip" in config.json or make the cloud config available.');
    return 1;
  }
  console.log(`Connecting to K40 ${s.ip}:${s.port} (comm key ${s.commKey ? 'set' : 'none'}, settings from ${s.source}) ...`);
  try {
    const r = await testDevice(cfg, s, log);
    console.log('OK');
    console.log(`  device time : ${zkTimeToText(r.time)}  (PC drift ${deviceDriftSec(r.time, cfg.deviceTimezoneOffset)}s)`);
    if (r.name) console.log(`  model       : ${r.name}`);
    if (r.users !== undefined) console.log(`  users       : ${r.users}`);
    if (r.records !== undefined) console.log(`  punch logs  : ${r.records}`);
    return 0;
  } catch (e) {
    console.error(`FAILED: ${friendlyDeviceError(e)}`);
    return 2;
  }
}

async function cmdFetchOnce(cfg: AppConfig, args: string[]): Promise<number> {
  const dry = args.includes('--dry-run');
  const log = makeLogger(cfg, true);
  const conn = new Connector(cfg, log);
  const s = await conn.resolveSettings();
  if (!s) {
    console.error('No K40 IP known: set "device.ip" in config.json or make the cloud config available.');
    return 1;
  }
  try {
    const r = await readDevicePunches(cfg, s, log);
    const events = punchesToEvents(r.punches, cfg);
    console.log(`${events.length} record(s), ${r.recordSize}-byte format${r.truncated ? ' (TRUNCATED)' : ''}`);
    for (const e of events.slice(-50)) {
      console.log(`  ${e.timestamp}  user=${e.deviceUserId}  verify=${e.verifyType}  inout=${e.inOutState}  id=${e.id}`);
    }
    if (events.length > 50) console.log(`  ... (showing last 50 of ${events.length})`);
    if (dry) {
      console.log('dry-run: nothing queued.');
      return 0;
    }
    const q = EventQueue.open(cfg.localQueuePath);
    try {
      const added = q.enqueue(events);
      console.log(`queued ${added.length} new event(s) (${events.length - added.length} already known).`);
    } finally {
      q.close();
    }
    return 0;
  } catch (e) {
    console.error(`FAILED: ${friendlyDeviceError(e)}`);
    return 2;
  }
}

function cmdStatus(cfg: AppConfig): number {
  if (!fs.existsSync(cfg.localQueuePath)) {
    console.log(`No queue yet at ${cfg.localQueuePath}`);
    return 0;
  }
  const q = EventQueue.open(cfg.localQueuePath, { readOnly: true });
  const c = q.counts();
  const m = q.getMeta();
  let running = 'no';
  try {
    const pid = Number(fs.readFileSync(q.lockFile, 'utf8').split(':')[0]);
    process.kill(pid, 0);
    running = `yes (pid ${pid})`;
  } catch {
    /* not running */
  }
  console.log(`Connector ${CONNECTOR_VERSION}   service running: ${running}`);
  console.log(`Queue (${cfg.localQueuePath})`);
  console.log(`  pending : ${c.pending}`);
  console.log(`  syncing : ${c.syncing}`);
  console.log(`  synced  : ${c.synced}   (+ ${c.dedupeIndex} ids in dedupe index)`);
  console.log(`  failed  : ${c.failed}`);
  console.log(`Last successful sync  : ${m.lastSyncAt ?? 'never'}${m.lastSyncError ? `   last sync error: ${m.lastSyncError}` : ''}`);
  console.log(`Last K40 contact      : ${m.lastDeviceContactAt ?? 'never'}   (device ${m.deviceOnline ? 'ONLINE' : 'offline'}${m.lastDeviceError ? `: ${m.lastDeviceError}` : ''})`);
  console.log(`Last fetched punch    : ${m.lastFetchedTimestamp ?? 'none'}`);
  const failed = q.list('failed');
  if (failed.length) {
    console.log(`Failed events (first 10 of ${failed.length}):`);
    for (const e of failed.slice(0, 10)) console.log(`  ${e.timestamp} user=${e.deviceUserId} id=${e.id} :: ${e.lastError}`);
  }
  q.close();
  return 0;
}

function cmdRetryFailed(cfg: AppConfig): number {
  try {
    const q = EventQueue.open(cfg.localQueuePath);
    const n = q.retryFailed();
    q.close();
    console.log(`${n} failed event(s) moved back to pending.`);
    return 0;
  } catch (e) {
    if (e instanceof QueueLockedError) {
      console.error(`${e.message}. Stop the connector service first (schtasks /End /TN AttendanceConnector), then retry.`);
      return 3;
    }
    throw e;
  }
}

/* ------------------------------------------------------------------- main */

async function main(argv: string[]): Promise<number> {
  const args = [...argv];
  const ci = args.indexOf('--config');
  if (ci !== -1) {
    process.env.CONNECTOR_CONFIG = path.resolve(args[ci + 1] ?? '');
    args.splice(ci, 2);
  }
  const cmd = args.shift() ?? 'help';
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return 0;
  }
  if (cmd === 'version' || cmd === '--version') {
    console.log(CONNECTOR_VERSION);
    return 0;
  }
  const cfgPath = defaultConfigPath();
  if (cmd === 'setup') return cmdSetup(cfgPath, args);
  let cfg: AppConfig;
  try {
    cfg = await loadConfig(cfgPath, { requireKey: !['status', 'retry-failed'].includes(cmd) });
  } catch (e) {
    console.error(`Config error: ${(e as Error).message}`);
    return 1;
  }
  registerSecret(cfg.deviceKey);
  switch (cmd) {
    case 'run':
      return cmdRun(cfg);
    case 'test-device':
      return cmdTestDevice(cfg);
    case 'fetch-once':
      return cmdFetchOnce(cfg, args);
    case 'status':
      return cmdStatus(cfg);
    case 'retry-failed':
      return cmdRetryFailed(cfg);
    default:
      console.error(`Unknown command: ${cmd}\n\n${HELP}`);
      return 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      // 'run' exits via shutdown handler; others exit here
      if (code !== 0 || process.argv[2] !== 'run') process.exit(code);
    },
    (e) => {
      console.error(`Fatal: ${(e as Error).message}`);
      process.exit(1);
    },
  );
}

export { main };
