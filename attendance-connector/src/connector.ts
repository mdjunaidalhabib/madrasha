import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AppConfig } from './config';
import { CloudClient, CONNECTOR_VERSION, type CloudDeviceConfig, type IngestEventPayload, type IngestResult } from './cloud';
import { Logger, registerSecret } from './logger';
import { atomicWriteFile, EventQueue, makeEventId, type QueueEvent } from './queue';
import { dpapiAvailable, protectSecret, unprotectSecret } from './secret';
import { ZKClient, ZKError, zkTimeToIso, zkTimeToText, type RawPunch, type ZkTime } from './protocol';

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

/** One connect -> read -> close session. Always re-enables the device and closes the session. */
export async function readDevicePunches(
  cfg: AppConfig,
  s: DeviceSettings,
  log: Logger,
  opts: { disable?: boolean; afterRead?: (client: ZKClient, punches: RawPunch[], truncated: boolean) => Promise<void> } = {},
): Promise<{ punches: RawPunch[]; recordSize: number; truncated: boolean; deviceTime?: ZkTime }> {
  const client = new ZKClient({
    host: s.ip,
    port: s.port,
    commKey: s.commKey,
    connectTimeoutMs: cfg.connectTimeoutMs,
    timeoutMs: cfg.commandTimeoutMs,
    debug: (m) => log.debug(`zk: ${m}`),
  });
  try {
    await client.connect();
    log.info(`k40 connected ${s.ip}:${s.port}`);
    let deviceTime: ZkTime | undefined;
    try {
      deviceTime = await client.getTime();
    } catch (e) {
      log.debug(`get time failed: ${(e as Error).message}`);
    }
    if (opts.disable) await client.disableDevice();
    const r = await client.getAttendance(cfg.resolveUserIds);
    if (opts.afterRead) await opts.afterRead(client, r.punches, r.truncated);
    return { ...r, deviceTime };
  } finally {
    await client.close();
    log.info('k40 disconnected');
  }
}

export async function testDevice(cfg: AppConfig, s: DeviceSettings, log: Logger): Promise<{ time: ZkTime; name?: string; users?: number; records?: number }> {
  const client = new ZKClient({
    host: s.ip,
    port: s.port,
    commKey: s.commKey,
    connectTimeoutMs: cfg.connectTimeoutMs,
    timeoutMs: cfg.commandTimeoutMs,
    debug: (m) => log.debug(`zk: ${m}`),
  });
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

  constructor(readonly cfg: AppConfig, readonly log: Logger, private opts: ConnectorOptions = {}) {
    this.cloud = new CloudClient(cfg);
    registerSecret(cfg.deviceKey);
    if (cfg.device?.commKey !== undefined) this.registerComm(cfg.device.commKey);
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
    this.loops = [this.fetchLoop(), this.syncLoop()];
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
      if (res.deviceTime) {
        const drift = deviceDriftSec(res.deviceTime, this.cfg.deviceTimezoneOffset);
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
    const body = {
      device_id: this.cfg.deviceId,
      device_status: (this.deviceOnline ? 'online' : 'offline') as 'online' | 'offline',
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
      this.logChanged('hb', 'info', 'heartbeat ok');
      this.log.debug(`heartbeat sent (${body.device_status})`);
    } else {
      this.stats.heartbeatsFailed++;
      if (r.kind === 'auth') this.blockAuth('heartbeat', r.status, r.error ?? '');
      else this.logChanged('hb', 'warn', `heartbeat failed: ${r.error}`);
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
