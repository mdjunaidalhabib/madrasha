import * as fs from 'node:fs';
import * as path from 'node:path';
import { readProtectedFile } from './secret';

export interface RetryConfig {
  baseSec: number;
  maxSec: number;
  jitter: number; // 0..1 fraction
}

export interface DeviceOverride {
  ip?: string;
  port?: number;
  commKey?: number;
}

export interface AppConfig {
  apiBaseUrl: string;
  allowInsecureHttp: boolean;
  madrasaSlug: string;
  institutionId: number;
  deviceId: string;
  /** resolved secret (env > protected file > plain config). Never logged. */
  deviceKey: string;
  deviceKeySource: 'env' | 'file' | 'config' | 'none';
  deviceKeyFile?: string;
  /** directory holding queue.jsonl, state.json and cached cloud config */
  localQueuePath: string;
  logDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logMaxSizeMB: number;
  logKeep: number;
  pollIntervalSec: number;
  /** when true (default) poll_interval_sec from the cloud config wins over pollIntervalSec */
  preferCloudSettings: boolean;
  batchSize: number;
  retry: RetryConfig;
  /** seconds to back off after 401/403 (bad credentials) */
  authBackoffSec: number;
  device?: DeviceOverride;
  deviceTimezoneOffset: string;
  clearDeviceLogsAfterSync: boolean;
  disableDeviceDuringRead: boolean;
  resolveUserIds: boolean;
  syncedRetentionDays: number;
  dedupeRetentionDays: number;
  connectTimeoutMs: number;
  commandTimeoutMs: number;
  httpTimeoutMs: number;
  /** poll interval used while the K40 is unreachable is derived from retry backoff */
  configDir: string;
}

export const DEFAULTS = {
  allowInsecureHttp: false,
  localQueuePath: './data',
  logDir: './logs',
  logLevel: 'info' as const,
  logMaxSizeMB: 5,
  logKeep: 5,
  pollIntervalSec: 30,
  preferCloudSettings: true,
  batchSize: 200,
  retry: { baseSec: 5, maxSec: 300, jitter: 0.2 },
  authBackoffSec: 900,
  deviceTimezoneOffset: '+06:00',
  clearDeviceLogsAfterSync: false,
  disableDeviceDuringRead: false,
  resolveUserIds: true,
  syncedRetentionDays: 7,
  dedupeRetentionDays: 400,
  connectTimeoutMs: 10000,
  commandTimeoutMs: 15000,
  httpTimeoutMs: 20000,
};

export function defaultConfigPath(): string {
  if (process.env.CONNECTOR_CONFIG) return path.resolve(process.env.CONNECTOR_CONFIG);
  const exeDir = (process as unknown as { pkg?: unknown }).pkg ? path.dirname(process.execPath) : process.cwd();
  return path.join(exeDir, 'config.json');
}

export function isLocalHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

export function validateApiBaseUrl(raw: string, allowInsecureHttp: boolean): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`apiBaseUrl is not a valid URL: ${raw}`);
  }
  if (u.protocol === 'https:') {
    /* ok */
  } else if (u.protocol === 'http:') {
    if (!(allowInsecureHttp && isLocalHost(u.hostname))) {
      throw new Error(
        'apiBaseUrl must be https:// (http is refused; it is only permitted with allowInsecureHttp=true AND host localhost, for tests)',
      );
    }
  } else {
    throw new Error(`apiBaseUrl must be https:// (got ${u.protocol})`);
  }
  let s = u.toString().replace(/\/+$/, '');
  if (s.endsWith('/api')) s = s.slice(0, -4);
  return s;
}

function resolvePath(base: string, p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(base, p);
}

function num(v: unknown, def: number, name: string, min = 0): number {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new Error(`config.${name} must be a number >= ${min}`);
  return n;
}

function validateOffset(o: string): string {
  if (!/^[+-]\d{2}:\d{2}$/.test(o)) throw new Error('deviceTimezoneOffset must look like "+06:00"');
  return o;
}

