/**
 * ZKTeco proprietary protocol over TCP (own implementation, no third-party SDK).
 *
 * Modelled on the open protocol as documented by pyzk / node-zklib / zkteco-js.
 * VERIFIED ONLY AGAINST tools/fake-k40.js (which was written from the same
 * knowledge) - NOT against real K40 hardware. See README "Verification status".
 *
 * TCP framing:
 *   [0x50 0x50 0x82 0x7D]  magic (u16 0x5050, u16 0x7D82 little endian)
 *   [u32 LE]               length of what follows
 *   [u16 command][u16 checksum][u16 session_id][u16 reply_id]   8 byte header
 *   [data...]
 */
import * as net from 'node:net';

export const CMD = {
  CONNECT: 1000,
  EXIT: 1001,
  ENABLE_DEVICE: 1002,
  DISABLE_DEVICE: 1003,
  AUTH: 1102,
  GET_FREE_SIZES: 50,
  OPTIONS_RRQ: 11,
  USERTEMP_RRQ: 9,
  ATTLOG_RRQ: 13,
  CLEAR_ATTLOG: 15,
  GET_TIME: 201,
  PREPARE_DATA: 1500,
  DATA: 1501,
  FREE_DATA: 1502,
  DATA_WRRQ: 1503,
  READ_BUFFER: 1504,
  ACK_OK: 2000,
  ACK_ERROR: 2001,
  ACK_DATA: 2002,
  ACK_RETRY: 2003,
  ACK_REPEAT: 2004,
  ACK_UNAUTH: 2005,
} as const;

export const MAGIC1 = 0x5050;
export const MAGIC2 = 0x7d82;
export const USHRT_MAX = 65535;
/** Max chunk requested per CMD_READ_BUFFER over TCP (same as pyzk). */
export const MAX_CHUNK = 0xffc0;
const MAX_PACKET = 32 * 1024 * 1024;

export type ZKErrorCode =
  | 'CONNECT_FAILED'
  | 'TIMEOUT'
  | 'AUTH_FAILED'
  | 'PROTOCOL'
  | 'CLOSED'
  | 'DEVICE_ERROR';

export class ZKError extends Error {
  constructor(public code: ZKErrorCode, message: string) {
    super(message);
    this.name = 'ZKError';
  }
}

/** One's-complement style 16 bit checksum used by ZK devices (mod 65535). */
export function checksum(buf: Buffer): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 2) {
    if (i === buf.length - 1) sum += buf[i];
    else sum += buf.readUInt16LE(i);
    sum %= USHRT_MAX;
  }
  return USHRT_MAX - sum - 1;
}

/**
 * Build a full TCP packet (8 byte TCP prefix + 8 byte command header + data).
 * Like pyzk/node-zklib, the checksum is computed with the current reply id and
 * the reply id carried in the packet is then incremented (known quirk of the
 * reference implementations, devices accept it).
 */
export function buildPacket(
  command: number,
  sessionId: number,
  replyId: number,
  data: Buffer = Buffer.alloc(0),
): { packet: Buffer; nextReplyId: number } {
  const body = Buffer.alloc(8 + data.length);
  body.writeUInt16LE(command, 0);
  body.writeUInt16LE(0, 2);
  body.writeUInt16LE(sessionId, 4);
  body.writeUInt16LE(replyId & 0xffff, 6);
  data.copy(body, 8);
  body.writeUInt16LE(checksum(body), 2);
  const next = (replyId + 1) % USHRT_MAX;
  body.writeUInt16LE(next, 6);
  const prefix = Buffer.alloc(8);
  prefix.writeUInt16LE(MAGIC1, 0);
  prefix.writeUInt16LE(MAGIC2, 2);
  prefix.writeUInt32LE(body.length, 4);
  return { packet: Buffer.concat([prefix, body]), nextReplyId: next };
}

export interface ZKPacket {
  command: number;
  checksum: number;
  sessionId: number;
  replyId: number;
  data: Buffer;
}

