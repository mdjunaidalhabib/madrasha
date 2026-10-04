#!/usr/bin/env node
'use strict';
/**
 * fake-k40: a TCP simulator of a ZKTeco K40 (ZK proprietary protocol), for tests and demos.
 *
 * Written independently from src/protocol.ts (own checksum / commkey / time code) but from the same
 * knowledge of the open protocol (pyzk / node-zklib). It proves internal consistency, NOT real-hardware
 * compatibility.
 *
 * Supports: CONNECT (+ ACK_UNAUTH/AUTH with comm key), EXIT, ENABLE/DISABLE_DEVICE, GET_TIME, GET_FREE_SIZES,
 * OPTIONS_RRQ (~DeviceName), DATA_WRRQ (attlog / users), READ_BUFFER (chunked PREPARE_DATA + DATA + ACK_OK),
 * FREE_DATA, CLEAR_ATTLOG. Attendance formats: 8, 16, 40 byte. User formats: 28, 72 byte.
 * v1.1: USER_WRQ (28/72 byte records incl. card), DELETE_USER, REFRESHDATA, SET_TIME (adjusts the clock skew),
 * REG_EVENT, and swipeCard(card) which pushes a realtime event (command 500, session field = 1024,
 * data = u32 LE card) to every connection that registered for events. Client ACKs to events are counted.
 * The device clock is PC time shifted to utcOffsetMin (default +06:00) plus timeSkewSec.
 *
 * Usage as a module:  const { FakeK40 } = require('./fake-k40'); const k = new FakeK40({commKey: 1234});
 *                     const port = await k.start(); k.addPunch('101', '2026-09-20 08:01:00');
 * CLI:  node tools/fake-k40.js --port 4370 --commkey 1234 --format 40 --auto
 */
const net = require('node:net');

const C = {
  CONNECT: 1000, EXIT: 1001, ENABLE: 1002, DISABLE: 1003, AUTH: 1102,
  FREE_SIZES: 50, OPTIONS: 11, USERS: 9, ATTLOG: 13, CLEAR_ATTLOG: 15, GET_TIME: 201,
  SET_TIME: 202, USER_WRQ: 8, DELETE_USER: 18, REFRESHDATA: 1013, REG_EVENT: 500,
  PREPARE: 1500, DATA: 1501, FREE_DATA: 1502, WRRQ: 1503, READ_BUFFER: 1504,
  OK: 2000, ERROR: 2001, UNAUTH: 2005,
};

function checksum(buf) {
  let chk = 0;
  let l = buf.length;
  let i = 0;
  while (l > 1) {
    chk += buf.readUInt16LE(i);
    i += 2;
    if (chk > 65535) chk -= 65535;
    l -= 2;
  }
  if (l) chk += buf[buf.length - 1];
  while (chk > 65535) chk -= 65535;
  chk = ~chk;
  while (chk < 0) chk += 65535;
  return chk & 0xffff;
}

function expectedCommKey(key, session, ticks = 50) {
  const bits = (key >>> 0).toString(2).padStart(32, '0');
  const rev = parseInt(bits.split('').reverse().join(''), 2) >>> 0;
  const k = (rev + session) >>> 0;
  const kb = Buffer.alloc(4);
  kb.writeUInt32LE(k);
  const xb = Buffer.from([kb[0] ^ 0x5a, kb[1] ^ 0x4b, kb[2] ^ 0x53, kb[3] ^ 0x4f]);
  const sw = Buffer.alloc(4);
  sw.writeUInt16LE(xb.readUInt16LE(2), 0);
  sw.writeUInt16LE(xb.readUInt16LE(0), 2);
  const t = ticks & 0xff;
  return Buffer.from([sw[0] ^ t, sw[1] ^ t, t, sw[3] ^ t]);
}

function encodeTime(y, mo, d, h, mi, s) {
  return ((((y - 2000) * 12 + (mo - 1)) * 31 + (d - 1)) * 86400 + (h * 60 + mi) * 60 + s) >>> 0;
}

