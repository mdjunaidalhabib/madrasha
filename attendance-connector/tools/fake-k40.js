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
 *
 * Usage as a module:  const { FakeK40 } = require('./fake-k40'); const k = new FakeK40({commKey: 1234});
 *                     const port = await k.start(); k.addPunch('101', '2026-09-20 08:01:00');
 * CLI:  node tools/fake-k40.js --port 4370 --commkey 1234 --format 40 --auto
 */
const net = require('node:net');

const C = {
  CONNECT: 1000, EXIT: 1001, ENABLE: 1002, DISABLE: 1003, AUTH: 1102,
  FREE_SIZES: 50, OPTIONS: 11, USERS: 9, ATTLOG: 13, CLEAR_ATTLOG: 15, GET_TIME: 201,
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
    /** 'normal' | 'refuse' (accept then drop immediately) | 'silent' (accept, never answer) */
    this.mode = 'normal';
    this.users = new Map(); // userId -> {uid, name}
    this.punches = []; // {userId, t:{y,mo,d,h,mi,s}, verify, inOut}
    this.disabled = false;
    this.sockets = new Set();
    this.stats = { connections: 0, authOk: 0, authFailed: 0, enableCalls: 0, disableCalls: 0, clearCalls: 0, attlogReads: 0, checksumErrors: 0, unauthReplies: 0 };
    this.server = null;
  }

  addUser(userId, name = '') {
    userId = String(userId);
    if (!this.users.has(userId)) this.users.set(userId, { uid: this.users.size + 1, name: name || `User ${userId}` });
    return this.users.get(userId);
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
    sock.on('close', () => this.sockets.delete(sock));
    sock.on('error', () => {});
    const st = { session: 0, authed: this.commKey === 0, buf: Buffer.alloc(0), pending: null };
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
  async _send(sock, packets) {
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
        const now = new Date(Date.now() + this.timeSkewSec * 1000);
        const b = Buffer.alloc(4);
        b.writeUInt32LE(encodeTime(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()));
        return send(reply(C.OK, b));
      }
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
      body[off + 2] = 0;
      if (size === 72) {
        body.write(u.name, off + 11, 24, 'utf8');
        body.write(userId, off + 48, 24, 'ascii');
      } else {
        body.write(u.name, off + 8, 8, 'utf8');
        body.writeUInt32LE(Number(userId) || 0, off + 24);
      }
    }
    const head = Buffer.alloc(4);
    head.writeUInt32LE(body.length);
    return Buffer.concat([head, body]);
  }
}

module.exports = { FakeK40, encodeTime, expectedCommKey, checksum };

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
    if (args.includes('--auto')) {
      setInterval(() => {
        const id = String(101 + Math.floor(Math.random() * 3));
        k.addPunch(id, new Date(), 1, 0);
        console.log('punch', id, 'total', k.punches.length);
      }, 5000);
    }
  });
}