/** Incremental TCP stream -> packets parser (handles fragmentation, coalescing, garbage resync). */
export class PacketReader {
  private buf: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): void {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
  }

  pop(): ZKPacket | null {
    for (;;) {
      if (this.buf.length < 8) return null;
      if (this.buf.readUInt16LE(0) !== MAGIC1 || this.buf.readUInt16LE(2) !== MAGIC2) {
        // resync: drop bytes up to next possible magic
        const idx = this.buf.indexOf(Buffer.from([0x50, 0x50, 0x82, 0x7d]), 1);
        this.buf = idx === -1 ? this.buf.subarray(Math.max(0, this.buf.length - 3)) : this.buf.subarray(idx);
        if (idx === -1) return null;
        continue;
      }
      const len = this.buf.readUInt32LE(4);
      if (len < 8 || len > MAX_PACKET) {
        this.buf = this.buf.subarray(4); // corrupt length, resync
        continue;
      }
      if (this.buf.length < 8 + len) return null;
      const body = this.buf.subarray(8, 8 + len);
      this.buf = this.buf.subarray(8 + len);
      return {
        command: body.readUInt16LE(0),
        checksum: body.readUInt16LE(2),
        sessionId: body.readUInt16LE(4),
        replyId: body.readUInt16LE(6),
        data: Buffer.from(body.subarray(8)),
      };
    }
  }
}

/** Communication-key scramble sent with CMD_AUTH (pyzk make_commkey). */
export function makeCommKey(key: number, sessionId: number, ticks = 50): Buffer {
  let k = 0;
  const key32 = key >>> 0;
  for (let i = 0; i < 32; i++) {
    k = ((k << 1) | ((key32 >>> i) & 1)) >>> 0;
  }
  k = (k + sessionId) >>> 0;
  const b = [k & 0xff, (k >>> 8) & 0xff, (k >>> 16) & 0xff, (k >>> 24) & 0xff];
  const x = [b[0] ^ 0x5a, b[1] ^ 0x4b, b[2] ^ 0x53, b[3] ^ 0x4f]; // 'Z','K','S','O'
  // swap the two u16 halves
  const s = [x[2], x[3], x[0], x[1]];
  const t = ticks & 0xff;
  return Buffer.from([s[0] ^ t, s[1] ^ t, t, s[3] ^ t]);
}

/* ------------------------------------------------------------------ time */

export interface ZkTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function decodeTime(t: number): ZkTime {
  let v = t >>> 0;
  const second = v % 60;
  v = Math.floor(v / 60);
  const minute = v % 60;
  v = Math.floor(v / 60);
  const hour = v % 24;
  v = Math.floor(v / 24);
  const day = (v % 31) + 1;
  v = Math.floor(v / 31);
  const month = (v % 12) + 1;
  v = Math.floor(v / 12);
  return { year: v + 2000, month, day, hour, minute, second };
}

