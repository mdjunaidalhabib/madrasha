'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FakeK40 } = require('../tools/fake-k40');
const { FakeCloud } = require('../tools/fake-cloud');
const { buildConfig } = require('../dist/config');
const { Logger } = require('../dist/logger');
const { Connector } = require('../dist/connector');

function tmpDir(prefix = 'conn-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function waitFor(fn, timeoutMs = 10000, what = 'condition', stepMs = 25) {
  const t0 = Date.now();
  for (;;) {
    let v;
    try { v = await fn(); } catch { v = false; }
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${what}`);
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

/** Boots a fake K40 + fake cloud and returns a fast-polling config. */
async function makeEnv(o = {}) {
  const dir = o.dir || tmpDir();
  const k40 = new FakeK40({ commKey: o.commKey || 0, format: o.format || 40, ...(o.k40 || {}) });
  const k40Port = await k40.start();
  const cloud = new FakeCloud({ port: k40Port, commPassword: o.commKey ? String(o.commKey) : null, ...(o.cloud || {}) });
  await cloud.start();
  const raw = {
    apiBaseUrl: cloud.url,
    allowInsecureHttp: true,
    madrasaSlug: cloud.slug,
    institutionId: cloud.institutionId,
    deviceId: cloud.deviceId,
    localQueuePath: path.join(dir, 'data'),
    logDir: path.join(dir, 'logs'),
    logLevel: 'debug',
    pollIntervalSec: 0.15,
    preferCloudSettings: false,
    batchSize: o.batchSize || 200,
    retry: { baseSec: 0.1, maxSec: 0.4, jitter: 0 },
    authBackoffSec: o.authBackoffSec || 60,
    httpTimeoutMs: 2000,
    connectTimeoutMs: 1000,
    commandTimeoutMs: 2000,
    ...(o.config || {}),
  };
  if (o.localDevice) raw.device = { ip: '127.0.0.1', port: k40Port, commKey: o.commKey || 0 };
  const cfg = buildConfig(raw, dir, cloud.deviceKey, 'env');
  const log = new Logger({ dir: cfg.logDir, level: 'debug', console: false });
  const connectors = [];
  const newConnector = (extra = {}) => {
    const c = new Connector(cfg, log, { protectCache: false, ...extra });
    connectors.push(c);
    return c;
  };
  const cleanup = async () => {
    for (const c of connectors) await c.stop().catch(() => {});
    await k40.stop();
    await cloud.stop();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  };
  return { dir, k40, cloud, cfg, log, newConnector, cleanup };
}

module.exports = { tmpDir, waitFor, makeEnv };
