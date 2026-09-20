/** HTTPS client for the cloud connector API (contract: /api/attendance-devices/connector/*). */
import { redactText } from './logger';
import type { AppConfig } from './config';

export const CONNECTOR_VERSION = '1.0.0';
const BASE_PATH = '/api/attendance-devices/connector';

export interface CloudDeviceConfig {
  device_id?: string;
  name?: string;
  ip?: string | null;
  port?: number | null;
  comm_password?: string | number | null;
  poll_interval_sec?: number | null;
  test_requested?: boolean;
  server_time?: string;
}

export interface IngestEventPayload {
  event_id: string;
  device_user_id: string;
  timestamp: string;
  verify_type?: number;
  in_out_state?: number;
}

export interface IngestResult {
  event_id: string;
  status: 'accepted' | 'duplicate' | 'rejected';
  reason?: string;
}

export interface HeartbeatBody {
  device_id: string;
  device_status: 'online' | 'offline';
  last_device_contact_at?: string;
  error?: string;
  test_result?: { ok: boolean; message?: string };
  connector_version?: string;
}

/** Classified outcome of one HTTP call; never throws. */
export interface CloudResponse<T = unknown> {
  ok: boolean;
  /** 0 when the request never got an HTTP answer (network error / timeout) */
  status: number;
  data?: T;
  /** short, redacted */
  error?: string;
  kind: 'ok' | 'network' | 'auth' | 'rate_limited' | 'server' | 'client';
  retryAfterSec?: number;
}

/** Unwrap `{success, data}` (ApiResponse) or a bare payload. */
export function unwrap<T>(body: any): T | undefined {
  if (body === null || body === undefined) return undefined;
  if (typeof body === 'object' && 'data' in body && (body.data === null || typeof body.data === 'object')) {
    return (body.data ?? undefined) as T | undefined;
  }
  return body as T;
}

function shortMessage(body: any, fallback: string): string {
  let m: string | undefined;
  if (body && typeof body === 'object') m = body.message || body.error || body.reason;
  else if (typeof body === 'string') m = body;
  return redactText(String(m || fallback)).replace(/\s+/g, ' ').slice(0, 200);
}

export class CloudClient {
  constructor(private cfg: Pick<AppConfig, 'apiBaseUrl' | 'madrasaSlug' | 'deviceKey' | 'httpTimeoutMs'>) {}

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<CloudResponse<T>> {
    const url = `${this.cfg.apiBaseUrl}${BASE_PATH}${path}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.cfg.httpTimeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-device-key': this.cfg.deviceKey,
          'X-Madrasa-Slug': this.cfg.madrasaSlug,
          'user-agent': `attendance-connector/${CONNECTOR_VERSION}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl.signal,
        redirect: 'error',
      });
      let parsed: any;
      const text = await res.text();
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        parsed = text;
      }
      if (res.ok) return { ok: true, status: res.status, data: parsed as T, kind: 'ok' };
      const retryAfter = Number(res.headers.get('retry-after'));
      const base = { ok: false, status: res.status, error: `HTTP ${res.status}: ${shortMessage(parsed, res.statusText)}`, data: parsed as T };
      if (res.status === 401 || res.status === 403) return { ...base, kind: 'auth' };
      if (res.status === 429) return { ...base, kind: 'rate_limited', retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined };
      if (res.status >= 500 || res.status === 408) return { ...base, kind: 'server' };
      return { ...base, kind: 'client' };
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      const reason = ctl.signal.aborted ? `timeout after ${this.cfg.httpTimeoutMs}ms` : err.cause?.code || err.cause?.message || err.message;
      return { ok: false, status: 0, kind: 'network', error: `network error: ${redactText(String(reason))}`.slice(0, 200) };
    } finally {
      clearTimeout(timer);
    }
  }

  async getConfig(): Promise<CloudResponse<CloudDeviceConfig>> {
    const r = await this.call<any>('GET', '/config');
    if (!r.ok) return r as CloudResponse<CloudDeviceConfig>;
    return { ...r, data: unwrap<CloudDeviceConfig>(r.data) ?? {} };
  }

  heartbeat(body: HeartbeatBody): Promise<CloudResponse> {
    return this.call('POST', '/heartbeat', body);
  }

  async ingest(deviceId: string, institutionId: number, events: IngestEventPayload[]): Promise<CloudResponse<{ results: IngestResult[] }>> {
    const r = await this.call<any>('POST', '/ingest', { device_id: deviceId, institution_id: institutionId, events });
    if (!r.ok) return r as CloudResponse<{ results: IngestResult[] }>;
    const data = unwrap<{ results?: IngestResult[] }>(r.data);
    const results = Array.isArray(data?.results) ? data!.results! : Array.isArray((r.data as any)?.results) ? (r.data as any).results : undefined;
    if (!results) {
      return { ok: false, status: r.status, kind: 'server', error: 'ingest reply has no results array' };
    }
    return { ...r, data: { results } };
  }
}
