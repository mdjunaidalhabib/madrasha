import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AppConfig } from './config';
import {
  CloudClient,
  CONNECTOR_VERSION,
  type CloudDeviceConfig,
  type CloudEnrollment,
  type CloudUserList,
  type EnrollmentReply,
  type EnrollmentReportStatus,
  type HeartbeatBody,
  type IngestEventPayload,
  type IngestResult,
} from './cloud';
import { Logger, registerSecret } from './logger';
import { atomicWriteFile, EventQueue, makeEventId, type QueueEvent } from './queue';
import { dpapiAvailable, protectSecret, unprotectSecret } from './secret';
import {
  deviceStoredName,
  extractCardFromEvent,
  REG_EVENT_ALL,
  ZKClient,
  ZKError,
  zkTimeToIso,
  zkTimeToText,
  type DeviceUser,
  type RawPunch,
  type ZkTime,
} from './protocol';
import {
  applyUserSync,
  cardToU32,
  deviceLock,
  loadUserState,
  planUserSync,
  resolveRecordSize,
  saveUserState,
  UidAllocator,
  type UserSyncPlan,
  type UserSyncResult,
  type UserSyncState,
} from './device-users';

export interface DeviceSettings {
  ip: string;
  port: number;
  commKey: number;
  pollIntervalSec: number;
  source: 'local' | 'cloud' | 'cache' | 'mixed';
}

export interface FetchedEvent {
  id: string;
  deviceUserId: string;
  timestamp: string;
  verifyType: number;
  inOutState: number;
}

/* ---------------------------------------------------------------- helpers */

export function punchesToEvents(punches: RawPunch[], cfg: Pick<AppConfig, 'deviceId' | 'deviceTimezoneOffset'>): FetchedEvent[] {
  return punches.map((p) => {
    const timestamp = zkTimeToIso(p.time, cfg.deviceTimezoneOffset);
    return {
      id: makeEventId(cfg.deviceId, p.userId, timestamp, p.verifyType, p.inOutState),
      deviceUserId: p.userId,
      timestamp,
      verifyType: p.verifyType,
      inOutState: p.inOutState,
    };
  });
}

