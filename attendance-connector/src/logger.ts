import * as fs from 'node:fs';
import * as path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SECRET_KEY_RE = /(device[_-]?key|comm[_-]?(key|password)|password|passwd|secret|token|authorization|api[_-]?key|x-device-key)/i;
const secrets = new Set<string>();
export const REDACTED = '[REDACTED]';

/** Register a secret value so it is masked wherever it shows up in any log line. */
export function registerSecret(value: string | undefined | null): void {
  if (value && String(value).length >= 3) secrets.add(String(value));
}

export function clearSecrets(): void {
  secrets.clear();
}

/** Mask secrets inside free text. */
export function redactText(text: string): string {
  let out = text;
  for (const s of secrets) {
    if (s) out = out.split(s).join(REDACTED);
  }
  out = out.replace(/(x-device-key["']?\s*[:=]\s*["']?)([^\s"',}]+)/gi, `$1${REDACTED}`);
  out = out.replace(/(authorization["']?\s*[:=]\s*["']?)((?:Bearer|Basic)\s+)?([^\s"',}]+)/gi, `$1${REDACTED}`);
  out = out.replace(/(comm[_-]?(?:key|password)["']?\s*[:=]\s*["']?)([^\s"',}]+)/gi, `$1${REDACTED}`);
  out = out.replace(/(device[_-]?key["']?\s*[:=]\s*["']?)([^\s"',}]+)/gi, `$1${REDACTED}`);
  out = out.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{6,}/g, `$1${REDACTED}`);
  return out;
}

/** Deep-redact any value (objects, arrays, strings, Errors). Never mutates input. */
export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value !== 'object') return value;
  if (depth > 6) return '[depth]';
  if (value instanceof Error) return redactText(value.message);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY_RE.test(k) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

export interface LoggerOptions {
  dir?: string;
  level?: LogLevel;
  maxSizeBytes?: number;
  keep?: number;
  console?: boolean;
  fileName?: string;
}

export class Logger {
  private level: LogLevel;
  private dir?: string;
  private file?: string;
  private maxSize: number;
  private keep: number;
  private toConsole: boolean;
  private size = 0;

  constructor(opts: LoggerOptions = {}) {
    this.level = opts.level ?? 'info';
    this.dir = opts.dir;
    this.maxSize = opts.maxSizeBytes ?? 5 * 1024 * 1024;
    this.keep = Math.max(1, opts.keep ?? 5);
    this.toConsole = opts.console ?? true;
    if (this.dir) {
      try {
        fs.mkdirSync(this.dir, { recursive: true });
        this.file = path.join(this.dir, opts.fileName ?? 'connector.log');
        this.size = fs.existsSync(this.file) ? fs.statSync(this.file).size : 0;
      } catch {
        this.file = undefined; // logging must never crash the app
      }
    }
  }

  private rotate(): void {
    if (!this.file) return;
    try {
      fs.rmSync(`${this.file}.${this.keep}`, { force: true });
      for (let i = this.keep - 1; i >= 1; i--) {
        const from = `${this.file}.${i}`;
        if (fs.existsSync(from)) fs.renameSync(from, `${this.file}.${i + 1}`);
      }
      if (fs.existsSync(this.file)) fs.renameSync(this.file, `${this.file}.1`);
      this.size = 0;
    } catch {
      /* ignore */
    }
  }

  log(level: LogLevel, msg: string, meta?: unknown): void {
    if (ORDER[level] < ORDER[this.level]) return;
    let line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${redactText(msg)}`;
    if (meta !== undefined) {
      try {
        line += ' ' + JSON.stringify(redact(meta));
      } catch {
        /* ignore */
      }
    }
    if (this.toConsole) (level === 'error' || level === 'warn' ? console.error : console.log)(line);
    if (this.file) {
      try {
        const data = line + '\n';
        if (this.size + data.length > this.maxSize) this.rotate();
        fs.appendFileSync(this.file, data);
        this.size += data.length;
      } catch {
        /* disk full etc: never crash because of logging */
      }
    }
  }

  debug(m: string, meta?: unknown) {
    this.log('debug', m, meta);
  }
  info(m: string, meta?: unknown) {
    this.log('info', m, meta);
  }
  warn(m: string, meta?: unknown) {
    this.log('warn', m, meta);
  }
  error(m: string, meta?: unknown) {
    this.log('error', m, meta);
  }
}