function decodeTime(v) {
  v >>>= 0;
  const s = v % 60; v = Math.floor(v / 60);
  const mi = v % 60; v = Math.floor(v / 60);
  const h = v % 24; v = Math.floor(v / 24);
  const d = (v % 31) + 1; v = Math.floor(v / 31);
  const mo = (v % 12) + 1; v = Math.floor(v / 12);
  return { y: v + 2000, mo, d, h, mi, s };
}

function cstr(b) {
  const z = b.indexOf(0);
  return b.subarray(0, z === -1 ? b.length : z).toString('utf8');
}

function parseTimeArg(t) {
  if (t === undefined) t = new Date();
  if (t instanceof Date) {
    return { y: t.getFullYear(), mo: t.getMonth() + 1, d: t.getDate(), h: t.getHours(), mi: t.getMinutes(), s: t.getSeconds() };
  }
  if (typeof t === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(t);
    if (!m) throw new Error('bad time ' + t);
    return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6] };
  }
  return t;
}

class FakeK40 {
  /**
   * @param {object} o
   * @param {number} [o.commKey=0]
   * @param {8|16|40} [o.format=40]
   * @param {28|72} [o.userFormat=72]
   * @param {number} [o.chunkSize=1000]   payload size of each CMD_DATA packet in chunk replies
   * @param {boolean} [o.splitWrites=true] fragment TCP writes to exercise the client's framing
   * @param {'ack'|'prepare'|'prepare-push'} [o.prepareStyle='ack'] reply style to CMD_DATA_WRRQ
   * @param {number} [o.directThreshold=0] payloads up to this size are returned directly as CMD_DATA
   * @param {boolean} [o.recordsInSizes=true] report record count in GET_FREE_SIZES
   * @param {number} [o.replyDelayMs=0]
   * @param {number} [o.timeSkewSec=0]     device clock error (seconds)
   * @param {number} [o.utcOffsetMin=360]  the device's wall clock zone (+06:00)
   * @param {boolean} [o.strictUserFormat=true] reject USER_WRQ records whose size differs from userFormat
   * @param {number} [o.cardEventCode=1024] event code (session field) used by swipeCard()
   */
  constructor(o = {}) {
    this.commKey = o.commKey || 0;
    this.format = o.format || 40;
    this.userFormat = o.userFormat || 72;
    this.chunkSize = o.chunkSize || 1000;
    this.splitWrites = o.splitWrites !== false;
    this.prepareStyle = o.prepareStyle || 'ack';
    this.directThreshold = o.directThreshold || 0;
    this.recordsInSizes = o.recordsInSizes !== false;
    this.replyDelayMs = o.replyDelayMs || 0;
    this.timeSkewSec = o.timeSkewSec || 0;
    this.utcOffsetMin = o.utcOffsetMin === undefined ? 360 : o.utcOffsetMin;
    this.strictUserFormat = o.strictUserFormat !== false;
    this.cardEventCode = o.cardEventCode || 1024;
    this.conns = new Set(); // {sock, st}
    /** 'normal' | 'refuse' (accept then drop immediately) | 'silent' (accept, never answer) */
    this.mode = 'normal';
    this.users = new Map(); // userId -> {uid, name, card, privilege, password, group}
    // fingerprint templates are keyed by uid on a real K40 (not by user id): a USER_WRQ that rewrites a uid with a
    // new user id keeps them; DELETE_USER drops them. A string marker per uid is enough for tests.
    this.templates = new Map(); // uid -> marker
    this.punches = []; // {userId, t:{y,mo,d,h,mi,s}, verify, inOut}
    this.disabled = false;
    this.sockets = new Set();
    this.stats = { connections: 0, authOk: 0, authFailed: 0, enableCalls: 0, disableCalls: 0, clearCalls: 0, attlogReads: 0, checksumErrors: 0, unauthReplies: 0,
      userWrites: 0, userWriteRejects: 0, userDeletes: 0, refreshCalls: 0, setTimeCalls: 0, regEventCalls: 0, eventsSent: 0, eventAcks: 0 };
    this.lastUserWriteSize = 0;
    this.server = null;
  }

