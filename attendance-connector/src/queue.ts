/**
 * Crash-safe durable event queue, native-free.
 *
 * Storage = append-only JSONL write-ahead log (`queue.jsonl`), fsync after every write batch.
 * State is rebuilt by replaying the log at startup. A truncated/corrupt trailing line (crash mid-write)
 * is ignored and the log is then rewritten (compaction) through temp file + fsync + atomic rename.
 * Compaction also runs periodically, so the log never grows without bound.
 *
 * Log line types:
 *   {"op":"put","e":{...full entry...}}
 *   {"op":"set","ids":[...],"state":"syncing|pending|synced|failed","at":ms,"err":"..","inc":true}
 *   {"op":"prune","items":[[id,tsMs],...]}     entry dropped from the queue, id kept in dedupe index
 *   {"op":"dedupe","items":[[id,tsMs],...]}    compact dedupe index (written by compaction)
 *
 * Small mutable metadata (last fetched timestamp, last sync, ...) lives in `state.json` (atomic rewrite).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

export type EventState = 'pending' | 'syncing' | 'synced' | 'failed';

export interface QueueEvent {
  id: string;
  deviceUserId: string;
  /** ISO string with device offset, e.g. 2026-09-20T08:05:00+06:00 */
  timestamp: string;
  verifyType?: number;
  inOutState?: number;
  state: EventState;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

export interface QueueMeta {
  lastFetchedTimestamp?: string;
  lastFetchAt?: string;
  lastSyncAt?: string;
  lastSyncError?: string;
  lastDeviceContactAt?: string;
  lastDeviceError?: string;
  deviceOnline?: boolean;
}

export interface QueueCounts {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  dedupeIndex: number;
}

/** Deterministic event id: same punch re-read from the device always maps to the same id. */
export function makeEventId(
  deviceId: string,
  deviceUserId: string,
  timestamp: string,
  verifyType?: number,
  inOutState?: number,
): string {
  return createHash('sha256')
    .update(`${deviceId}|${deviceUserId}|${timestamp}|${verifyType ?? ''}|${inOutState ?? ''}`)
    .digest('hex')
    .slice(0, 32);
}

function fsyncDirBestEffort(dir: string): void {
  if (process.platform === 'win32') return; // directories cannot be opened for fsync on Windows
  try {
    const fd = fs.openSync(dir, 'r');
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    /* best effort */
  }
}

/** Atomic file write: temp file + fsync + rename. */
export function atomicWriteFile(file: string, data: string): void {
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
  fsyncDirBestEffort(path.dirname(file));
}

export interface QueueOpenOptions {
  readOnly?: boolean;
  /** take an exclusive pid lock (default true unless readOnly) */
  lock?: boolean;
  /** log growth threshold (lines beyond live entries) triggering compaction */
  compactSlack?: number;
}

export class QueueLockedError extends Error {}