function parseCommKey(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function mergeDeviceSettings(cfg: AppConfig, cloud: CloudDeviceConfig | undefined, cloudSource: 'cloud' | 'cache'): DeviceSettings | undefined {
  const ip = cfg.device?.ip || cloud?.ip || undefined;
  if (!ip) return undefined;
  const port = cfg.device?.port ?? (cloud?.port ? Number(cloud.port) : 4370);
  const commKey = cfg.device?.commKey ?? parseCommKey(cloud?.comm_password) ?? 0;
  const cloudPoll = Number(cloud?.poll_interval_sec);
  const pollIntervalSec = cfg.preferCloudSettings && Number.isFinite(cloudPoll) && cloudPoll >= 1 ? cloudPoll : cfg.pollIntervalSec;
  const local = !!cfg.device?.ip && cfg.device.port !== undefined && cfg.device.commKey !== undefined;
  return { ip, port, commKey, pollIntervalSec, source: local ? 'local' : cfg.device?.ip ? 'mixed' : cloudSource };
}

export function deviceDriftSec(t: ZkTime, offset: string, now = Date.now()): number {
  return Math.round((Date.parse(zkTimeToIso(t, offset)) - now) / 1000);
}

/** "+06:00" -> 360 */
export function offsetMinutes(offset: string): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!m) throw new Error(`bad offset ${offset}`);
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** Wall-clock time at `offset` for the instant `ms` (what the K40 should display). */
export function zkTimeInOffset(ms: number, offset: string): ZkTime {
  const d = new Date(ms + offsetMinutes(offset) * 60_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

export function makeZkClient(cfg: AppConfig, s: DeviceSettings, log: Logger): ZKClient {
  return new ZKClient({
    host: s.ip,
    port: s.port,
    commKey: s.commKey,
    connectTimeoutMs: cfg.connectTimeoutMs,
    timeoutMs: cfg.commandTimeoutMs,
    debug: (m) => log.debug(`zk: ${m}`),
  });
}

export interface ClockInfo {
  /** device - PC seconds after any correction (undefined when the time could not be read) */
  driftSec?: number;
  /** drift before an automatic correction, when one was made */
  correctedFromSec?: number;
}

/**
 * One connect -> read -> close session (under the device lock). Always re-enables the device and closes the session.
 * With opts.clock.autoSync the device clock is set to PC time (in deviceTimezoneOffset) when |drift| > threshold.
 */
export async function readDevicePunches(
  cfg: AppConfig,
  s: DeviceSettings,
  log: Logger,
  opts: {
    disable?: boolean;
    afterRead?: (client: ZKClient, punches: RawPunch[], truncated: boolean) => Promise<void>;
    clock?: { autoSync: boolean; thresholdSec: number };
  } = {},
): Promise<{ punches: RawPunch[]; recordSize: number; truncated: boolean; deviceTime?: ZkTime; clock: ClockInfo }> {
  return deviceLock.run(async () => {
    const client = makeZkClient(cfg, s, log);
    try {
      await client.connect();
      log.info(`k40 connected ${s.ip}:${s.port}`);
      let deviceTime: ZkTime | undefined;
      const clock: ClockInfo = {};
      try {
        deviceTime = await client.getTime();
        clock.driftSec = deviceDriftSec(deviceTime, cfg.deviceTimezoneOffset);
      } catch (e) {
        log.debug(`get time failed: ${(e as Error).message}`);
      }
      if (opts.clock?.autoSync && clock.driftSec !== undefined && Math.abs(clock.driftSec) > opts.clock.thresholdSec) {
        const before = clock.driftSec;
        try {
          await client.setTime(zkTimeInOffset(Date.now(), cfg.deviceTimezoneOffset));
          deviceTime = await client.getTime();
          clock.driftSec = deviceDriftSec(deviceTime, cfg.deviceTimezoneOffset);
          clock.correctedFromSec = before;
          log.warn(`K40 clock was ${before}s off; set to PC time (${cfg.deviceTimezoneOffset}), drift now ${clock.driftSec}s`);
        } catch (e) {
          log.warn(`K40 clock is ${before}s off and could not be corrected: ${(e as Error).message}`);
        }
      }
      if (opts.disable) await client.disableDevice();
      const r = await client.getAttendance(cfg.resolveUserIds);
      if (opts.afterRead) await opts.afterRead(client, r.punches, r.truncated);
      return { ...r, deviceTime, clock };
    } finally {
      await client.close();
      log.info('k40 disconnected');
    }
  });
}

export async function testDevice(cfg: AppConfig, s: DeviceSettings, log: Logger): Promise<{ time: ZkTime; name?: string; users?: number; records?: number }> {
  return deviceLock.run(() => testDeviceUnlocked(cfg, s, log));
}

async function testDeviceUnlocked(cfg: AppConfig, s: DeviceSettings, log: Logger): Promise<{ time: ZkTime; name?: string; users?: number; records?: number }> {
  const client = makeZkClient(cfg, s, log);
  try {
    await client.connect();
    const time = await client.getTime();
    const name = await client.getOption('~DeviceName');
    let users: number | undefined;
    let records: number | undefined;
    try {
      const sz = await client.getFreeSizes();
      users = sz.users;
      records = sz.records;
    } catch {
      /* optional */
    }
    return { time, name, users, records };
  } finally {
    await client.close();
  }
}

export function friendlyDeviceError(e: unknown): string {
  if (e instanceof ZKError) {
    switch (e.code) {
      case 'AUTH_FAILED':
        return 'K40 rejected the communication key (Comm Key mismatch)';
      case 'TIMEOUT':
        return `K40 not answering (${e.message})`;
      case 'CONNECT_FAILED':
        return `cannot connect to K40 (${e.message})`;
      default:
        return `K40 error: ${e.message}`;
    }
  }
  return `K40 error: ${(e as Error)?.message ?? String(e)}`;
}

/**
 * One user-sync session (under the device lock): read device users, diff with the cloud list, and (unless dryRun)
 * write / delete. state is updated and saved to dataDir (managed pins as they change; version only when every
 * user was written without error).
 */
export async function syncDeviceUsers(
  cfg: AppConfig,
  s: DeviceSettings,
  log: Logger,
  list: CloudUserList,
  state: UserSyncState,
  opts: { dryRun?: boolean } = {},
): Promise<{ plan: UserSyncPlan; deviceUsers: DeviceUser[]; recordSize: 72 | 28; result?: UserSyncResult }> {
  return deviceLock.run(async () => {
    const client = makeZkClient(cfg, s, log);
    try {
      await client.connect();
      const deviceUsers = await client.getUsers();
      if (client.userRecordSize && cfg.userRecordSize !== 'auto' && client.userRecordSize !== cfg.userRecordSize) {
        log.warn(`config userRecordSize=${cfg.userRecordSize} but the device user list uses ${client.userRecordSize}-byte records`);
      }
      const recordSize = resolveRecordSize(cfg.userRecordSize, client.userRecordSize, state.recordSize);
      const plan = planUserSync(deviceUsers, list.users, state.managed, recordSize);
      if (opts.dryRun) return { plan, deviceUsers, recordSize };
      if (client.userRecordSize) state.recordSize = client.userRecordSize;
      let result: UserSyncResult;
      try {
        result = await applyUserSync(client, deviceUsers, plan, recordSize, state);
      } finally {
        saveUserState(cfg.localQueuePath, state);
      }
      if (result.errors.length === 0) {
        state.version = list.version;
        state.syncedAt = new Date().toISOString();
        saveUserState(cfg.localQueuePath, state);
      }
      return { plan, deviceUsers, recordSize, result };
    } finally {
      await client.close();
    }
  });
}

/* -------------------------------------------------------------- Connector */

export interface ConnectorOptions {
  queue?: EventQueue;
  /** encrypt cached comm password with DPAPI (default: true on Windows) */
  protectCache?: boolean;
}

export interface ConnectorStats {
  cycles: number;
  fetchedTotal: number;
  enqueued: number;
  syncedAccepted: number;
  syncedDuplicate: number;
  rejected: number;
  ingestRequests: number;
  ingestFailures: number;
  heartbeatsSent: number;
  heartbeatsFailed: number;
  k40Failures: number;
}

export class Connector {
  readonly stats: ConnectorStats = {
    cycles: 0,
    fetchedTotal: 0,
    enqueued: 0,
    syncedAccepted: 0,
    syncedDuplicate: 0,
    rejected: 0,
    ingestRequests: 0,
    ingestFailures: 0,
    heartbeatsSent: 0,
    heartbeatsFailed: 0,
    k40Failures: 0,
  };
  queue!: EventQueue;
  private cloud: CloudClient;
  private cloudConfig?: CloudDeviceConfig;
  private cloudConfigSource: 'cloud' | 'cache' = 'cache';
  private ac = new AbortController();
  private loops: Promise<void>[] = [];
  private k40Fails = 0;
  private deviceOnline = false;
  private lastContactIso?: string;
  private lastDeviceError?: string;
  private lastLocalError?: string;
  private pendingTest?: { ok: boolean; message?: string };
  private authBlockedUntil = 0;
  private wake?: () => void;
  private lastPrune = 0;
  private lastLogged = new Map<string, string>();
  private started = false;
  /** data/user-sync.json (managed pins + last synced users_version) */
  userState: UserSyncState;
  /** last measured device - PC clock difference (s) */
  private clockDriftSec?: number;
  /** user sync outcome waiting to be delivered in a heartbeat */
  private pendingUserReport?: Pick<HeartbeatBody, 'users_synced_version' | 'user_sync_error' | 'device_user_count'>;
  private userSyncFailures = 0;
  private nextUserSyncAt = 0;
  /** enrollment ids already handled (id -> time), so a repeated /commands answer never re-runs one */
  private handledEnrollments = new Map<string, number>();
  readonly enrollStats = { started: 0, completed: 0, expired: 0, failed: 0, rejected: 0 };

  constructor(readonly cfg: AppConfig, readonly log: Logger, private opts: ConnectorOptions = {}) {
    this.cloud = new CloudClient(cfg);
    registerSecret(cfg.deviceKey);
    if (cfg.device?.commKey !== undefined) this.registerComm(cfg.device.commKey);
    this.userState = loadUserState(cfg.localQueuePath);
  }

  private registerComm(k: number): void {
    const s = String(k);
    if (s.length >= 4) registerSecret(s);
  }

  /* ---- lifecycle */

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.queue = this.opts.queue ?? EventQueue.open(this.cfg.localQueuePath);
    const li = this.queue.loadInfo;
    const c = this.queue.counts();
    this.log.info(
      `connector ${CONNECTOR_VERSION} started; queue: ${c.pending} pending, ${c.failed} failed, ${c.synced} synced (dedupe index ${c.dedupeIndex})` +
        (li.recoveredSyncing ? `; recovered ${li.recoveredSyncing} events stuck in 'syncing' -> pending` : '') +
        (li.corruptLines || li.incompleteTail ? `; repaired queue log (corrupt/truncated tail: ${li.corruptLines} line(s))` : ''),
    );
    await this.loadCachedConfig();
    this.loops = [this.fetchLoop(), this.syncLoop(), this.commandLoop()];
  }

  /** Resolves when stop() completes. */
  async waitUntilStopped(): Promise<void> {
    await Promise.all(this.loops);
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.log.info('shutting down...');
    this.ac.abort();
    this.wake?.();
    await Promise.allSettled(this.loops);
    if (!this.opts.queue) this.queue.close();
    this.started = false;
    this.log.info('stopped');
  }

  get aborted(): boolean {
    return this.ac.signal.aborted;
  }

  /* ---- timing helpers */

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.ac.signal.aborted) return resolve();
      const done = () => {
        clearTimeout(t);
        this.ac.signal.removeEventListener('abort', done);
        resolve();
      };
      const t = setTimeout(done, Math.max(0, ms));
      this.ac.signal.addEventListener('abort', done, { once: true });
    });
  }

  /** sleep that can be cut short by kick() (new work available) */
  private waitForWork(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.ac.signal.aborted) return resolve();
      const done = () => {
        clearTimeout(t);
        this.wake = undefined;
        this.ac.signal.removeEventListener('abort', done);
        resolve();
      };
      const t = setTimeout(done, Math.max(0, ms));
      this.wake = done;
      this.ac.signal.addEventListener('abort', done, { once: true });
    });
  }

  private kick(): void {
    this.wake?.();
  }

  backoffMs(failures: number): number {
    const { baseSec, maxSec, jitter } = this.cfg.retry;
    const raw = Math.min(maxSec, baseSec * Math.pow(2, Math.max(0, failures - 1)));
    const j = 1 + jitter * (Math.random() * 2 - 1);
    return Math.max(1, raw * j * 1000);
  }

  /** log a message only when it differs from the last one for that key (avoid spamming every cycle) */
  private logChanged(key: string, level: 'info' | 'warn' | 'error', msg: string): void {
    if (this.lastLogged.get(key) === msg) return;
    this.lastLogged.set(key, msg);
    this.log[level](msg);
  }

  /* ---- cloud config */

  private cachePath(): string {
    return path.join(this.cfg.localQueuePath, 'cloud-config.json');
  }

  private async loadCachedConfig(): Promise<void> {
    try {
      const p = this.cachePath();
      if (!fs.existsSync(p)) return;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      const cc: CloudDeviceConfig = { ...raw.config };
      if (raw.comm_password_enc) {
        try {
          cc.comm_password = await unprotectSecret(raw.comm_password_enc);
        } catch (e) {
          this.log.warn(`cannot decrypt cached comm key: ${(e as Error).message}`);
        }
      } else if (raw.comm_password_plain !== undefined) {
        cc.comm_password = raw.comm_password_plain;
      }
      if (cc.comm_password !== undefined && cc.comm_password !== null) this.registerComm(Number(cc.comm_password));
      this.cloudConfig = cc;
      this.cloudConfigSource = 'cache';
      this.log.info('loaded cached cloud config (used until cloud is reachable)');
    } catch (e) {
      this.log.warn(`cached cloud config unreadable: ${(e as Error).message}`);
    }
  }

  private async saveCachedConfig(cc: CloudDeviceConfig): Promise<void> {
    try {
      const { comm_password, ...rest } = cc;
      const out: { config: CloudDeviceConfig; comm_password_enc?: string; comm_password_plain?: string } = { config: rest };
      const protect = this.opts.protectCache ?? dpapiAvailable();
      if (comm_password !== null && comm_password !== undefined && comm_password !== '') {
        if (protect) out.comm_password_enc = await protectSecret(String(comm_password));
        else out.comm_password_plain = String(comm_password);
      }
      const text = JSON.stringify(out);
      const p = this.cachePath();
      if (fs.existsSync(p) && fs.readFileSync(p, 'utf8') === text) return;
      fs.mkdirSync(path.dirname(p), { recursive: true });
      atomicWriteFile(p, text);
    } catch (e) {
      this.log.warn(`could not cache cloud config: ${(e as Error).message}`);
    }
  }

  private authBlocked(): boolean {
    return Date.now() < this.authBlockedUntil;
  }

  private blockAuth(what: string, status: number, err: string): void {
    this.authBlockedUntil = Date.now() + this.cfg.authBackoffSec * 1000;
    this.log.error(
      `CLOUD REJECTED CREDENTIALS during ${what} (${err}). Check deviceKey, madrasaSlug, institutionId and that the device is active in the admin panel. ` +
        `Backing off ${this.cfg.authBackoffSec}s before contacting the cloud again. Local queueing continues.`,
    );
    void status;
  }

  private async refreshCloudConfig(): Promise<void> {
    if (this.authBlocked()) return;
    const r = await this.cloud.getConfig();
    if (r.ok && r.data) {
      const cc = r.data;
      this.cloudConfig = cc;
      this.cloudConfigSource = 'cloud';
      if (cc.comm_password !== null && cc.comm_password !== undefined) this.registerComm(Number(cc.comm_password));
      this.logChanged('cfg', 'info', 'cloud config fetched');
      await this.saveCachedConfig(cc);
    } else if (r.kind === 'auth') {
      this.blockAuth('config fetch', r.status, r.error ?? '');
    } else {
      this.logChanged('cfg', 'warn', `cloud config unavailable (${r.error}); using cached/local settings`);
    }
  }

  /** For CLI commands: cached cloud config, then a fresh fetch, then merged with the local override. */
  async resolveSettings(): Promise<DeviceSettings | undefined> {
    await this.loadCachedConfig();
    await this.refreshCloudConfig();
    return this.effectiveSettings();
  }

  effectiveSettings(): DeviceSettings | undefined {
    return mergeDeviceSettings(this.cfg, this.cloudConfig, this.cloudConfigSource);
  }

  /* ---- fetch loop (K40 -> queue) */

  private async fetchLoop(): Promise<void> {
    while (!this.ac.signal.aborted) {
      let ok = false;
      try {
        ok = await this.cycle();
      } catch (e) {
        this.log.error(`cycle crashed (continuing): ${(e as Error).stack ?? e}`);
      }
      const poll = (this.effectiveSettings()?.pollIntervalSec ?? this.cfg.pollIntervalSec) * 1000;
      const delay = ok ? poll : Math.max(poll, this.backoffMs(this.k40Fails));
      await this.sleepWithHeartbeats(delay);
    }
  }

  /** long sleeps (K40 backoff) are split so the cloud still hears from us at least every 60s */
  private async sleepWithHeartbeats(ms: number): Promise<void> {
    const slice = 60_000;
    let left = ms;
    while (left > slice && !this.ac.signal.aborted) {
      await this.sleep(slice);
      left -= slice;
      if (!this.ac.signal.aborted) await this.sendHeartbeat();
    }
    await this.sleep(left);
  }

  /** one poll cycle; returns true if the K40 was reachable */
  async cycle(): Promise<boolean> {
    this.stats.cycles++;
    await this.refreshCloudConfig();
    const settings = this.effectiveSettings();
    if (this.cloudConfig?.test_requested && !this.pendingTest) await this.runConnectionTest(settings);
    let ok = false;
    if (!settings) {
      this.lastDeviceError = 'no device IP known yet (waiting for cloud config or local device override)';
      this.logChanged('k40', 'warn', this.lastDeviceError);
      this.k40Fails++;
    } else {
      ok = await this.fetchFromDevice(settings);
    }
    await this.sendHeartbeat();
    this.maybePrune();
    return ok;
  }

  private async runConnectionTest(settings: DeviceSettings | undefined): Promise<void> {
    this.log.info('cloud requested a connection test');
    if (!settings) {
      this.pendingTest = { ok: false, message: 'no device IP configured' };
      return;
    }
    try {
      const r = await testDevice(this.cfg, settings, this.log);
      this.pendingTest = { ok: true, message: `connected; device time ${zkTimeToText(r.time)}${r.name ? `; model ${r.name}` : ''}` };
    } catch (e) {
      this.pendingTest = { ok: false, message: friendlyDeviceError(e).slice(0, 200) };
    }
    this.log.info(`connection test result: ${this.pendingTest.ok ? 'OK' : 'FAILED'} - ${this.pendingTest.message}`);
  }

  private async fetchFromDevice(s: DeviceSettings): Promise<boolean> {
    try {
      const clearMode = this.cfg.clearDeviceLogsAfterSync;
      let cleared = false;
      let preAdded = 0;
      const res = await readDevicePunches(this.cfg, s, this.log, {
        clock: { autoSync: this.cloudConfig?.auto_time_sync !== false, thresholdSec: this.cfg.clockSyncThresholdSec },
        disable: this.cfg.disableDeviceDuringRead || clearMode,
        afterRead: async (client, punches, truncated) => {
          if (!clearMode || punches.length === 0 || truncated) return;
          // Only clear when every record currently on the device is ALREADY confirmed by the cloud.
          // Device is disabled during this window so no punch can slip in between read and clear.
          const evs = punchesToEvents(punches, this.cfg);
          const newOnes = this.queue.enqueue(evs);
          preAdded = newOnes.length;
          if (newOnes.length === 0 && evs.every((e) => this.queue.isSynced(e.id))) {
            this.log.warn(`clearDeviceLogsAfterSync=true: all ${evs.length} device records are synced, clearing device log`);
            await client.clearAttendance();
            cleared = true;
          }
        },
      });
      this.deviceOnline = true;
      this.k40Fails = 0;
      this.lastDeviceError = undefined;
      this.lastContactIso = new Date().toISOString();
      this.logChanged('k40', 'info', 'k40 reachable');
      const events = punchesToEvents(res.punches, this.cfg);
      let added: QueueEvent[] = [];
      if (!cleared) {
        try {
          added = this.queue.enqueue(events);
          this.lastLocalError = undefined;
        } catch (e) {
          // e.g. ENOSPC: the device log is untouched, so these punches are simply re-read next cycle
          this.lastLocalError = `local queue write failed: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`;
          this.log.error(`${this.lastLocalError} - free disk space! Punches stay on the K40 and will be re-read.`);
        }
      }
      this.stats.fetchedTotal += events.length;
      const addedCount = added.length + preAdded;
      this.stats.enqueued += addedCount;
      let maxTs = this.queue.getMeta().lastFetchedTimestamp;
      for (const e of events) if (!maxTs || Date.parse(e.timestamp) > Date.parse(maxTs)) maxTs = e.timestamp;
      this.queue.setMeta({
        lastFetchedTimestamp: maxTs,
        lastFetchAt: this.lastContactIso,
        lastDeviceContactAt: this.lastContactIso,
        deviceOnline: true,
        lastDeviceError: undefined,
      });
      this.log.info(
        `fetch: ${events.length} record(s) on device (${res.recordSize || '-'} byte format), ${addedCount} new queued` +
          (cleared ? ', device log cleared' : ''),
      );
      if (res.truncated) this.log.warn('device log read was truncated; partial data queued, device log NOT cleared');
      if (res.clock.driftSec !== undefined) this.clockDriftSec = res.clock.driftSec;
      if (res.deviceTime && res.clock.driftSec !== undefined) {
        const drift = res.clock.driftSec;
        if (Math.abs(drift) > 300) {
          this.logChanged('drift', 'warn', `K40 clock differs from this PC by ${drift}s (device ${zkTimeToText(res.deviceTime)}); fix time on the device`);
        } else this.logChanged('drift', 'info', 'K40 clock OK');
      }
      if (addedCount) this.kick();
      return true;
    } catch (e) {
      this.deviceOnline = false;
      this.k40Fails++;
      this.stats.k40Failures++;
      this.lastDeviceError = friendlyDeviceError(e);
      this.log.warn(`fetch failed (attempt ${this.k40Fails}): ${this.lastDeviceError}`);
      this.queue.setMeta({ deviceOnline: false, lastDeviceError: this.lastDeviceError });
      return false;
    }
  }

  /* ---- heartbeat */

  async sendHeartbeat(): Promise<void> {
    if (this.authBlocked()) return;
    const test = this.pendingTest;
    const userReport = this.pendingUserReport;
    const body: HeartbeatBody = {
      device_id: this.cfg.deviceId,
      device_status: (this.deviceOnline ? 'online' : 'offline') as 'online' | 'offline',
      ...(this.clockDriftSec !== undefined ? { clock_drift_sec: this.clockDriftSec } : {}),
      ...(userReport ?? {}),
      ...(this.lastContactIso ? { last_device_contact_at: this.lastContactIso } : {}),
      ...(!this.deviceOnline && this.lastDeviceError
        ? { error: this.lastDeviceError.slice(0, 200) }
        : this.lastLocalError
          ? { error: this.lastLocalError.slice(0, 200) }
          : {}),
      ...(test ? { test_result: test } : {}),
      connector_version: CONNECTOR_VERSION,
    };
    const r = await this.cloud.heartbeat(body);
    if (r.ok) {
      this.stats.heartbeatsSent++;
      if (test && this.pendingTest === test) this.pendingTest = undefined;
      if (userReport && this.pendingUserReport === userReport) this.pendingUserReport = undefined;
      this.logChanged('hb', 'info', 'heartbeat ok');
      this.log.debug(`heartbeat sent (${body.device_status})`);
    } else {
      this.stats.heartbeatsFailed++;
      if (r.kind === 'auth') this.blockAuth('heartbeat', r.status, r.error ?? '');
      else this.logChanged('hb', 'warn', `heartbeat failed: ${r.error}`);
    }
  }

  /* ---- command loop (cloud -> device: enrollments, user sync) */

  /**
   * Long-polls GET /commands forever. Runs an enrollment when the cloud hands one out, and a user sync whenever the
   * cloud's users_version differs from the last version this connector wrote to the device.
   */
  private async commandLoop(): Promise<void> {
    let failures = 0;
    while (!this.ac.signal.aborted) {
      try {
        if (this.authBlocked()) {
          await this.sleep(Math.min(30_000, this.authBlockedUntil - Date.now()));
          continue;
        }
        const t0 = Date.now();
        const r = await this.cloud.commands(this.cfg.commandsWaitSec, this.ac.signal);
        if (this.ac.signal.aborted) break;
        this.log.debug(
          `commands poll: ${r.ok ? (r.data?.enrollment ? `enrollment ${r.data.enrollment.id}` : 'nothing') : `error ${r.error}`} after ${Date.now() - t0}ms`,
        );
        let desiredVersion = this.cloudConfig?.users_version;
        let pause = 0;
        if (r.ok && r.data) {
          failures = 0;
          this.lastLogged.delete('cmd');
          if (r.data.users_version) desiredVersion = r.data.users_version;
          if (r.data.enrollment) await this.handleEnrollment(r.data.enrollment, r.data.server_time);
          // guard against a backend that ignores ?wait (or wait=0): never spin faster than once a second
          else if (Date.now() - t0 < 1000) pause = 1000 - (Date.now() - t0);
        } else if (r.kind === 'auth') {
          this.blockAuth('commands', r.status, r.error ?? '');
          continue;
        } else if (r.status === 404) {
          this.logChanged('cmd', 'warn', 'cloud has no /connector/commands endpoint (older backend?): card enrollment unavailable; retrying in 5 min');
          pause = 300_000;
        } else {
          failures++;
          pause = r.kind === 'rate_limited' && r.retryAfterSec ? r.retryAfterSec * 1000 : this.backoffMs(failures);
          this.logChanged('cmd', 'warn', `command poll failed: ${r.error}`);
        }
        await this.maybeSyncUsers(desiredVersion);
        if (pause > 0) await this.sleep(pause);
      } catch (e) {
        this.log.error(`command loop error (continuing): ${(e as Error).stack ?? e}`);
        await this.sleep(this.backoffMs(++failures));
      }
    }
  }

  /** Sync device users when the cloud's users_version differs from the synced one (with backoff after failures). */
  private async maybeSyncUsers(desiredVersion: string | undefined): Promise<void> {
    if (!this.cfg.userSyncEnabled || !desiredVersion || this.ac.signal.aborted) return;
    if (desiredVersion === this.userState.version) return;
    if (Date.now() < this.nextUserSyncAt || this.authBlocked()) return;
    const settings = this.effectiveSettings();
    if (!settings) return;
    try {
      await this.syncUsers(settings);
    } catch (e) {
      this.userSyncFailures++;
      const wait = this.backoffMs(this.userSyncFailures);
      this.nextUserSyncAt = Date.now() + wait;
      const msg = (e instanceof ZKError ? friendlyDeviceError(e) : (e as Error).message).slice(0, 200);
      this.pendingUserReport = { user_sync_error: msg };
      this.logChanged('usersync', 'warn', `user sync failed: ${msg}; retry in ${Math.round(wait / 1000)}s`);
    }
  }

  /** Fetch GET /users and apply it to the device. Throws on any failure (caller schedules the retry). */
  async syncUsers(settings: DeviceSettings): Promise<UserSyncResult | undefined> {
    const r = await this.cloud.getUsers();
    if (!r.ok || !r.data) {
      if (r.kind === 'auth') this.blockAuth('user list', r.status, r.error ?? '');
      throw new Error(`cloud user list unavailable: ${r.error}`);
    }
    const out = await syncDeviceUsers(this.cfg, settings, this.log, r.data, this.userState);
    const res = out.result!;
    const p = res.plan;
    if (p.skipped.length) this.log.warn(`user sync skipped: ${p.skipped.map((x) => `${x.pin} (${x.reason})`).join('; ').slice(0, 500)}`);
    if (res.errors.length) throw new Error(`device refused ${res.errors.length} user write(s): ${res.errors[0]}`);
    this.userSyncFailures = 0;
    this.nextUserSyncAt = 0;
    this.lastLogged.delete('usersync');
    this.pendingUserReport = { users_synced_version: r.data.version, user_sync_error: null, device_user_count: res.deviceUserCount };
    this.log.info(
      `user sync: ${r.data.users.length} desired; created ${res.created}, updated ${res.updated}, renamed ${res.renamed}, deleted ${res.deleted}, unchanged ${p.unchanged}; ` +
        `${res.deviceUserCount} user(s) on device (${res.recordSize}-byte records)`,
    );
    return res;
  }

  private async reportEnrollment(
    id: CloudEnrollment['id'],
    status: EnrollmentReportStatus,
    extra: { card_number?: string; message?: string } = {},
    attempts = 1,
  ): Promise<EnrollmentReply | undefined> {
    for (let i = 1; i <= attempts; i++) {
      const r = await this.cloud.reportEnrollment(id, { device_id: this.cfg.deviceId, status, ...extra });
      if (r.ok && r.data) return r.data;
      if (r.kind === 'auth') {
        this.blockAuth('enrollment report', r.status, r.error ?? '');
        return undefined;
      }
      this.log.warn(`enrollment ${id}: reporting '${status}' failed (${r.error})${i < attempts ? ', retrying' : ''}`);
      if (r.kind === 'client' || i === attempts) return undefined;
      await new Promise((res) => setTimeout(res, 1000 * i));
    }
    return undefined;
  }

  /** Run one enrollment handed out by GET /commands. Never throws; every outcome is logged. */
  async handleEnrollment(en: CloudEnrollment, serverTime?: string): Promise<string> {
    const key = String(en.id);
    const now = Date.now();
    for (const [k, t] of this.handledEnrollments) if (now - t > 3600_000) this.handledEnrollments.delete(k);
    if (this.handledEnrollments.has(key)) return 'already handled';
    this.handledEnrollments.set(key, now);
    const outcome = await this.runEnrollment(en, key, now, serverTime);
    this.log.info(`enrollment ${key}: ${outcome}`);
    return outcome;
  }

  private async runEnrollment(en: CloudEnrollment, key: string, now: number, serverTime?: string): Promise<string> {
    this.enrollStats.started++;
    const pin = String(en.device_user_id ?? '').trim();
    if (!this.cfg.userSyncEnabled) {
      await this.reportEnrollment(en.id, 'failed', { message: 'user writing is disabled on this connector (userSyncEnabled=false)' });
      this.enrollStats.failed++;
      return 'failed: disabled';
    }
    if (!pin) {
      await this.reportEnrollment(en.id, 'failed', { message: 'enrollment has no device user id' });
      this.enrollStats.failed++;
      return 'failed: no pin';
    }
    // time left, measured on the server's clock so a wrong PC clock cannot shorten / extend it
    const exp = Date.parse(en.expires_at);
    const srv = serverTime ? Date.parse(serverTime) : NaN;
    let remaining = Number.isFinite(exp) ? exp - (Number.isFinite(srv) ? srv : now) : 120_000;
    remaining = Math.min(remaining, 600_000);
    if (remaining <= 0) {
      await this.reportEnrollment(en.id, 'expired', { message: 'expired before the connector received it' });
      this.enrollStats.expired++;
      return 'expired';
    }
    // The command loop starts together with the fetch loop, so the very first /commands answer can arrive before
    // the first cloud config (which carries the K40 IP) was fetched: fetch it now instead of failing.
    let settings = this.effectiveSettings();
    if (!settings) {
      await this.refreshCloudConfig();
      settings = this.effectiveSettings();
    }
    if (!settings) {
      await this.reportEnrollment(en.id, 'failed', { message: 'connector does not know the device IP yet' });
      this.enrollStats.failed++;
      return 'failed: no device';
    }
    const deadline = now + remaining;
    this.log.info(`enrollment ${key}: device user ${pin} (${en.attendee_type}); waiting up to ${Math.round(remaining / 1000)}s for a card`);
    const s = settings;
    try {
      return await deviceLock.run(() => this.enrollOnDevice(en, pin, s, deadline));
    } catch (e) {
      return `failed: ${(e as Error).message}`;
    }
  }

  /**
   * The device record of this pin's prev_pin (from GET /users) when it may be renamed: prev_pin is on the device and
   * is not itself a desired pin. Cloud error -> undefined (a new record is created, as before v2.1).
   */
  private async findPrevPinRecord(pin: string, users: DeviceUser[]): Promise<DeviceUser | undefined> {
    const r = await this.cloud.getUsers();
    if (!r.ok || !r.data) {
      this.log.debug(`prev_pin lookup for ${pin} skipped: ${r.error}`);
      return undefined;
    }
    const prev = r.data.users.find((u) => String(u.pin) === pin)?.prev_pin;
    if (!prev || String(prev) === pin || r.data.users.some((u) => String(u.pin) === String(prev))) return undefined;
    return users.find((u) => u.userId === String(prev));
  }

  /** The device part of an enrollment; runs under the device lock. */
  private async enrollOnDevice(en: CloudEnrollment, pin: string, s: DeviceSettings, deadline: number): Promise<string> {
    const key = String(en.id);
    const client = makeZkClient(this.cfg, s, this.log);
    let registered = false;
    try {
      await client.connect();
      // 1. make sure the person exists on the device (keep uid/privilege/password; keep device card unless the cloud has one)
      const users = await client.getUsers();
      const size = resolveRecordSize(this.cfg.userRecordSize, client.userRecordSize, this.userState.recordSize);
      if (client.userRecordSize) this.userState.recordSize = client.userRecordSize;
      const cur = users.find((u) => u.userId === pin);
      // v2.1: pin missing but the person's previous PIN is on the device -> rename that record in place (same uid,
      // fingerprints kept) instead of creating a duplicate person
      const renameFrom = cur ? undefined : await this.findPrevPinRecord(pin, users);
      const base = cur ?? renameFrom;
      const wantCard = cardToU32(en.card_number);
      const name = deviceStoredName(String(en.name ?? ''), size) || pin;
      const target = {
        uid: base?.uid ?? new UidAllocator(users).take(),
        userId: pin,
        name,
        privilege: base?.privilege ?? 0,
        password: base?.password,
        groupId: base?.groupId,
        card: wantCard ?? base?.card ?? 0,
      };
      if (!cur || cur.name !== name || target.card !== cur.card) {
        await client.setUser(target, size);
        await client.refreshData();
        if (!cur) {
          this.userState.managed = [...this.userState.managed.filter((p) => p !== renameFrom?.userId), pin];
          saveUserState(this.cfg.localQueuePath, this.userState);
        }
        const what = cur ? 'updated' : renameFrom ? `renamed ${renameFrom.userId} ->` : 'created';
        this.log.info(`enrollment ${key}: ${what} device user ${pin} (uid ${target.uid})`);
      }
      const baselineCard = target.card;
      // 2. realtime events; if the firmware refuses, the user-list polling below still catches menu enrollment
      try {
        await client.regEvent(REG_EVENT_ALL);
        registered = true;
      } catch (e) {
        this.log.warn(`enrollment ${key}: realtime events unavailable (${(e as Error).message}); only K40-menu enrollment will be detected`);
      }
      const w = await this.reportEnrollment(en.id, 'waiting', { message: `user ${pin} written to device; waiting for card` });
      if (w && !w.ok) {
        this.enrollStats.rejected++;
        return `stopped by cloud (${w.status})`;
      }
      // 3. wait for a card: realtime swipe, or the card appearing on the user via the K40 menu
      let captured: string | undefined;
      let via: 'swipe' | 'menu' = 'swipe';
      let lastPoll = Date.now();
      while (!this.ac.signal.aborted && Date.now() < deadline) {
        const slice = Math.max(1, Math.min(1000, deadline - Date.now()));
        const ev = registered ? await client.waitForEvent(slice) : (await this.sleep(slice), null);
        if (ev) {
          const card = extractCardFromEvent(ev, this.cfg.cardEventCodes);
          this.log.debug(`enrollment ${key}: realtime event code=${ev.code} len=${ev.data.length}${card ? ` card=${card}` : ''}`);
          if (card) {
            captured = card;
            via = 'swipe';
            break;
          }
        }
        if (Date.now() - lastPoll >= this.cfg.enrollmentUserPollMs && Date.now() < deadline) {
          lastPoll = Date.now();
          const u = (await client.getUsers()).find((x) => x.userId === pin);
          if (u && u.card > 0 && u.card !== baselineCard) {
            captured = String(u.card);
            via = 'menu';
            break;
          }
        }
      }
      if (!captured) {
        if (this.ac.signal.aborted) {
          await this.reportEnrollment(en.id, 'failed', { message: 'connector stopped' });
          this.enrollStats.failed++;
          return 'failed: connector stopped';
        }
        await this.reportEnrollment(en.id, 'expired', { message: 'no card presented in time' });
        this.enrollStats.expired++;
        return 'expired (no card)';
      }
      this.log.info(`enrollment ${key}: card ${captured} captured via ${via === 'swipe' ? 'realtime swipe' : 'K40 menu'}`);
      // 4. tell the cloud; only write the card to the device when the cloud accepted it
      const r = await this.reportEnrollment(en.id, 'captured', { card_number: captured }, 3);
      if (r?.ok) {
        const u32 = cardToU32(captured);
        if (via === 'swipe') {
          if (u32 !== undefined) {
            await client.setUser({ ...target, card: u32 }, size);
            await client.refreshData();
          } else this.log.warn(`enrollment ${key}: card ${captured} does not fit the device card field; stored in the cloud only`);
        }
        this.enrollStats.completed++;
        return `completed (card ${captured})`;
      }
      // rejected (card used by someone else / cancelled / unreachable): undo a card that was set via the K40 menu
      if (via === 'menu') {
        try {
          await client.setUser({ ...target, card: baselineCard }, size);
          await client.refreshData();
        } catch (e) {
          this.log.warn(`enrollment ${key}: could not revert card on device: ${(e as Error).message}`);
        }
      }
      this.enrollStats.rejected++;
      return r ? `not completed: ${r.status}${r.message ? ` - ${r.message}` : ''}` : 'not completed: cloud unreachable';
    } catch (e) {
      const msg = friendlyDeviceError(e).slice(0, 200);
      await this.reportEnrollment(en.id, 'failed', { message: msg });
      this.enrollStats.failed++;
      return `failed: ${msg}`;
    } finally {
      if (registered) {
        try {
          await client.regEvent(0);
        } catch (e) {
          this.log.debug(`REG_EVENT(0) failed: ${(e as Error).message}`);
        }
      }
      await client.close();
    }
  }

  /* ---- sync loop (queue -> cloud) */

  private async syncLoop(): Promise<void> {
    let failures = 0;
    let isolate = false;
    let singles = 0;
    while (!this.ac.signal.aborted) {
      try {
        if (this.authBlocked()) {
          await this.sleep(Math.min(30_000, this.authBlockedUntil - Date.now()));
          continue;
        }
        const batch = this.queue.peekPending(isolate ? 1 : this.cfg.batchSize);
        if (batch.length === 0) {
          await this.waitForWork(1000);
          continue;
        }
        const outcome = await this.sendBatch(batch);
        switch (outcome.kind) {
          case 'ok':
            failures = 0;
            if (isolate && ++singles >= 50) {
              isolate = false;
              singles = 0;
            }
            break;
          case 'auth':
            this.blockAuth('ingest', outcome.status, outcome.error);
            break;
          case 'rate_limited': {
            const wait = (outcome.retryAfterSec ?? 0) * 1000 || this.backoffMs(++failures);
            this.log.warn(`cloud rate limit (HTTP 429); waiting ${Math.round(wait / 1000)}s`);
            await this.sleep(wait);
            break;
          }
          case 'client':
            if (batch.length > 1) {
              isolate = true;
              singles = 0;
              this.log.warn(`batch rejected with client error (${outcome.error}); isolating events one by one`);
            } else {
              this.queue.markFailed(batch[0].id, outcome.error);
              this.stats.rejected++;
              this.log.error(`event ${batch[0].id} marked failed: ${outcome.error}`);
              isolate = false;
              singles = 0;
            }
            break;
          default: {
            failures++;
            const wait = this.backoffMs(failures);
            this.logChanged('sync', 'warn', `sync failed: ${outcome.error}; ${this.queue.counts().pending} event(s) stay pending, retry in ${Math.round(wait / 1000)}s`);
            await this.sleep(wait);
          }
        }
      } catch (e) {
        this.log.error(`sync loop error (continuing): ${(e as Error).stack ?? e}`);
        await this.sleep(this.backoffMs(++failures));
      }
    }
  }

  private async sendBatch(
    batch: QueueEvent[],
  ): Promise<{ kind: 'ok' } | { kind: 'auth' | 'rate_limited' | 'client' | 'network' | 'server'; error: string; status: number; retryAfterSec?: number }> {
    const ids = batch.map((e) => e.id);
    const payload: IngestEventPayload[] = batch.map((e) => ({
      event_id: e.id,
      device_user_id: e.deviceUserId,
      timestamp: e.timestamp,
      ...(e.verifyType !== undefined ? { verify_type: e.verifyType } : {}),
      ...(e.inOutState !== undefined ? { in_out_state: e.inOutState } : {}),
    }));
    this.queue.markSyncing(ids);
    this.stats.ingestRequests++;
    const r = await this.cloud.ingest(this.cfg.deviceId, this.cfg.institutionId, payload);
    if (!r.ok || !r.data) {
      this.stats.ingestFailures++;
      this.queue.release(ids, r.error ?? 'unknown error');
      this.queue.setMeta({ lastSyncError: r.error });
      return { kind: r.kind === 'ok' ? 'server' : r.kind, error: r.error ?? 'unknown error', status: r.status, retryAfterSec: r.retryAfterSec };
    }
    const byId = new Map<string, IngestResult>();
    for (const x of r.data.results) byId.set(x.event_id, x);
    const synced: string[] = [];
    const unanswered: string[] = [];
    let accepted = 0;
    let duplicate = 0;
    let rejected = 0;
    for (const e of batch) {
      const x = byId.get(e.id);
      if (!x) unanswered.push(e.id);
      else if (x.status === 'accepted') {
        synced.push(e.id);
        accepted++;
      } else if (x.status === 'duplicate') {
        synced.push(e.id);
        duplicate++;
      } else {
        this.queue.markFailed(e.id, `rejected: ${String(x.reason ?? 'no reason').slice(0, 200)}`);
        rejected++;
      }
    }
    if (synced.length) this.queue.markSynced(synced);
    if (unanswered.length) this.queue.release(unanswered, 'no result returned for event');
    this.stats.syncedAccepted += accepted;
    this.stats.syncedDuplicate += duplicate;
    this.stats.rejected += rejected;
    const nowIso = new Date().toISOString();
    this.queue.setMeta({ lastSyncAt: nowIso, lastSyncError: undefined });
    this.lastLogged.delete('sync');
    this.log.info(
      `sync: sent ${batch.length}: ${accepted} accepted, ${duplicate} duplicate, ${rejected} rejected, ${unanswered.length} unanswered; ${this.queue.counts().pending} pending`,
    );
    if (unanswered.length && synced.length === 0 && rejected === 0) {
      return { kind: 'server', error: 'cloud returned no per-event results', status: r.status };
    }
    return { kind: 'ok' };
  }

  private maybePrune(): void {
    if (Date.now() - this.lastPrune < 3600_000 && this.lastPrune !== 0) return;
    this.lastPrune = Date.now();
    try {
      const r = this.queue.prune(this.cfg.syncedRetentionDays, this.cfg.dedupeRetentionDays);
      if (r.pruned || r.forgotten) this.log.info(`queue prune: ${r.pruned} synced entries dropped (ids kept in dedupe index), ${r.forgotten} old dedupe ids forgotten`);
    } catch (e) {
      this.log.warn(`prune failed: ${(e as Error).message}`);
    }
  }
}
