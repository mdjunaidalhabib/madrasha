'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { redact, redactText, registerSecret, clearSecrets, Logger, REDACTED } = require('../dist/logger');

test('redact masks secret-looking keys, headers and registered secrets', () => {
  clearSecrets();
  registerSecret('SuperSecretDeviceKey-9999');
  registerSecret('482913');
  const obj = {
    deviceKey: 'abc', device_key: 'abc', 'x-device-key': 'abc', Authorization: 'Bearer abcdef123456',
    comm_password: '482913', commKey: 1234, password: 'p', nested: { token: 't', ok: 'fine', arr: [{ secret: 's' }] },
    msg: 'header x-device-key: SuperSecretDeviceKey-9999 sent; comm 482913',
  };
  const r = JSON.stringify(redact(obj));
  for (const bad of ['abc"', 'abcdef123456', '482913', 'SuperSecretDeviceKey-9999', '"t"', '"p"', '"s"']) {
    assert.ok(!r.includes(bad), `leaked ${bad} in ${r}`);
  }
  assert.ok(r.includes('fine'));
  assert.ok(r.includes(REDACTED));
  clearSecrets();
});

test('redactText handles header/JSON/query shaped strings', () => {
  clearSecrets();
  assert.ok(!redactText('x-device-key: k3y-value-123').includes('k3y-value-123'));
  assert.ok(!redactText('{"deviceKey":"k3y-value-123"}').includes('k3y-value-123'));
  assert.ok(!redactText('Authorization: Bearer eyJhbGciOi.payload.sig').includes('eyJhbGciOi'));
  assert.ok(!redactText('comm_password=778899').includes('778899'));
  assert.equal(redactText('plain message 42'), 'plain message 42');
});

test('Logger never writes secrets to file, rotates by size and keeps N files', () => {
  clearSecrets();
  registerSecret('TOPSECRET-KEY-1');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conn-log-'));
  const log = new Logger({ dir, level: 'debug', maxSizeBytes: 600, keep: 3, console: false });
  for (let i = 0; i < 60; i++) log.info(`line ${i} key=TOPSECRET-KEY-1 x-device-key: TOPSECRET-KEY-1`, { deviceKey: 'TOPSECRET-KEY-1', n: i });
  const files = fs.readdirSync(dir).sort();
  assert.deepEqual(files, ['connector.log', 'connector.log.1', 'connector.log.2', 'connector.log.3']);
  for (const f of files) assert.ok(!fs.readFileSync(path.join(dir, f), 'utf8').includes('TOPSECRET-KEY-1'));
  const quiet = new Logger({ dir, level: 'warn', console: false });
  quiet.info('should not appear XYZ');
  assert.ok(!fs.readFileSync(path.join(dir, 'connector.log'), 'utf8').includes('should not appear XYZ'));
  clearSecrets();
  fs.rmSync(dir, { recursive: true, force: true });
});