  addUser(userId, name = '', card = 0) {
    userId = String(userId);
    if (!this.users.has(userId)) {
      const uid = [...this.users.values()].reduce((m, u) => Math.max(m, u.uid), 0) + 1;
      this.users.set(userId, { uid, name: name || `User ${userId}`, card: card || 0, privilege: 0, password: '', group: '' });
    }
    return this.users.get(userId);
  }

  /** a finger enrolled on the K40 for this user (stored under the user's uid) */
  addFingerprint(userId, marker = 'fp-' + userId) {
    const u = this.users.get(String(userId));
    if (!u) throw new Error('no such user ' + userId);
    this.templates.set(u.uid, marker);
    return marker;
  }

  /** fingerprint marker of the record currently holding this user id (undefined = none) */
  templateOf(userId) {
    const u = this.users.get(String(userId));
    return u ? this.templates.get(u.uid) : undefined;
  }

  /** what an admin does with "Enroll card" in the K40 menu: the card lands on the user record */
  setUserCard(userId, card) {
    const u = this.users.get(String(userId));
    if (!u) throw new Error('no such user ' + userId);
    u.card = Number(card) >>> 0;
  }

  /** current device wall clock as {y,mo,d,h,mi,s} */
  deviceNow() {
    const d = new Date(Date.now() + this.timeSkewSec * 1000 + this.utcOffsetMin * 60000);
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
  }

  /** connections currently registered for realtime events */
  get eventListeners() {
    return [...this.conns].filter((c) => c.st.eventFlags).length;
  }

  /** a card is held to the reader: push a realtime event to every registered connection. Returns #receivers. */
  swipeCard(card, code = this.cardEventCode) {
    const data = Buffer.alloc(4);
    data.writeUInt32LE(Number(card) >>> 0);
    return this.emitEvent(code, data);
  }

  emitEvent(code, data = Buffer.alloc(0)) {
    let n = 0;
    for (const c of this.conns) {
      if (!c.st.eventFlags || c.sock.destroyed) continue;
      this.stats.eventsSent++;
      n++;
      this._send(c.sock, [this._packet(C.REG_EVENT, code, 0, data)]);
    }
    return n;
  }

  addPunch(userId, time, verify = 1, inOut = 0) {
    userId = String(userId);
    this.addUser(userId);
    const rec = { userId, t: parseTimeArg(time), verify, inOut };
    this.punches.push(rec);
    return rec;
  }

  /* ------------------------------------------------------------ server */

