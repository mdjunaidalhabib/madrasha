#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { defaultConfigPath, loadConfig, validateApiBaseUrl, type AppConfig } from './config';
import {
  Connector,
  deviceDriftSec,
  friendlyDeviceError,
  makeZkClient,
  punchesToEvents,
  readDevicePunches,
  syncDeviceUsers,
  testDevice,
} from './connector';
import { CloudClient, CONNECTOR_VERSION } from './cloud';
import { Logger, registerSecret } from './logger';
import { EventQueue, QueueLockedError } from './queue';
import { dpapiAvailable, writeProtectedFile, type ProtectScope } from './secret';
import { parsePairingToken, type PairingData } from './pairing';
import { extractCardFromEvent, REG_EVENT_ALL, zkTimeToText } from './protocol';
import { deviceLock, loadUserState } from './device-users';

const HELP = `attendance-connector ${CONNECTOR_VERSION}  (K40 -> local queue -> HTTPS cloud)

Usage: connector <command> [options]

Commands:
  run                     run the connector (poll K40, sync queue, heartbeat) until stopped
  setup [--token <CODE>] [--user-scope]
                          setup; stores the device key protected with Windows DPAPI. With --token (or env
                          PAIRING_TOKEN) the pairing code from the admin panel is used: fully non-interactive.
                          Without it, asks for a pairing code first (Enter = type the values manually)
  test-device             connect to the K40, print device time / user count / record count
  fetch-once [--dry-run]  read punches once; --dry-run prints them without touching the queue
  status                  queue counts (pending/syncing/synced/failed), last sync, last K40 contact
  retry-failed            move 'failed' events back to 'pending' (stop the service first)
  watch-events [--seconds N]
                          subscribe to K40 realtime events and print each one (code, hex data, card);
                          swipe a card to verify card capture / find the right cardEventCodes (default 60 s)
  sync-users [--dry-run]  write the cloud's user list to the K40 once; --dry-run only prints the plan
                          (without --dry-run the service must be stopped)
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
  const tokenArgIdx = args.indexOf('--token');
  if (tokenArgIdx !== -1 && (!args[tokenArgIdx + 1] || args[tokenArgIdx + 1].startsWith('--'))) {
    console.error('Setup aborted: --token needs a value (the pairing code from the admin panel)');
    return 1;
  }
  let token = (tokenArgIdx !== -1 ? args[tokenArgIdx + 1] : process.env.PAIRING_TOKEN) || '';
  let pairing: PairingData | undefined;
  let apiBaseUrl = '';
  let madrasaSlug = '';
  let institutionId = '';
  let deviceId = '';
  let device: Record<string, unknown> | undefined = existing.device;
  console.log(`Connector setup -> ${cfgPath}`);
  if (!token.trim()) {
    console.log('(press Enter to keep the value in brackets)\n');
    const rl = readline.createInterface({ input: process.stdin });
    const it: LineIter = rl[Symbol.asyncIterator]();
    token = await ask(it, 'Pairing code from admin panel (Enter to type values manually)');
    // compatibility with old piped answer files that start with the API URL
    const typedUrl = /^https?:\/\//i.test(token) ? token : '';
    if (typedUrl) token = '';
    if (token) {
      rl.close();
    } else {
      apiBaseUrl = typedUrl || (await ask(it, 'API base URL (https://...)', existing.apiBaseUrl));
      madrasaSlug = await ask(it, 'Madrasa slug (X-Madrasa-Slug)', existing.madrasaSlug);
      institutionId = await ask(it, 'Institution ID (number)', existing.institutionId ? String(existing.institutionId) : undefined);
      deviceId = await ask(it, 'Device ID / code (from admin panel)', existing.deviceId);
      const useLocal = (await ask(it, 'Override K40 IP/port/comm key locally instead of using cloud values? (y/N)', existing.device ? 'y' : 'n')).toLowerCase().startsWith('y');
      device = undefined;
      if (useLocal) {
        const ip = await ask(it, 'K40 IP address', existing.device?.ip);
        const port = await ask(it, 'K40 port', String(existing.device?.port ?? 4370));
        const ck = await ask(it, 'K40 comm key (0 = none)', String(existing.device?.commKey ?? 0));
        device = { ip, port: Number(port), commKey: Number(ck) };
      }
      rl.close();
    }
  }
  if (token) {
    try {
      pairing = parsePairingToken(token);
    } catch (e) {
      console.error(`Setup aborted: invalid pairing code: ${(e as Error).message}`);
      return 1;
    }
    registerSecret(pairing.key);
    apiBaseUrl = pairing.url;
    madrasaSlug = pairing.slug;
    institutionId = String(pairing.inst);
    deviceId = pairing.dev;
    console.log(`Pairing code OK: ${apiBaseUrl}  slug=${madrasaSlug}  institution=${institutionId}  device=${deviceId}`);
  }
  try {
    validateApiBaseUrl(apiBaseUrl, existing.allowInsecureHttp === true);
    if (!madrasaSlug || !deviceId || !(Number(institutionId) > 0)) throw new Error('slug, institution id and device id are required');
  } catch (e) {
    console.error(`Setup aborted: ${(e as Error).message}`);
    return 1;
  }
  const key = pairing?.key || process.env.DEVICE_KEY || (await askHidden('Device key (input hidden; or set env DEVICE_KEY to skip this prompt)'));
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
  if (pairing) console.log(`SETUP OK: device ${deviceId} paired with ${apiBaseUrl} (${madrasaSlug}).`);
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

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

/** Technician tool: print every realtime event the K40 pushes (card swipes, verifications, ...). */
async function cmdWatchEvents(cfg: AppConfig, args: string[]): Promise<number> {
  const seconds = Number(argValue(args, '--seconds') ?? 60);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    console.error('--seconds must be a positive number');
    return 1;
  }
  const log = makeLogger(cfg, true);
  const conn = new Connector(cfg, log, { queue: undefined });
  const s = await conn.resolveSettings();
  if (!s) {
    console.error('No K40 IP known: set "device.ip" in config.json or make the cloud config available.');
    return 1;
  }
  let stop = false;
  const onSig = () => {
    stop = true;
  };
  process.on('SIGINT', onSig);
  try {
    return await deviceLock.run(async () => {
      const client = makeZkClient(cfg, s, log);
      let registered = false;
      try {
        await client.connect();
        await client.regEvent(REG_EVENT_ALL);
        registered = true;
        console.log(`Listening for realtime events from ${s.ip}:${s.port} for ${seconds}s (Ctrl+C to stop).`);
        console.log(`Swipe a card / punch now. Card event codes in config: [${cfg.cardEventCodes.join(', ')}]`);
        const end = Date.now() + seconds * 1000;
        let n = 0;
        while (!stop && Date.now() < end) {
          const ev = await client.waitForEvent(Math.min(500, end - Date.now()));
          if (!ev) continue;
          n++;
          const card = extractCardFromEvent(ev, cfg.cardEventCodes);
          const anyU32 = ev.data.length >= 4 ? ev.data.readUInt32LE(0) : undefined;
          console.log(
            `${new Date(ev.receivedAt).toISOString()}  code=${ev.code}  len=${ev.data.length}  hex=${ev.data.toString('hex') || '-'}` +
              `  card=${card ?? '-'}${!card && anyU32 ? `  (u32 of first 4 bytes: ${anyU32})` : ''}`,
          );
        }
        console.log(`${n} event(s) received.`);
        if (n === 0) console.log('No events: check that the firmware supports realtime events (CMD_REG_EVENT).');
        return 0;
      } catch (e) {
        console.error(`FAILED: ${friendlyDeviceError(e)}`);
        return 2;
      } finally {
        if (registered) await client.regEvent(0).catch(() => undefined);
        await client.close();
      }
    });
  } finally {
    process.removeListener('SIGINT', onSig);
  }
}

/** One-shot user sync (or its plan with --dry-run). */
async function cmdSyncUsers(cfg: AppConfig, args: string[]): Promise<number> {
  const dry = args.includes('--dry-run');
  const log = makeLogger(cfg, true);
  let q: EventQueue | undefined;
  if (!dry) {
    try {
      q = EventQueue.open(cfg.localQueuePath); // takes the queue lock: refuses while the service runs
    } catch (e) {
      if (e instanceof QueueLockedError) {
        console.error(`${e.message}. Stop the connector service first (schtasks /End /TN AttendanceConnector), or use --dry-run.`);
        return 3;
      }
      throw e;
    }
  }
  try {
    const conn = new Connector(cfg, log, { queue: q });
    const s = await conn.resolveSettings();
    if (!s) {
      console.error('No K40 IP known: set "device.ip" in config.json or make the cloud config available.');
      return 1;
    }
    const r = await new CloudClient(cfg).getUsers();
    if (!r.ok || !r.data) {
      console.error(`Cloud user list unavailable: ${r.error}`);
      return 1;
    }
    const state = loadUserState(cfg.localQueuePath);
    const out = await syncDeviceUsers(cfg, s, log, r.data, state, { dryRun: dry });
    const p = out.plan;
    console.log(`Cloud: ${r.data.users.length} user(s), version ${r.data.version.slice(0, 12)}...   Device: ${out.deviceUsers.length} user(s), writing ${out.recordSize}-byte records`);
    console.log(`Managed by this connector (may be deleted when removed in the cloud): ${state.managed.length}`);
    for (const w of p.create) console.log(`  CREATE  pin=${w.pin}  name="${w.name}"  card=${w.card || '-'}`);
    for (const w of p.rename) console.log(`  RENAME  pin=${w.fromPin} -> ${w.pin}  uid=${w.uid}  name="${w.name}"  card=${w.card || '-'}  (same uid: fingerprints kept)`);
    for (const w of p.update) console.log(`  UPDATE  pin=${w.pin}  uid=${w.uid}  name="${w.name}"  card=${w.card || '-'}  (${w.reason})`);
    for (const d of p.delete) console.log(`  DELETE  pin=${d.pin}  uid=${d.uid}  name="${d.name}"  (created by connector, no longer in cloud)`);
    for (const k of p.skipped) console.log(`  SKIP    pin=${k.pin}  ${k.reason}`);
    console.log(`  unchanged: ${p.unchanged}`);
    const unmanaged = out.deviceUsers.filter((u) => !state.managed.includes(u.userId) && !r.data!.users.some((x) => x.pin === u.userId) && !p.rename.some((w) => w.fromPin === u.userId));
    if (unmanaged.length) console.log(`  kept (on device, not in cloud, not created by connector - never deleted): ${unmanaged.length}`);
    if (dry) {
      console.log('dry-run: nothing written to the device.');
      return 0;
    }
    const res = out.result!;
    console.log(`Done: created ${res.created}, updated ${res.updated}, renamed ${res.renamed}, deleted ${res.deleted}; device now has ${res.deviceUserCount} user(s).`);
    if (res.errors.length) {
      console.error(`Errors (${res.errors.length}):\n  ${res.errors.slice(0, 10).join('\n  ')}`);
      return 2;
    }
    return 0;
  } catch (e) {
    console.error(`FAILED: ${friendlyDeviceError(e)}`);
    return 2;
  } finally {
    q?.close();
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
    case 'watch-events':
      return cmdWatchEvents(cfg, args);
    case 'sync-users':
      return cmdSyncUsers(cfg, args);
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
