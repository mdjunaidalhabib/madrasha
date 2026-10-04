/** HTTPS client for the cloud connector API (contract: /api/attendance-devices/connector/*). */
import { redactText } from './logger';
import type { AppConfig } from './config';

export const CONNECTOR_VERSION = '1.1.0';
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
  /** sha256 of the desired device user list (GET /users); differs from our synced version -> user sync */
  users_version?: string;
  /** correct the K40 clock automatically (default true when absent) */
  auto_time_sync?: boolean;
}

export type AttendeeType = 'STUDENT' | 'TEACHER' | 'STAFF';

/** One person the K40 should know. pin = device user id; name is ASCII, max 24 bytes. */
export interface CloudUser {
  pin: string;
  name: string;
  card: string | null;
  attendee_type: AttendeeType;
  /**
   * v2.1: the person's previous PIN (map.previousDeviceUserId) after a PIN conversion, else null/absent.
   * If `pin` is not on the device but `prev_pin` is, that record is renamed in place (keeps fingerprints).
   */
  prev_pin?: string | null;
}

export interface CloudUserList {
  version: string;
  users: CloudUser[];
}

export interface CloudEnrollment {
  id: number | string;
  device_user_id: string;
  name: string;
  card_number: string | null;
  attendee_type: AttendeeType;
  expires_at: string;
}

export interface CloudCommands {
  enrollment: CloudEnrollment | null;
  users_version?: string;
  server_time?: string;
}

export type EnrollmentReportStatus = 'waiting' | 'captured' | 'failed' | 'expired';

export interface EnrollmentReply {
  ok: boolean;
  status: string;
  message?: string;
  user?: { pin: string; name: string; card: string | null };
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
  /** device clock minus PC clock, seconds */
  clock_drift_sec?: number;
  users_synced_version?: string;
  user_sync_error?: string | null;
  device_user_count?: number;
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

  /**
   * @param opts.timeoutMs per-call timeout (default httpTimeoutMs; long-poll calls pass wait + 10 s)
   * @param opts.signal external abort (connector stop) - reported as a network error
   */
  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    opts: { timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<CloudResponse<T>> {
    const url = `${this.cfg.apiBaseUrl}${BASE_PATH}${path}`;
    const ctl = new AbortController();
    const timeoutMs = opts.timeoutMs ?? this.cfg.httpTimeoutMs;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, timeoutMs);
    const onExternalAbort = () => ctl.abort();
    if (opts.signal) {
      if (opts.signal.aborted) ctl.abort();
      else opts.signal.addEventListener('abort', onExternalAbort, { once: true });
    }
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
      const reason = timedOut
        ? `timeout after ${timeoutMs}ms`
        : ctl.signal.aborted
          ? 'aborted (stopping)'
          : err.cause?.code || err.cause?.message || err.message;
      return { ok: false, status: 0, kind: 'network', error: `network error: ${redactText(String(reason))}`.slice(0, 200) };
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  /** Desired device user list. */
  async getUsers(): Promise<CloudResponse<CloudUserList>> {
    const r = await this.call<any>('GET', '/users');
    if (!r.ok) return r as CloudResponse<CloudUserList>;
    const d = unwrap<CloudUserList>(r.data);
    if (!d || typeof d.version !== 'string' || !Array.isArray(d.users)) {
      return { ok: false, status: r.status, kind: 'server', error: 'users reply has no version/users' };
    }
    return { ...r, data: d };
  }

  /** Long-poll for work (pending enrollment). HTTP timeout = wait + 10 s. */
  async commands(waitSec: number, signal?: AbortSignal): Promise<CloudResponse<CloudCommands>> {
    const w = Math.max(0, Math.min(25, Math.round(waitSec)));
    const r = await this.call<any>('GET', `/commands?wait=${w}`, undefined, { timeoutMs: (w + 10) * 1000, signal });
    if (!r.ok) return r as CloudResponse<CloudCommands>;
    const d = unwrap<CloudCommands>(r.data);
    return { ...r, data: { enrollment: d?.enrollment ?? null, users_version: d?.users_version, server_time: d?.server_time } };
  }

  /** Report enrollment progress. A reply with ok:false means stop (cancelled / expired / card already used ...). */
  async reportEnrollment(
    id: number | string,
    body: { device_id: string; status: EnrollmentReportStatus; card_number?: string; message?: string },
  ): Promise<CloudResponse<EnrollmentReply>> {
    const r = await this.call<any>('POST', `/enrollments/${encodeURIComponent(String(id))}`, body);
    if (!r.ok) return r as CloudResponse<EnrollmentReply>;
    const d = unwrap<EnrollmentReply>(r.data);
    if (!d || typeof d.ok !== 'boolean') return { ok: false, status: r.status, kind: 'server', error: 'enrollment reply has no ok flag' };
    return { ...r, data: d };
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
