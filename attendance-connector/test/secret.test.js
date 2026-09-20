'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { protectSecret, unprotectSecret, writeProtectedFile, readProtectedFile } = require('../dist/secret');
const { tmpDir } = require('./helpers');

const win = process.platform === 'win32';

test('DPAPI machine-scope roundtrip via PowerShell (Windows only)', { skip: !win }, async () => {
  const blob = await protectSecret('my-secret-key-Ω-123', 'machine');
  assert.ok(blob.startsWith('dpapi-machine:v1:'));
  assert.ok(!blob.includes('my-secret-key'));
  assert.equal(await unprotectSecret(blob), 'my-secret-key-Ω-123');
});

test('DPAPI user-scope roundtrip (ConvertFrom-SecureString) and file helpers (Windows only)', { skip: !win }, async () => {
  const file = path.join(tmpDir(), 'secrets', 'device.key');
  await writeProtectedFile(file, 'another-key-456', 'user');
  assert.ok(!fs.readFileSync(file, 'utf8').includes('another-key-456'));
  assert.equal(await readProtectedFile(file), 'another-key-456');
});