/** Build a validated AppConfig from raw JSON-ish input (also used by tests). Secrets are passed in already resolved. */
export function buildConfig(
  raw: Record<string, any>,
  baseDir: string,
  deviceKey: string,
  deviceKeySource: AppConfig['deviceKeySource'],
): AppConfig {
  const allowInsecureHttp = raw.allowInsecureHttp === true;
  if (!raw.apiBaseUrl) throw new Error('config.apiBaseUrl is required');
  if (!raw.madrasaSlug) throw new Error('config.madrasaSlug is required');
  if (!raw.deviceId) throw new Error('config.deviceId is required');
  const institutionId = Number(raw.institutionId);
  if (!Number.isInteger(institutionId) || institutionId <= 0) throw new Error('config.institutionId must be a positive integer');
  const retry = { ...DEFAULTS.retry, ...(raw.retry ?? {}) };
  const dev = raw.device && typeof raw.device === 'object' ? raw.device : undefined;
  const cfg: AppConfig = {
    apiBaseUrl: validateApiBaseUrl(String(raw.apiBaseUrl), allowInsecureHttp),
    allowInsecureHttp,
    madrasaSlug: String(raw.madrasaSlug),
    institutionId,
    deviceId: String(raw.deviceId),
    deviceKey,
    deviceKeySource,
    deviceKeyFile: raw.deviceKeyFile ? resolvePath(baseDir, String(raw.deviceKeyFile)) : undefined,
    localQueuePath: resolvePath(baseDir, raw.localQueuePath ?? DEFAULTS.localQueuePath),
    logDir: resolvePath(baseDir, raw.logDir ?? DEFAULTS.logDir),
    logLevel: raw.logLevel ?? DEFAULTS.logLevel,
    logMaxSizeMB: num(raw.logMaxSizeMB, DEFAULTS.logMaxSizeMB, 'logMaxSizeMB', 0.001),
    logKeep: num(raw.logKeep, DEFAULTS.logKeep, 'logKeep', 1),
    pollIntervalSec: num(raw.pollIntervalSec, DEFAULTS.pollIntervalSec, 'pollIntervalSec', 0.05),
    preferCloudSettings: raw.preferCloudSettings ?? DEFAULTS.preferCloudSettings,
    batchSize: Math.floor(num(raw.batchSize, DEFAULTS.batchSize, 'batchSize', 1)),
    retry: {
      baseSec: num(retry.baseSec, 5, 'retry.baseSec', 0.001),
      maxSec: num(retry.maxSec, 300, 'retry.maxSec', 0.001),
      jitter: num(retry.jitter, 0.2, 'retry.jitter', 0),
    },
    authBackoffSec: num(raw.authBackoffSec, DEFAULTS.authBackoffSec, 'authBackoffSec', 0.001),
    device: dev
      ? {
          ip: dev.ip ? String(dev.ip) : undefined,
          port: dev.port !== undefined ? Number(dev.port) : undefined,
          commKey: dev.commKey !== undefined && dev.commKey !== null && dev.commKey !== '' ? Number(dev.commKey) : undefined,
        }
      : undefined,
    deviceTimezoneOffset: validateOffset(raw.deviceTimezoneOffset ?? DEFAULTS.deviceTimezoneOffset),
    clearDeviceLogsAfterSync: raw.clearDeviceLogsAfterSync === true,
    disableDeviceDuringRead: raw.disableDeviceDuringRead === true,
    resolveUserIds: raw.resolveUserIds !== false,
    syncedRetentionDays: num(raw.syncedRetentionDays, DEFAULTS.syncedRetentionDays, 'syncedRetentionDays', 0),
    dedupeRetentionDays: num(raw.dedupeRetentionDays, DEFAULTS.dedupeRetentionDays, 'dedupeRetentionDays', 1),
    connectTimeoutMs: num(raw.connectTimeoutMs, DEFAULTS.connectTimeoutMs, 'connectTimeoutMs', 10),
    commandTimeoutMs: num(raw.commandTimeoutMs, DEFAULTS.commandTimeoutMs, 'commandTimeoutMs', 10),
    httpTimeoutMs: num(raw.httpTimeoutMs, DEFAULTS.httpTimeoutMs, 'httpTimeoutMs', 10),
    configDir: baseDir,
  };
  if (cfg.device?.commKey !== undefined && !Number.isFinite(cfg.device.commKey)) throw new Error('config.device.commKey must be numeric');
  return cfg;
}

/** Load config.json + resolve the device key (env DEVICE_KEY > protected file > plaintext config field). */
export async function loadConfig(file = defaultConfigPath(), opts: { requireKey?: boolean } = {}): Promise<AppConfig> {
  const requireKey = opts.requireKey !== false;
  if (!fs.existsSync(file)) throw new Error(`config file not found: ${file} (run "connector setup" or set CONNECTOR_CONFIG)`);
  let raw: Record<string, any>;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new Error(`config file is not valid JSON: ${(e as Error).message}`);
  }
  const baseDir = path.dirname(path.resolve(file));
  let key = '';
  let src: AppConfig['deviceKeySource'] = 'none';
  if (process.env.DEVICE_KEY) {
    key = process.env.DEVICE_KEY;
    src = 'env';
  } else if (raw.deviceKeyFile && requireKey) {
    const kf = resolvePath(baseDir, String(raw.deviceKeyFile));
    if (!fs.existsSync(kf)) throw new Error(`deviceKeyFile not found: ${kf} (run "connector setup")`);
    key = (await readProtectedFile(kf)).trim();
    src = 'file';
  } else if (raw.deviceKey && requireKey) {
    key = String(raw.deviceKey);
    src = 'config';
  }
  if (!key && requireKey) throw new Error('device key missing: set env DEVICE_KEY, or run "connector setup" (deviceKeyFile)');
  return buildConfig(raw, baseDir, key, src);
}