  start(port = 0, host = '127.0.0.1') {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((sock) => this._onConnection(sock));
      this.server.once('error', reject);
      this.server.listen(port, host, () => resolve(this.server.address().port));
    });
  }

  get port() {
    return this.server && this.server.address().port;
  }

  dropConnections() {
    for (const s of this.sockets) s.destroy();
  }

  stop() {
    return new Promise((resolve) => {
      this.dropConnections();
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
  }

  _onConnection(sock) {
    this.stats.connections++;
    if (this.mode === 'refuse') return sock.destroy();
    this.sockets.add(sock);
    const st = { session: 0, authed: this.commKey === 0, buf: Buffer.alloc(0), pending: null, eventFlags: 0 };
    const conn = { sock, st };
    this.conns.add(conn);
    sock.on('close', () => {
      this.sockets.delete(sock);
      this.conns.delete(conn);
    });
    sock.on('error', () => {});
    if (this.mode === 'silent') return;
    sock.on('data', (chunk) => {
      st.buf = Buffer.concat([st.buf, chunk]);
      for (;;) {
        if (st.buf.length < 8) return;
        if (st.buf.readUInt16LE(0) !== 0x5050 || st.buf.readUInt16LE(2) !== 0x7d82) {
          st.buf = Buffer.alloc(0);
          return;
        }
        const len = st.buf.readUInt32LE(4);
        if (st.buf.length < 8 + len) return;
        const body = st.buf.subarray(8, 8 + len);
        st.buf = st.buf.subarray(8 + len);
        this._handle(sock, st, body);
      }
    });
  }

  _packet(cmd, session, replyId, data = Buffer.alloc(0)) {
    const body = Buffer.alloc(8 + data.length);
    body.writeUInt16LE(cmd, 0);
    body.writeUInt16LE(0, 2);
    body.writeUInt16LE(session, 4);
    body.writeUInt16LE(replyId, 6);
    data.copy(body, 8);
    body.writeUInt16LE(checksum(body), 2);
    const head = Buffer.alloc(8);
    head.writeUInt16LE(0x5050, 0);
    head.writeUInt16LE(0x7d82, 2);
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body]);
  }

  /** queue of outgoing packets written in order (optionally fragmented) */
  _send(sock, packets) {
    // serialize per socket: a realtime event must never interleave with the fragments of a reply
    const prev = sock._fakeChain || Promise.resolve();
    const next = prev.then(() => this._sendNow(sock, packets)).catch(() => {});
    sock._fakeChain = next;
    return next;
  }

  async _sendNow(sock, packets) {
    const all = Buffer.concat(packets);
    if (this.replyDelayMs) await new Promise((r) => setTimeout(r, this.replyDelayMs));
    if (sock.destroyed) return;
    if (!this.splitWrites) return void sock.write(all);
    let off = 0;
    let n = 5;
    while (off < all.length && !sock.destroyed) {
      const piece = all.subarray(off, off + n);
      sock.write(piece);
      off += n;
      n = (n * 3 + 7) % 97 + 3; // irregular fragment sizes
      await new Promise((r) => setImmediate(r));
    }
  }

  _handle(sock, st, body) {
    const cmd = body.readUInt16LE(0);
    const recvChk = body.readUInt16LE(2);
    const session = body.readUInt16LE(4);
    const replyId = body.readUInt16LE(6);
    const data = body.subarray(8);
    // verify checksum (sender computes with reply id before its increment)
    const copy = Buffer.from(body);
    copy.writeUInt16LE(0, 2);
    copy.writeUInt16LE(replyId === 0 ? 65534 : replyId - 1, 6);
    if (checksum(copy) !== recvChk) this.stats.checksumErrors++;

    const reply = (c, d) => this._packet(c, st.session, replyId, d || Buffer.alloc(0));
    const send = (...p) => this._send(sock, p);

    if (cmd === C.OK) {
      // client ACK of a realtime event (pyzk __ack_ok): never answered
      this.stats.eventAcks++;
      return;
    }
    if (cmd === C.CONNECT) {
      st.session = 1 + Math.floor(Math.random() * 60000);
      if (this.commKey !== 0) {
        st.authed = false;
        this.stats.unauthReplies++;
        return send(reply(C.UNAUTH));
      }
      return send(reply(C.OK));
    }
    if (session !== st.session) return send(reply(C.ERROR)); // unknown session
    if (cmd === C.AUTH) {
      if (data.equals(expectedCommKey(this.commKey, st.session))) {
        st.authed = true;
        this.stats.authOk++;
        return send(reply(C.OK));
      }
      this.stats.authFailed++;
      return send(reply(C.UNAUTH));
    }
    if (!st.authed) {
      this.stats.unauthReplies++;
      return send(reply(C.UNAUTH));
    }
    switch (cmd) {
      case C.EXIT:
        send(reply(C.OK)).then(() => setTimeout(() => sock.end(), 5));
        return;
      case C.ENABLE:
        this.stats.enableCalls++;
        this.disabled = false;
        return send(reply(C.OK));
      case C.DISABLE:
        this.stats.disableCalls++;
        this.disabled = true;
        return send(reply(C.OK));
      case C.GET_TIME: {
        const n = this.deviceNow();
        const b = Buffer.alloc(4);
        b.writeUInt32LE(encodeTime(n.y, n.mo, n.d, n.h, n.mi, n.s));
        return send(reply(C.OK, b));
      }
      case C.SET_TIME: {
        if (data.length < 4) return send(reply(C.ERROR));
        const t = decodeTime(data.readUInt32LE(0));
        const wanted = Date.UTC(t.y, t.mo - 1, t.d, t.h, t.mi, t.s) - this.utcOffsetMin * 60000;
        this.timeSkewSec = Math.round((wanted - Date.now()) / 1000);
        this.stats.setTimeCalls++;
        return send(reply(C.OK));
      }
      case C.USER_WRQ: {
        if ((data.length !== 72 && data.length !== 28) || (this.strictUserFormat && data.length !== this.userFormat)) {
          this.stats.userWriteRejects++;
          return send(reply(C.ERROR));
        }
        this.lastUserWriteSize = data.length;
        const uid = data.readUInt16LE(0);
        let rec;
        if (data.length === 72) {
          rec = { uid, privilege: data[2], password: cstr(data.subarray(3, 11)), name: cstr(data.subarray(11, 35)), card: data.readUInt32LE(35), group: cstr(data.subarray(40, 47)), userId: cstr(data.subarray(48, 72)) };
        } else {
          rec = { uid, privilege: data[2], password: cstr(data.subarray(3, 8)), name: cstr(data.subarray(8, 16)), card: data.readUInt32LE(16), group: String(data[21]), userId: String(data.readUInt32LE(24)) };
        }
        if (!rec.userId || uid === 0) {
          this.stats.userWriteRejects++;
          return send(reply(C.ERROR));
        }
        // the uid identifies the record: drop whatever had this uid (and a stale record with this user id)
        for (const [id, u] of this.users) if (u.uid === uid || id === rec.userId) this.users.delete(id);
        const { userId, ...u } = rec;
        this.users.set(userId, u);
        this.stats.userWrites++;
        return send(reply(C.OK));
      }
      case C.DELETE_USER: {
        const uid = data.readUInt16LE(0);
        for (const [id, u] of this.users) if (u.uid === uid) this.users.delete(id);
        this.templates.delete(uid);
        this.stats.userDeletes++;
        return send(reply(C.OK));
      }
      case C.REFRESHDATA:
        this.stats.refreshCalls++;
        return send(reply(C.OK));
      case C.REG_EVENT:
        st.eventFlags = data.length >= 4 ? data.readUInt32LE(0) : 0;
        this.stats.regEventCalls++;
        return send(reply(C.OK));
      case C.FREE_SIZES: {
        const b = Buffer.alloc(80);
        b.writeInt32LE(this.users.size, 4 * 4);
        b.writeInt32LE(this.recordsInSizes ? this.punches.length : 0, 8 * 4);
        b.writeInt32LE(100000, 16 * 4);
        return send(reply(C.OK, b));
      }
      case C.OPTIONS: {
        const name = data.toString('ascii').replace(/\0.*$/s, '');
        const val = name === '~DeviceName' ? 'K40 (fake)' : name === '~SerialNumber' ? 'FAKE0000001' : '';
        return send(reply(C.OK, Buffer.from(`${name}=${val}\0`, 'ascii')));
      }
      case C.CLEAR_ATTLOG:
        this.stats.clearCalls++;
        this.punches = [];
        return send(reply(C.OK));
      case C.WRRQ: {
        const what = data.readInt16LE(1);
        let buf;
        if (what === C.ATTLOG) {
          this.stats.attlogReads++;
          buf = this._attlogBuffer();
        } else if (what === C.USERS) buf = this._usersBuffer();
        else return send(reply(C.ERROR));
        st.pending = buf;
        if (buf.length <= this.directThreshold) return send(reply(C.DATA, buf));
        const size = Buffer.alloc(4);
        size.writeUInt32LE(buf.length);
        if (this.prepareStyle === 'ack') return send(reply(C.OK, Buffer.concat([Buffer.from([0]), size])));
        if (this.prepareStyle === 'prepare') return send(reply(C.PREPARE, size));
        // prepare-push: data follows immediately
        return send(reply(C.PREPARE, size), ...this._dataPackets(reply, buf), reply(C.OK));
      }
      case C.READ_BUFFER: {
        const start = data.readInt32LE(0);
        const size = data.readInt32LE(4);
        const src = st.pending || Buffer.alloc(0);
        const slice = src.subarray(start, start + size);
        const n = Buffer.alloc(4);
        n.writeUInt32LE(slice.length);
        return send(reply(C.PREPARE, n), ...this._dataPackets(reply, slice), reply(C.OK));
      }
      case C.FREE_DATA:
        st.pending = null;
        return send(reply(C.OK));
      default:
        return send(reply(C.ERROR));
    }
  }

  _dataPackets(reply, buf) {
    const out = [];
    for (let i = 0; i < buf.length; i += this.chunkSize) out.push(reply(C.DATA, buf.subarray(i, i + this.chunkSize)));
    return out;
  }

  _attlogBuffer() {
    const size = this.format;
    const body = Buffer.alloc(this.punches.length * size);
    this.punches.forEach((p, i) => {
      const off = i * size;
      const t = encodeTime(p.t.y, p.t.mo, p.t.d, p.t.h, p.t.mi, p.t.s);
      const u = this.users.get(p.userId);
      if (size === 8) {
        body.writeUInt16LE(u.uid, off);
        body[off + 2] = p.verify;
        body.writeUInt32LE(t, off + 3);
        body[off + 7] = p.inOut;
      } else if (size === 16) {
        body.writeUInt32LE(Number(p.userId), off);
        body.writeUInt32LE(t, off + 4);
        body[off + 8] = p.verify;
        body[off + 9] = p.inOut;
      } else {
        body.writeUInt16LE(u.uid, off);
        body.write(p.userId, off + 2, 24, 'ascii');
        body[off + 26] = p.verify;
        body.writeUInt32LE(t, off + 27);
        body[off + 31] = p.inOut;
      }
    });
    const head = Buffer.alloc(4);
    head.writeUInt32LE(body.length);
    return Buffer.concat([head, body]);
  }

  _usersBuffer() {
    const size = this.userFormat;
    const body = Buffer.alloc(this.users.size * size);
    let i = 0;
    for (const [userId, u] of this.users) {
      const off = i++ * size;
      body.writeUInt16LE(u.uid, off);
      body[off + 2] = u.privilege || 0;
      if (size === 72) {
        body.write(u.password || '', off + 3, 8, 'utf8');
        body.write(u.name, off + 11, 24, 'utf8');
        body.writeUInt32LE((u.card || 0) >>> 0, off + 35);
        body.write(u.group || '', off + 40, 7, 'utf8');
        body.write(userId, off + 48, 24, 'ascii');
      } else {
        body.write(u.password || '', off + 3, 5, 'utf8');
        body.write(u.name, off + 8, 8, 'utf8');
        body.writeUInt32LE((u.card || 0) >>> 0, off + 16);
        body[off + 21] = Number(u.group) || 0;
        body.writeUInt32LE(Number(userId) || 0, off + 24);
      }
    }
    const head = Buffer.alloc(4);
    head.writeUInt32LE(body.length);
    return Buffer.concat([head, body]);
  }
}

module.exports = { FakeK40, encodeTime, decodeTime, expectedCommKey, checksum };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (n, d) => {
    const i = args.indexOf('--' + n);
    return i === -1 ? d : args[i + 1];
  };
  const k = new FakeK40({ commKey: Number(opt('commkey', 0)), format: Number(opt('format', 40)) });
  for (const id of ['101', '102', '103']) k.addUser(id);
  k.start(Number(opt('port', 4370)), opt('host', '0.0.0.0')).then((port) => {
    console.log(`fake K40 listening on ${port} (format ${k.format}, commKey ${k.commKey})`);
    console.log('type a card number + Enter to simulate a card swipe (realtime event)');
    process.stdin.on('data', (b) => {
      const card = String(b).trim();
      if (/^\d+$/.test(card)) console.log(`swipe ${card} -> ${k.swipeCard(Number(card))} listener(s)`);
    });
    if (args.includes('--auto')) {
      setInterval(() => {
        const id = String(101 + Math.floor(Math.random() * 3));
        k.addPunch(id, new Date(), 1, 0);
        console.log('punch', id, 'total', k.punches.length);
      }, 5000);
    }
  });
}
