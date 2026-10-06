'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { encodePairingToken, parsePairingToken } = require('../dist/pairing');
const { loadConfig } = require('../dist/config');
const { tmpDir } = require('./helpers');

const win = process.platform === 'win32';
const CLI = path.join(__dirname, '..', 'dist', 'cli.js');
const sample = { url: 'https://example.com', slug: 'darul-ulum', inst: 7, dev: 'K40-01', key: 'adk_TEST_secret_ABC+/=123' };

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function runSetup(cfgPath, args, env = {}) {
  const e = { ...process.env, CONNECTOR_CONFIG: cfgPath, ...env };
  delete e.DEVICE_KEY;
  if (!('PAIRING_TOKEN' in env)) delete e.PAIRING_TOKEN;
  return spawnSync(process.execPath, [CLI, 'setup', ...args], { env: e, encoding: 'utf8', input: '', timeout: 60000 });
}

test('pairing: encode/parse roundtrip matches the shared contract', () => {
  const t = encodePairingToken(sample);
  assert.ok(t.startsWith('ADC1.'));
  assert.ok(!/[+/=]/.test(t.slice(5)), 'base64url without padding');
  assert.equal(t, 'ADC1.' + b64url({ v: 1, ...sample }));
  assert.deepEqual(parsePairingToken(t), { v: 1, ...sample });
});

test('pairing: encode strips trailing /api and slash', () => {
  const t = encodePairingToken({ ...sample, url: 'https://example.com/api/' });
  assert.equal(parsePairingToken(t).url, 'https://example.com');
});

test('pairing: tolerates whitespace/newlines and = padding', () => {
  const t = encodePairingToken(sample);
  const wrapped = `  \r\n${t.slice(0, 20)}\n${t.slice(20, 50)}\r\n ${t.slice(50)}\n\t `;
  assert.equal(parsePairingToken(wrapped).key, sample.key);
  const body = Buffer.from(JSON.stringify({ v: 1, ...sample })).toString('base64'); // standard, padded
  assert.equal(parsePairingToken('ADC1.' + body).dev, 'K40-01');
});

test('pairing: rejects wrong prefix / version / damaged / missing fields', () => {
  const t = encodePairingToken(sample);
  assert.throws(() => parsePairingToken(''), /empty/);
  assert.throws(() => parsePairingToken('ADC2.' + t.slice(5)), /must start with "ADC1\."/);
  assert.throws(() => parsePairingToken(t.slice(5)), /must start with/);
  assert.throws(() => parsePairingToken('ADC1.' + b64url({ ...sample, v: 2 })), /unsupported pairing code version 2/);
  assert.throws(() => parsePairingToken('ADC1.' + b64url(sample)), /version/);
  assert.throws(() => parsePairingToken('ADC1.!!!'), /invalid characters/);
  assert.throws(() => parsePairingToken('ADC1.' + 'abc'), /damaged/);
  const { key, slug, ...noKey } = sample;
  assert.throws(() => parsePairingToken('ADC1.' + b64url({ v: 1, ...noKey })), /missing field\(s\): slug, key/);
  assert.throws(() => parsePairingToken('ADC1.' + b64url({ v: 1, ...sample, inst: 'x' })), /positive integer/);
  assert.throws(() => parsePairingToken('ADC1.' + b64url({ v: 1, ...sample, inst: undefined })), /missing field\(s\): inst/);
});

test('setup --token: non-interactive config + DPAPI key file, merges existing config', async () => {
  const dir = tmpDir('conn-pair-');
  try {
    const cfgPath = path.join(dir, 'config.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ apiBaseUrl: 'https://old.example', madrasaSlug: 'old', institutionId: 1, deviceId: 'x', pollIntervalSec: 45, device: { ip: '10.0.0.5', port: 4370, commKey: 0 } }));
    const r = runSetup(cfgPath, ['--token', encodePairingToken(sample)]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /SETUP OK/);
    assert.ok(!(r.stdout + r.stderr).includes(sample.key), 'key must never be printed');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.equal(cfg.apiBaseUrl, 'https://example.com');
    assert.equal(cfg.madrasaSlug, 'darul-ulum');
    assert.equal(cfg.institutionId, 7);
    assert.equal(cfg.deviceId, 'K40-01');
    assert.equal(cfg.pollIntervalSec, 45, 'existing values kept');
    assert.equal(cfg.device.ip, '10.0.0.5', 'existing local K40 override kept');
    assert.ok(!JSON.stringify(cfg).includes(sample.key));
    if (win) {
      const kf = path.join(dir, 'secrets', 'device.key');
      assert.ok(!fs.readFileSync(kf, 'utf8').includes(sample.key));
      const prev = process.env.DEVICE_KEY;
      delete process.env.DEVICE_KEY;
      try {
        const loaded = await loadConfig(cfgPath);
        assert.equal(loaded.deviceKey, sample.key);
        assert.equal(loaded.deviceKeySource, 'file');
      } finally {
        if (prev !== undefined) process.env.DEVICE_KEY = prev;
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('setup: PAIRING_TOKEN env works; bad token and http URL exit 1 without writing config', () => {
  const dir = tmpDir('conn-pair-');
  try {
    const cfgPath = path.join(dir, 'config.json');
    let r = runSetup(cfgPath, ['--token', 'ADC1.garbage']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /invalid pairing code/);
    r = runSetup(cfgPath, ['--token']);
    assert.equal(r.status, 1);
    r = runSetup(cfgPath, ['--token', encodePairingToken({ ...sample, url: 'http://example.com' })]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /https/);
    assert.ok(!fs.existsSync(cfgPath));
    if (!win) return; // the rest writes a DPAPI key file
    r = runSetup(cfgPath, [], { PAIRING_TOKEN: `\n ${encodePairingToken(sample)} \n` });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(JSON.parse(fs.readFileSync(cfgPath, 'utf8')).deviceId, 'K40-01');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('setup interactive: pairing code typed at the first prompt (Windows only)', { skip: !win }, () => {
  const dir = tmpDir('conn-pair-');
  try {
    const cfgPath = path.join(dir, 'config.json');
    const e = { ...process.env, CONNECTOR_CONFIG: cfgPath };
    delete e.DEVICE_KEY;
    delete e.PAIRING_TOKEN;
    const r = spawnSync(process.execPath, [CLI, 'setup'], { env: e, encoding: 'utf8', input: encodePairingToken(sample) + '\n', timeout: 60000 });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Pairing code from admin panel/);
    assert.equal(JSON.parse(fs.readFileSync(cfgPath, 'utf8')).madrasaSlug, 'darul-ulum');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
