/**
 * Protect / unprotect the device key with Windows DPAPI via PowerShell.
 *
 * Two scopes:
 *  - "machine" (default for setup): System.Security ProtectedData LocalMachine. Works for a service running as
 *    SYSTEM and for any admin on THIS PC. Cannot be decrypted on another PC.
 *  - "user": ConvertTo/From-SecureString (CurrentUser). Only the same Windows user can read it - so the
 *    scheduled task must run as that user, NOT as SYSTEM.
 *
 * The secret is passed to PowerShell via an environment variable (never on the command line).
 */
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MACHINE_PREFIX = 'dpapi-machine:v1:';
const USER_PREFIX = 'dpapi-user:v1:';

function ps(script: string, env: Record<string, string>): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { env: { ...process.env, ...env }, timeout: 30000, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`PowerShell failed: ${(stderr || err.message).toString().slice(0, 200)}`));
        resolve(stdout.toString().trim());
      },
    );
  });
}

export function dpapiAvailable(): boolean {
  return process.platform === 'win32';
}

export type ProtectScope = 'machine' | 'user';

export async function protectSecret(plain: string, scope: ProtectScope = 'machine'): Promise<string> {
  if (!dpapiAvailable()) throw new Error('Windows DPAPI is only available on Windows');
  if (scope === 'machine') {
    const out = await ps(
      `[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.Security
$b=[Text.Encoding]::UTF8.GetBytes($env:CONNECTOR_TMP_SECRET)
$p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::LocalMachine)
[Convert]::ToBase64String($p)`,
      { CONNECTOR_TMP_SECRET: plain },
    );
    return MACHINE_PREFIX + out;
  }
  const out = await ps(
    `ConvertTo-SecureString -String $env:CONNECTOR_TMP_SECRET -AsPlainText -Force | ConvertFrom-SecureString`,
    { CONNECTOR_TMP_SECRET: plain },
  );
  return USER_PREFIX + out;
}

export async function unprotectSecret(blob: string): Promise<string> {
  if (!dpapiAvailable()) throw new Error('Windows DPAPI is only available on Windows');
  const text = blob.trim();
  if (text.startsWith(MACHINE_PREFIX)) {
    return ps(
      `[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.Security
$p=[Convert]::FromBase64String($env:CONNECTOR_TMP_SECRET)
$b=[Security.Cryptography.ProtectedData]::Unprotect($p,$null,[Security.Cryptography.DataProtectionScope]::LocalMachine)
[Text.Encoding]::UTF8.GetString($b)`,
      { CONNECTOR_TMP_SECRET: text.slice(MACHINE_PREFIX.length) },
    );
  }
  const data = text.startsWith(USER_PREFIX) ? text.slice(USER_PREFIX.length) : text; // bare ConvertFrom-SecureString output
  return ps(
    `[Console]::OutputEncoding=[Text.Encoding]::UTF8
$s = ConvertTo-SecureString $env:CONNECTOR_TMP_SECRET
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }`,
    { CONNECTOR_TMP_SECRET: data },
  );
}

export async function writeProtectedFile(file: string, plain: string, scope: ProtectScope = 'machine'): Promise<void> {
  const blob = await protectSecret(plain, scope);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, blob, { encoding: 'utf8', mode: 0o600 });
}

export async function readProtectedFile(file: string): Promise<string> {
  return unprotectSecret(fs.readFileSync(file, 'utf8'));
}