export function encodeTime(t: ZkTime): number {
  return (
    (((t.year % 100) * 12 * 31 + (t.month - 1) * 31 + t.day - 1) * 24 * 60 * 60 +
      (t.hour * 60 + t.minute) * 60 +
      t.second) >>>
    0
  );
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** ISO-8601 string carrying the device's local offset, e.g. 2026-09-20T08:05:00+06:00 */
export function zkTimeToIso(t: ZkTime, offset: string): string {
  return `${String(t.year).padStart(4, '0')}-${p2(t.month)}-${p2(t.day)}T${p2(t.hour)}:${p2(t.minute)}:${p2(t.second)}${offset}`;
}

export function zkTimeToText(t: ZkTime): string {
  return `${String(t.year).padStart(4, '0')}-${p2(t.month)}-${p2(t.day)} ${p2(t.hour)}:${p2(t.minute)}:${p2(t.second)}`;
}

/* ------------------------------------------------------- record parsing */

export interface RawPunch {
  /** internal device uid (u16) - only meaningful for 8/40 byte formats */
  uid: number;
  /** user PIN as configured on device (what the school knows the student as) */
  userId: string;
  time: ZkTime;
  /** device "status" field = verify type (0 password, 1 finger, 2 card, 15 face...) */
  verifyType: number;
  /** device "punch" field = in/out state (0 in, 1 out, 2 break out, 3 break in, 4 OT in, 5 OT out) */
  inOutState: number;
}

export interface DeviceUser {
  uid: number;
  userId: string;
  name: string;
  privilege: number;
  card: number;
}

function cstr(b: Buffer): string {
  const z = b.indexOf(0);
  return b.subarray(0, z === -1 ? b.length : z).toString('utf8');
}

function readRecord(body: Buffer, off: number, size: number, uidMap?: Map<number, string>): RawPunch {
  if (size === 8) {
    const uid = body.readUInt16LE(off);
    const verifyType = body[off + 2];
    const time = decodeTime(body.readUInt32LE(off + 3));
    const inOutState = body[off + 7];
    return { uid, userId: uidMap?.get(uid) ?? String(uid), time, verifyType, inOutState };
  }
  if (size === 16) {
    const userNum = body.readUInt32LE(off);
    const time = decodeTime(body.readUInt32LE(off + 4));
    const verifyType = body[off + 8];
    const inOutState = body[off + 9];
    return { uid: userNum & 0xffff, userId: String(userNum), time, verifyType, inOutState };
  }
  // 40 bytes: uid u16, user_id[24], status u8, time u32, punch u8, reserved[8]
  const uid = body.readUInt16LE(off);
  const userId = cstr(body.subarray(off + 2, off + 26));
  const verifyType = body[off + 26];
  const time = decodeTime(body.readUInt32LE(off + 27));
  const inOutState = body[off + 31];
  return { uid, userId: userId || String(uid), time, verifyType, inOutState };
}

function plausibility(body: Buffer, size: number): number {
  const n = Math.floor(body.length / size);
  if (n === 0) return 0;
  const sample = Math.min(n, 50);
  let good = 0;
  for (let i = 0; i < sample; i++) {
    const off = i * size;
    const r = readRecord(body, off, size);
    let ok = r.time.year >= 2010 && r.time.year <= 2060;
    if (ok && size === 40) {
      const idField = body.subarray(off + 2, off + 26);
      const z = idField.indexOf(0);
      const used = z === -1 ? idField : idField.subarray(0, z);
      ok = used.length > 0 && used.every((c) => c >= 0x20 && c < 0x7f);
    }
    if (ok) good++;
  }
  return good / sample;
}

/** Decide record size (8/16/40) from header total + record count hint, else by plausibility. */
export function detectRecordSize(body: Buffer, totalBytes: number, recordsHint?: number): number {
  if (recordsHint && recordsHint > 0 && totalBytes % recordsHint === 0) {
    const s = totalBytes / recordsHint;
    if (s === 8 || s === 16 || s === 40) return s;
  }
  const cands = [40, 16, 8].filter((s) => totalBytes % s === 0);
  if (cands.length === 0) throw new ZKError('PROTOCOL', `cannot infer attendance record size (total=${totalBytes})`);
  if (cands.length === 1) return cands[0];
  let best = cands[0];
  let bestScore = -1;
  for (const s of cands) {
    const sc = plausibility(body.subarray(0, totalBytes), s);
    if (sc > bestScore) {
      best = s;
      bestScore = sc;
    }
  }
  return best;
}

/**
 * Parse the buffer returned by CMD_ATTLOG_RRQ (first u32 = payload length, then records).
 * @param recordsHint number of records reported by CMD_GET_FREE_SIZES (if known)
 * @param uidMap uid -> user_id map, needed to resolve the 8 byte format
 */
export function parseAttendance(
  raw: Buffer,
  opts: { recordsHint?: number; uidMap?: Map<number, string> } = {},
): { recordSize: number; punches: RawPunch[]; truncated: boolean } {
  if (raw.length < 4) return { recordSize: 0, punches: [], truncated: false };
  const declared = raw.readUInt32LE(0);
  const body = raw.subarray(4);
  if (declared === 0) return { recordSize: 0, punches: [], truncated: false };
  const total = Math.min(declared, body.length);
  const truncated = declared > body.length;
  const recordSize = detectRecordSize(body, declared, opts.recordsHint) || 40;
  const punches: RawPunch[] = [];
  for (let off = 0; off + recordSize <= total; off += recordSize) {
    punches.push(readRecord(body, off, recordSize, opts.uidMap));
  }
  return { recordSize, punches, truncated };
}

export function parseUsers(raw: Buffer, usersHint?: number): DeviceUser[] {
  if (raw.length < 4) return [];
  const declared = raw.readUInt32LE(0);
  const body = raw.subarray(4);
  const total = Math.min(declared, body.length);
  let size = 0;
  if (usersHint && usersHint > 0 && declared % usersHint === 0) size = declared / usersHint;
  if (size !== 28 && size !== 72) size = declared % 72 === 0 ? 72 : declared % 28 === 0 ? 28 : 0;
  if (size === 0) return [];
  const users: DeviceUser[] = [];
  for (let off = 0; off + size <= total; off += size) {
    if (size === 72) {
      users.push({
        uid: body.readUInt16LE(off),
        privilege: body[off + 2],
        name: cstr(body.subarray(off + 11, off + 35)).trim(),
        card: body.readUInt32LE(off + 35),
        userId: cstr(body.subarray(off + 48, off + 72)),
      });
    } else {
      const userNum = body.readUInt32LE(off + 24);
      users.push({
        uid: body.readUInt16LE(off),
        privilege: body[off + 2],
        name: cstr(body.subarray(off + 8, off + 16)).trim(),
        card: body.readUInt32LE(off + 16),
        userId: userNum ? String(userNum) : String(body.readUInt16LE(off)),
      });
    }
  }
  return users;
}

export interface DeviceSizes {
  users: number;
  fingers: number;
  records: number;
  cards: number;
  recordCapacity: number;
}

/* ---------------------------------------------------------------- client */

export interface ZKClientOptions {
  host: string;
  port?: number;
  commKey?: number;
  connectTimeoutMs?: number;
  timeoutMs?: number;
  /** optional debug hook (never receives the comm key) */
  debug?: (msg: string) => void;
}

interface Waiter {
  resolve: (p: ZKPacket) => void;
  reject: (e: Error) => void;
}

export class ZKClient {
  private socket?: net.Socket;
  private reader = new PacketReader();
  private queue: ZKPacket[] = [];
  private waiter?: Waiter;
  private failure?: Error;
  private sessionId = 0;
  private replyId = USHRT_MAX - 1; // 65534 like pyzk
  private connected = false;
  private readonly host: string;
  private readonly port: number;
  private readonly commKey: number;
  private readonly connectTimeoutMs: number;
  private readonly timeoutMs: number;
  private readonly debug: (msg: string) => void;

  constructor(opts: ZKClientOptions) {
    this.host = opts.host;
    this.port = opts.port ?? 4370;
    this.commKey = opts.commKey ?? 0;
    this.connectTimeoutMs = opts.connectTimeoutMs ?? 10000;
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this.debug = opts.debug ?? (() => undefined);
  }

  /** Open TCP socket, CMD_CONNECT, and authenticate with the comm key if requested by the device. */
  async connect(): Promise<void> {
    await this.openSocket();
    this.sessionId = 0;
    this.replyId = USHRT_MAX - 1;
    let res = await this.command(CMD.CONNECT);
    this.sessionId = res.sessionId;
    if (res.command === CMD.ACK_UNAUTH) {
      this.debug('device requires authentication');
      res = await this.command(CMD.AUTH, makeCommKey(this.commKey, this.sessionId));
      if (res.command !== CMD.ACK_OK) {
        throw new ZKError('AUTH_FAILED', 'device rejected the communication key (check Comm Key on the K40)');
      }
    } else if (res.command !== CMD.ACK_OK) {
      throw new ZKError('PROTOCOL', `unexpected reply to CMD_CONNECT: ${res.command}`);
    }
    this.connected = true;
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = net.createConnection({ host: this.host, port: this.port });
      this.socket = s;
      s.setNoDelay(true);
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        s.destroy();
        reject(new ZKError('CONNECT_FAILED', `connect timeout to ${this.host}:${this.port} after ${this.connectTimeoutMs}ms`));
      }, this.connectTimeoutMs);
      s.once('connect', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      });
      s.on('data', (chunk) => this.onData(chunk));
      s.on('error', (err) => {
        const e = new ZKError(settled ? 'CLOSED' : 'CONNECT_FAILED', `${err.message}`);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(e);
        }
        this.fail(e);
      });
      s.on('close', () => this.fail(new ZKError('CLOSED', 'connection closed by device')));
    });
  }

  private onData(chunk: Buffer): void {
    this.reader.push(chunk);
    for (let p = this.reader.pop(); p; p = this.reader.pop()) this.queue.push(p);
    this.wake();
  }

  private fail(e: Error): void {
    if (!this.failure) this.failure = e;
    this.wake();
  }

  private wake(): void {
    if (!this.waiter) return;
    if (this.queue.length) {
      const w = this.waiter;
      this.waiter = undefined;
      w.resolve(this.queue.shift()!);
    } else if (this.failure) {
      const w = this.waiter;
      this.waiter = undefined;
      w.reject(this.failure);
    }
  }

  private nextPacket(timeoutMs: number): Promise<ZKPacket> {
    if (this.queue.length) return Promise.resolve(this.queue.shift()!);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise<ZKPacket>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = undefined;
        reject(new ZKError('TIMEOUT', `no reply from device within ${timeoutMs}ms`));
      }, timeoutMs);
      this.waiter = {
        resolve: (p) => {
          clearTimeout(timer);
          resolve(p);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
    });
  }

  private send(command: number, data: Buffer): Promise<void> {
    const { packet, nextReplyId } = buildPacket(command, this.sessionId, this.replyId, data);
    this.replyId = nextReplyId;
    return new Promise((resolve, reject) => {
      const s = this.socket;
      if (!s || s.destroyed) return reject(new ZKError('CLOSED', 'socket is not open'));
      s.write(packet, (err) => (err ? reject(new ZKError('CLOSED', err.message)) : resolve()));
    });
  }

  /** Send one command and return the device's first reply packet. */
  async command(command: number, data: Buffer = Buffer.alloc(0), timeoutMs = this.timeoutMs): Promise<ZKPacket> {
    await this.send(command, data);
    return this.nextPacket(timeoutMs);
  }

  private expectOk(res: ZKPacket, what: string): ZKPacket {
    if (res.command === CMD.ACK_UNAUTH) throw new ZKError('AUTH_FAILED', `${what}: device says unauthorized`);
    if (res.command !== CMD.ACK_OK && res.command !== CMD.ACK_DATA) {
      throw new ZKError('DEVICE_ERROR', `${what}: device replied ${res.command}`);
    }
    return res;
  }

  async getTime(): Promise<ZkTime> {
    const res = this.expectOk(await this.command(CMD.GET_TIME), 'GET_TIME');
    if (res.data.length < 4) throw new ZKError('PROTOCOL', 'GET_TIME reply too short');
    return decodeTime(res.data.readUInt32LE(0));
  }

  async enableDevice(): Promise<void> {
    this.expectOk(await this.command(CMD.ENABLE_DEVICE), 'ENABLE_DEVICE');
  }

  async disableDevice(): Promise<void> {
    this.expectOk(await this.command(CMD.DISABLE_DEVICE), 'DISABLE_DEVICE');
  }

  async getFreeSizes(): Promise<DeviceSizes> {
    const res = this.expectOk(await this.command(CMD.GET_FREE_SIZES), 'GET_FREE_SIZES');
    if (res.data.length < 80) throw new ZKError('PROTOCOL', 'GET_FREE_SIZES reply too short');
    const f = (i: number) => res.data.readInt32LE(i * 4);
    return { users: f(4), fingers: f(6), records: f(8), cards: f(12), recordCapacity: f(16) };
  }

  /** e.g. '~DeviceName', '~SerialNumber'. Returns undefined if the firmware does not answer. */
  async getOption(name: string): Promise<string | undefined> {
    try {
      const res = await this.command(CMD.OPTIONS_RRQ, Buffer.from(name + '\0', 'ascii'));
      if (res.command !== CMD.ACK_OK) return undefined;
      const text = cstr(res.data);
      const eq = text.indexOf('=');
      return eq === -1 ? text : text.slice(eq + 1);
    } catch {
      return undefined;
    }
  }

  private async collectData(size: number): Promise<Buffer> {
    const parts: Buffer[] = [];
    let got = 0;
    while (got < size) {
      const p = await this.nextPacket(this.timeoutMs);
      if (p.command === CMD.DATA) {
        parts.push(p.data);
        got += p.data.length;
      } else if (p.command === CMD.ACK_OK || p.command === CMD.PREPARE_DATA) {
        if (p.command === CMD.ACK_OK && got > 0) break;
        continue;
      } else {
        throw new ZKError('DEVICE_ERROR', `unexpected packet ${p.command} while receiving data`);
      }
    }
    return Buffer.concat(parts);
  }

  /** Read one chunk via CMD_READ_BUFFER (1504): PREPARE_DATA(size) + DATA packets + ACK_OK. */
  private async readChunk(start: number, size: number): Promise<Buffer> {
    const req = Buffer.alloc(8);
    req.writeInt32LE(start, 0);
    req.writeInt32LE(size, 4);
    const res = await this.command(CMD.READ_BUFFER, req);
    if (res.command === CMD.DATA) return res.data;
    if (res.command !== CMD.PREPARE_DATA) {
      throw new ZKError('DEVICE_ERROR', `READ_BUFFER: unexpected reply ${res.command}`);
    }
    const n = res.data.readUInt32LE(0);
    const data = await this.collectData(n);
    await this.tryReadTrailingAck();
    return data;
  }

  private async tryReadTrailingAck(): Promise<void> {
    try {
      const p = await this.nextPacket(Math.min(this.timeoutMs, 3000));
      if (p.command !== CMD.ACK_OK) this.debug(`expected trailing ACK_OK, got ${p.command}`);
    } catch (e) {
      this.debug(`no trailing ACK_OK (${(e as Error).message})`);
    }
  }

  /** Generic "big data" read (attlog, users...) using CMD_DATA_WRRQ + chunked CMD_READ_BUFFER. */
  async readWithBuffer(command: number, fct = 0, ext = 0): Promise<Buffer> {
    const req = Buffer.alloc(11);
    req.writeInt8(1, 0);
    req.writeInt16LE(command, 1);
    req.writeInt32LE(fct, 3);
    req.writeInt32LE(ext, 7);
    const res = await this.command(CMD.DATA_WRRQ, req);
    if (res.command === CMD.DATA) return res.data; // small payload returned directly
    let size: number;
    if (res.command === CMD.PREPARE_DATA) {
      size = res.data.readUInt32LE(0);
      // some firmwares push the data immediately after PREPARE_DATA; others wait for READ_BUFFER
      try {
        const first = await this.nextPacket(1500);
        if (first.command === CMD.DATA) {
          this.queue.unshift(first);
          const d = await this.collectData(size);
          await this.tryReadTrailingAck();
          return d;
        }
        this.queue.unshift(first);
      } catch (e) {
        if (!(e instanceof ZKError) || e.code !== 'TIMEOUT') throw e;
      }
    } else if (res.command === CMD.ACK_OK && res.data.length >= 5) {
      size = res.data.readUInt32LE(1);
    } else {
      this.expectOk(res, 'DATA_WRRQ');
      throw new ZKError('PROTOCOL', 'DATA_WRRQ reply without size');
    }
    if (size === 0) {
      await this.freeData();
      return Buffer.alloc(0);
    }
    const parts: Buffer[] = [];
    let start = 0;
    while (start < size) {
      const n = Math.min(MAX_CHUNK, size - start);
      const chunk = await this.readChunk(start, n);
      if (chunk.length === 0) throw new ZKError('PROTOCOL', 'empty data chunk');
      parts.push(chunk);
      start += chunk.length;
    }
    await this.freeData();
    return Buffer.concat(parts);
  }

  private async freeData(): Promise<void> {
    try {
      await this.command(CMD.FREE_DATA, Buffer.alloc(0), Math.min(this.timeoutMs, 5000));
    } catch (e) {
      this.debug(`FREE_DATA failed: ${(e as Error).message}`);
    }
  }

  async getUsers(): Promise<DeviceUser[]> {
    let hint: number | undefined;
    try {
      hint = (await this.getFreeSizes()).users;
    } catch {
      hint = undefined;
    }
    const raw = await this.readWithBuffer(CMD.USERTEMP_RRQ);
    return parseUsers(raw, hint);
  }

  /** Read whole attendance log. `resolveUsers` fetches the user list to map the 8 byte format. */
  async getAttendance(resolveUsers = true): Promise<{ recordSize: number; punches: RawPunch[]; truncated: boolean }> {
    let recordsHint: number | undefined;
    try {
      recordsHint = (await this.getFreeSizes()).records;
    } catch {
      recordsHint = undefined;
    }
    const raw = await this.readWithBuffer(CMD.ATTLOG_RRQ);
    if (raw.length < 4) return { recordSize: 0, punches: [], truncated: false };
    const declared = raw.readUInt32LE(0);
    let uidMap: Map<number, string> | undefined;
    const size = declared > 0 ? detectRecordSize(raw.subarray(4), declared, recordsHint) : 0;
    if (size === 8 && resolveUsers) {
      try {
        const users = await this.getUsers();
        uidMap = new Map(users.map((u) => [u.uid, u.userId]));
      } catch (e) {
        this.debug(`user list unavailable, falling back to uid as user id: ${(e as Error).message}`);
      }
    }
    return parseAttendance(raw, { recordsHint, uidMap });
  }

  /** DANGEROUS: erases the attendance log on the device. Only used with clearDeviceLogsAfterSync=true. */
  async clearAttendance(): Promise<void> {
    this.expectOk(await this.command(CMD.CLEAR_ATTLOG), 'CLEAR_ATTLOG');
  }

  /**
   * Always call in `finally`: re-enables the device, closes the session and the socket.
   * Never throws.
   */
  async close(): Promise<void> {
    const s = this.socket;
    if (s && !s.destroyed && this.connected && !this.failure) {
      try {
        await this.command(CMD.ENABLE_DEVICE, Buffer.alloc(0), Math.min(this.timeoutMs, 5000));
      } catch (e) {
        this.debug(`ENABLE_DEVICE on close failed: ${(e as Error).message}`);
      }
      try {
        await this.command(CMD.EXIT, Buffer.alloc(0), Math.min(this.timeoutMs, 5000));
      } catch (e) {
        this.debug(`EXIT failed: ${(e as Error).message}`);
      }
    }
    this.connected = false;
    if (s) {
      s.removeAllListeners('data');
      s.destroy();
    }
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = undefined;
      w.reject(new ZKError('CLOSED', 'client closed'));
    }
  }
}