function bootTimeSec(): number {
  return Math.round(Date.now() / 1000 - os.uptime());
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export class EventQueue {
  private entries = new Map<string, QueueEvent & { ts: number; seq: number }>();
  private dedupe = new Map<string, number>(); // id -> event timestamp ms
  private fd: number | null = null;
  private seq = 0;
  private logLines = 0;
  private lockFd: number | null = null;
  private meta: QueueMeta = {};
  readonly logFile: string;
  readonly metaFile: string;
  readonly lockFile: string;
  /** info about what happened while loading (for tests / logging) */
  loadInfo = { corruptLines: 0, recoveredSyncing: 0, incompleteTail: false };

  private constructor(readonly dir: string, private opts: QueueOpenOptions) {
    this.logFile = path.join(dir, 'queue.jsonl');
    this.metaFile = path.join(dir, 'state.json');
    this.lockFile = path.join(dir, 'queue.lock');
  }

  static open(dir: string, opts: QueueOpenOptions = {}): EventQueue {
    const q = new EventQueue(dir, opts);
    if (!opts.readOnly) fs.mkdirSync(dir, { recursive: true });
    if (!opts.readOnly && opts.lock !== false) q.acquireLock();
    try {
      q.load();
    } catch (e) {
      q.close();
      throw e;
    }
    return q;
  }

  private acquireLock(): void {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        this.lockFd = fs.openSync(this.lockFile, 'wx');
        fs.writeSync(this.lockFd, `${process.pid}:${bootTimeSec()}`);
        return;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        let pid = 0;
        let boot = 0;
        try {
          const [a, b] = fs.readFileSync(this.lockFile, 'utf8').trim().split(':');
          pid = Number(a);
          boot = Number(b);
        } catch {
          /* ignore */
        }
        // stale if the owner is dead, or the PC rebooted since (PIDs get reused after reboot)
        const sameBoot = !boot || Math.abs(boot - bootTimeSec()) < 120;
        if (pid && sameBoot && pidAlive(pid)) {
          throw new QueueLockedError(`queue is in use by another connector process (pid ${pid})`);
        }
        fs.rmSync(this.lockFile, { force: true }); // stale lock
      }
    }
    throw new QueueLockedError('could not acquire queue lock');
  }

  private load(): void {
    let text = '';
    if (fs.existsSync(this.logFile)) text = fs.readFileSync(this.logFile, 'utf8');
    if (text.length > 0) {
      const endsWithNewline = text.endsWith('\n');
      const lines = text.split('\n');
      if (!endsWithNewline) this.loadInfo.incompleteTail = true;
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          this.apply(JSON.parse(line));
          this.logLines++;
        } catch {
          this.loadInfo.corruptLines++;
        }
      }
    }
    if (fs.existsSync(this.metaFile)) {
      try {
        this.meta = JSON.parse(fs.readFileSync(this.metaFile, 'utf8'));
      } catch {
        this.meta = {}; // corrupt meta is not fatal: dedupe protects us
      }
    }
    if (this.opts.readOnly) return;
    // crash mid-send: 'syncing' can never be trusted -> back to pending (cloud dedupes on resend)
    const stuck: string[] = [];
    for (const e of this.entries.values()) if (e.state === 'syncing') stuck.push(e.id);
    this.loadInfo.recoveredSyncing = stuck.length;
    if (this.loadInfo.corruptLines > 0 || this.loadInfo.incompleteTail) {
      // rewrite so the next append never glues onto a broken tail
      for (const id of stuck) this.entries.get(id)!.state = 'pending';
      this.compact();
    } else {
      this.openLog();
      if (stuck.length) {
        const rec = { op: 'set', ids: stuck, state: 'pending', at: Date.now() };
        this.apply(rec);
        this.append([rec]);
      }
    }
  }

  private apply(rec: any): void {
    switch (rec.op) {
      case 'put': {
        const e = rec.e as QueueEvent;
        if (!e || !e.id) throw new Error('bad put');
        this.entries.set(e.id, { ...e, ts: Date.parse(e.timestamp) || 0, seq: this.seq++ });
        break;
      }
      case 'set': {
        for (const id of rec.ids as string[]) {
          const e = this.entries.get(id);
          if (!e) continue;
          e.state = rec.state;
          e.updatedAt = rec.at ?? e.updatedAt;
          if (rec.inc) e.attempts += 1;
          if (rec.err !== undefined) e.lastError = rec.err;
          if (rec.state === 'synced') {
            e.syncedAt = rec.at;
            e.lastError = undefined;
          }
        }
        break;
      }
      case 'prune':
      case 'dedupe': {
        for (const [id, ts] of rec.items as Array<[string, number]>) {
          if (rec.op === 'prune') this.entries.delete(id);
          this.dedupe.set(id, ts);
        }
        break;
      }
      default:
        throw new Error('unknown op');
    }
  }

  private openLog(): void {
    if (this.fd === null) this.fd = fs.openSync(this.logFile, 'a');
  }

  private append(recs: object[]): void {
    if (this.opts.readOnly) throw new Error('queue opened read-only');
    if (!recs.length) return;
    this.openLog();
    const data = recs.map((r) => JSON.stringify(r)).join('\n') + '\n';
    fs.writeSync(this.fd!, data);
    fs.fsyncSync(this.fd!);
    this.logLines += recs.length;
  }

  /** Rewrite the log from live state (temp + fsync + atomic rename). */
  compact(): void {
    if (this.opts.readOnly) return;
    const lines: string[] = [];
    for (const e of this.entries.values()) {
      const { ts: _ts, seq: _seq, ...plain } = e;
      lines.push(JSON.stringify({ op: 'put', e: plain }));
    }
    const items = [...this.dedupe.entries()];
    for (let i = 0; i < items.length; i += 1000) {
      lines.push(JSON.stringify({ op: 'dedupe', items: items.slice(i, i + 1000) }));
    }
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
    atomicWriteFile(this.logFile, lines.length ? lines.join('\n') + '\n' : '');
    this.logLines = lines.length;
    this.openLog();
  }

  private maybeCompact(): void {
    const slack = this.opts.compactSlack ?? 2000;
    if (this.logLines > this.entries.size + this.dedupe.size / 1000 + slack) this.compact();
  }

  /* ------------------------------------------------------------ queries */

  /** true if the id is queued (any state) or remembered in the dedupe index */
  has(id: string): boolean {
    return this.entries.has(id) || this.dedupe.has(id);
  }

  isSynced(id: string): boolean {
    const e = this.entries.get(id);
    return e ? e.state === 'synced' : this.dedupe.has(id);
  }

  get(id: string): QueueEvent | undefined {
    return this.entries.get(id);
  }

  counts(): QueueCounts {
    const c: QueueCounts = { pending: 0, syncing: 0, synced: 0, failed: 0, dedupeIndex: this.dedupe.size };
    for (const e of this.entries.values()) c[e.state]++;
    return c;
  }

  list(state?: EventState): QueueEvent[] {
    const out: QueueEvent[] = [];
    for (const e of this.entries.values()) if (!state || e.state === state) out.push(this.plain(e));
    return out;
  }

  private plain(e: QueueEvent & { ts: number; seq: number }): QueueEvent {
    const { ts: _t, seq: _s, ...p } = e;
    return { ...p };
  }

  getMeta(): QueueMeta {
    return { ...this.meta };
  }

  /* ---------------------------------------------------------- mutations */

  /** Enqueue events not already known. Durable (fsync) before returning. Returns the newly added events. */
  enqueue(
    events: Array<{ id: string; deviceUserId: string; timestamp: string; verifyType?: number; inOutState?: number }>,
  ): QueueEvent[] {
    const now = Date.now();
    const added: QueueEvent[] = [];
    const recs: object[] = [];
    for (const ev of events) {
      if (this.has(ev.id)) continue;
      const e: QueueEvent = {
        id: ev.id,
        deviceUserId: ev.deviceUserId,
        timestamp: ev.timestamp,
        verifyType: ev.verifyType,
        inOutState: ev.inOutState,
        state: 'pending',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      };
      recs.push({ op: 'put', e });
      this.entries.set(e.id, { ...e, ts: Date.parse(e.timestamp) || 0, seq: this.seq++ });
      added.push(e);
    }
    this.append(recs);
    return added;
  }

  /** Oldest pending events first (by punch time). Does not change state. */
  peekPending(limit: number): QueueEvent[] {
    const arr = [...this.entries.values()].filter((e) => e.state === 'pending');
    arr.sort((a, b) => a.ts - b.ts || a.seq - b.seq);
    return arr.slice(0, limit).map((e) => this.plain(e));
  }

  private setState(ids: string[], state: EventState, extra: { err?: string; inc?: boolean } = {}): void {
    const valid = ids.filter((id) => this.entries.has(id));
    if (!valid.length) return;
    const at = Date.now();
    const rec = { op: 'set', ids: valid, state, at, ...(extra.err !== undefined ? { err: extra.err } : {}), ...(extra.inc ? { inc: true } : {}) };
    this.apply(rec);
    this.append([rec]);
  }

  markSyncing(ids: string[]): void {
    this.setState(ids, 'syncing');
  }

  markSynced(ids: string[]): void {
    this.setState(ids, 'synced');
  }

  /** back to pending after a transient failure (attempts++). */
  release(ids: string[], err: string): void {
    this.setState(ids, 'pending', { err, inc: true });
  }

  markFailed(id: string, reason: string): void {
    this.setState([id], 'failed', { err: reason, inc: true });
  }

  /** reset failed events for another try; returns how many were reset */
  retryFailed(): number {
    const ids = [...this.entries.values()].filter((e) => e.state === 'failed').map((e) => e.id);
    if (ids.length) this.setState(ids, 'pending');
    return ids.length;
  }

  /** drop synced entries older than retention (their ids stay in the dedupe index) */
  prune(syncedRetentionDays: number, dedupeRetentionDays: number, now = Date.now()): { pruned: number; forgotten: number } {
    const cutoff = now - syncedRetentionDays * 86400000;
    const items: Array<[string, number]> = [];
    for (const e of this.entries.values()) {
      if (e.state === 'synced' && (e.syncedAt ?? e.updatedAt) <= cutoff) items.push([e.id, e.ts]);
    }
    let pruned = 0;
    if (items.length) {
      this.apply({ op: 'prune', items });
      this.append([{ op: 'prune', items }]);
      pruned = items.length;
    }
    // dedupe entries for very old punches are dropped at compaction time
    const dedupeCutoff = now - dedupeRetentionDays * 86400000;
    let forgotten = 0;
    for (const [id, ts] of this.dedupe) {
      if (ts && ts < dedupeCutoff) {
        this.dedupe.delete(id);
        forgotten++;
      }
    }
    if (forgotten) this.compact();
    else this.maybeCompact();
    return { pruned, forgotten };
  }

  setMeta(patch: Partial<QueueMeta>): void {
    if (this.opts.readOnly) return;
    this.meta = { ...this.meta, ...patch };
    try {
      atomicWriteFile(this.metaFile, JSON.stringify(this.meta));
    } catch {
      /* meta is best effort */
    }
  }

  close(): void {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        /* ignore */
      }
      this.fd = null;
    }
    if (this.lockFd !== null) {
      try {
        fs.closeSync(this.lockFd);
      } catch {
        /* ignore */
      }
      this.lockFd = null;
      fs.rmSync(this.lockFile, { force: true });
    }
  }
}
