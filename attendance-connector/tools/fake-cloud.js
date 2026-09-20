#!/usr/bin/env node
'use strict';
/**
 * fake-cloud: plain-http localhost implementation of the connector cloud contract
 *   GET  /api/attendance-devices/connector/config
 *   POST /api/attendance-devices/connector/heartbeat
 *   POST /api/attendance-devices/connector/ingest      (in-memory dedupe by event_id)
 * Headers required: x-device-key, X-Madrasa-Slug.
 *
 * Toggle behaviour with setMode('up'|'down'|'error503'|'unauth'|'ratelimit'), dropNextResponses(n)
 * (process the ingest, then kill the connection before answering = "crash between send and ack").
 */
const http = require('node:http');

const BASE = '/api/attendance-devices/connector';

class FakeCloud {
  constructor(o = {}) {
    this.deviceKey = o.deviceKey || 'test-device-key-123456';
    this.slug = o.slug || 'demo-madrasa';
    this.institutionId = o.institutionId || 1;
    this.deviceId = o.deviceId || 'K40-01';
    this.config = {
      device_id: this.deviceId,
      name: 'Main gate K40',
      ip: o.ip || '127.0.0.1',
      port: o.port || 4370,
      comm_password: o.commPassword === undefined ? null : o.commPassword,
      poll_interval_sec: o.pollIntervalSec || 30,
    };
    this.testRequested = false;
    this.mode = 'up';
    this.wrapped = o.wrapped !== false; // wrap in {success, data}
    this.events = new Map(); // event_id -> stored event
    this.rejectUserIds = new Set(o.rejectUserIds || []);
    this.dropResponses = 0;
    this.stats = { configCalls: 0, heartbeatCalls: 0, ingestCalls: 0, accepted: 0, duplicates: 0, rejected: 0, unauthorized: 0, refused: 0 };
    this.heartbeats = [];
    this.ingestBatches = [];
    this.received = []; // every event sent, in arrival order (including duplicates)
    this.server = null;
  }

  setMode(m) {
    this.mode = m;
  }
  dropNextResponses(n) {
    this.dropResponses = n;
  }
  get url() {
    return `http://127.0.0.1:${this.server.address().port}`;
  }
  get acceptedEvents() {
    return [...this.events.values()];
  }

  start(port = 0) {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this._handle(req, res));
      this.server.once('error', reject);
      this.server.listen(port, '127.0.0.1', () => resolve(this.server.address().port));
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.closeAllConnections?.();
      this.server.close(() => resolve());
    });
  }

  _json(res, status, body, headers = {}) {
    const text = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text), ...headers });
    res.end(text);
  }

  _ok(res, data) {
    this._json(res, 200, this.wrapped ? { success: true, message: 'ok', data } : data);
  }

  _handle(req, res) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        this._route(req, res, Buffer.concat(chunks).toString('utf8'));
      } catch (e) {
        this._json(res, 500, { success: false, message: String(e && e.message) });
      }
    });
  }

  _route(req, res, raw) {
    if (this.mode === 'down') {
      this.stats.refused++;
      return req.socket.destroy();
    }
    if (this.mode === 'error503') return this._json(res, 503, { success: false, message: 'Service Unavailable' });
    if (this.mode === 'ratelimit') return this._json(res, 429, { success: false, message: 'Too many requests' }, { 'retry-after': '1' });
    const keyOk = req.headers['x-device-key'] === this.deviceKey;
    const slugOk = req.headers['x-madrasa-slug'] === this.slug;
    if (this.mode === 'unauth' || !keyOk || !slugOk) {
      this.stats.unauthorized++;
      return this._json(res, 401, { success: false, message: 'Invalid device credentials' });
    }
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && url === BASE + '/config') {
      this.stats.configCalls++;
      return this._ok(res, { ...this.config, test_requested: this.testRequested, server_time: new Date().toISOString() });
    }
    const body = raw ? JSON.parse(raw) : {};
    if (req.method === 'POST' && url === BASE + '/heartbeat') {
      this.stats.heartbeatCalls++;
      this.heartbeats.push({ at: Date.now(), ...body });
      if (body.test_result) this.testRequested = false;
      return this._ok(res, { received: true });
    }
    if (req.method === 'POST' && url === BASE + '/ingest') return this._ingest(req, res, body);
    this._json(res, 404, { success: false, message: 'not found' });
  }

  _ingest(req, res, body) {
    this.stats.ingestCalls++;
    if (body.device_id !== this.deviceId || Number(body.institution_id) !== this.institutionId || !Array.isArray(body.events)) {
      return this._json(res, 400, { success: false, message: 'invalid ingest payload' });
    }
    this.ingestBatches.push(body.events.length);
    const results = [];
    for (const e of body.events) {
      this.received.push(e);
      if (!e.event_id || !e.device_user_id || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(String(e.timestamp))) {
        this.stats.rejected++;
        results.push({ event_id: e.event_id, status: 'rejected', reason: 'invalid event' });
      } else if (this.rejectUserIds.has(String(e.device_user_id))) {
        this.stats.rejected++;
        results.push({ event_id: e.event_id, status: 'rejected', reason: 'unknown device user' });
      } else if (this.events.has(e.event_id)) {
        this.stats.duplicates++;
        results.push({ event_id: e.event_id, status: 'duplicate' });
      } else {
        this.events.set(e.event_id, e);
        this.stats.accepted++;
        results.push({ event_id: e.event_id, status: 'accepted' });
      }
    }
    if (this.dropResponses > 0) {
      this.dropResponses--;
      return req.socket.destroy(); // processed, but the connector never hears back
    }
    this._ok(res, { results });
  }
}

module.exports = { FakeCloud };

if (require.main === module) {
  const c = new FakeCloud({ ip: process.env.K40_IP || '127.0.0.1', port: Number(process.env.K40_PORT || 4370) });
  c.start(Number(process.env.PORT || 8080)).then((p) => {
    console.log(`fake cloud on http://127.0.0.1:${p}  slug=${c.slug} deviceKey=${c.deviceKey} deviceId=${c.deviceId} institutionId=${c.institutionId}`);
    setInterval(() => console.log(JSON.stringify(c.stats), 'events', c.events.size), 10000);
  });
}
