import type { AxiosRequestConfig, AxiosResponse } from "axios";
import api from "./api";
import type {
  AttendanceDevice,
  CreateDevicePayload,
  CreatedDevice,
  MappingPage,
  MappingQuery,
  StudentMapping,
  TodayQuery,
  TodayReport,
  TodayRow,
  SmsStatus,
  UnmappedDeviceUser,
  UpdateDevicePayload,
} from "../features/attendance-device/types";

/**
 * K40 attendance-device admin API (/api/attendance-devices). Responses use the
 * app's { success, message, data } envelope - every function here unwraps it
 * and returns the typed `data`. Pass `{ silent: true }` for background polling
 * so a failed refresh doesn't pop the generic error toast every few seconds.
 */

const BASE = "/attendance-devices";

type Envelope<T> = { success?: boolean; message?: string; data: T };

const unwrap = <T>(res: AxiosResponse<Envelope<T>>): T => res.data?.data;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const num = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** The paginated mapping list may arrive as an array (+ meta), or wrapped in
 * items/rows/students - accept all of them so a small backend shape change
 * doesn't blank the page. */
const toMapping = (m: any): StudentMapping => ({
  ...m,
  name_bn: m?.name_bn ?? m?.name ?? "",
});

const normalizeMappingPage = (res: AxiosResponse<any>): MappingPage => {
  const body = res.data ?? {};
  const data = body.data ?? body;

  if (Array.isArray(data)) {
    const meta = body.meta ?? body.pagination ?? {};
    return { items: data.map(toMapping), total: num(meta.total ?? body.total, data.length) };
  }

  const items = asArray<StudentMapping>(data.items ?? data.rows ?? data.students ?? data.data);
  const meta = data.meta ?? data.pagination ?? {};
  return { items: items.map(toMapping), total: num(data.total ?? meta.total, items.length) };
};

export const attendanceDeviceApi = {
  listStatus: async (config?: AxiosRequestConfig) =>
    asArray<AttendanceDevice>(unwrap(await api.get(`${BASE}/devices/status`, config))),

  create: async (payload: CreateDevicePayload) =>
    unwrap<CreatedDevice>(await api.post(`${BASE}/devices`, payload)),

  update: async (id: number, payload: UpdateDevicePayload) =>
    unwrap<AttendanceDevice>(await api.patch(`${BASE}/devices/${id}`, payload)),

  remove: async (id: number) => {
    await api.delete(`${BASE}/devices/${id}`);
  },

  rotateKey: async (id: number) =>
    unwrap<{ raw_key: string }>(await api.post(`${BASE}/devices/${id}/rotate-key`)),

  requestTest: async (id: number) => {
    await api.post(`${BASE}/devices/${id}/request-test`);
  },

  listMappings: async (params: MappingQuery, config?: AxiosRequestConfig) =>
    normalizeMappingPage(await api.get(`${BASE}/mappings`, { ...config, params })),

  setMapping: async (studentId: number, deviceUserId: string) => {
    await api.put(
      `${BASE}/mappings`,
      { student_id: studentId, device_user_id: deviceUserId },
      // The caller shows conflicts inline next to the row.
      { silent: true },
    );
  },

  clearMapping: async (studentId: number) => {
    await api.delete(`${BASE}/mappings/${studentId}`, { silent: true });
  },

  listUnmappedUsers: async (config?: AxiosRequestConfig) =>
    asArray<UnmappedDeviceUser>(unwrap(await api.get(`${BASE}/unmapped-users`, config))),

  getToday: async (params: TodayQuery, config?: AxiosRequestConfig): Promise<TodayReport> => {
    // The SMS status lives on a separate endpoint (/sms-status); a failure
    // there must not blank the attendance table, so it is fetched best-effort.
    const [todayRes, smsRes] = await Promise.all([
      api.get(`${BASE}/today`, { ...config, params }),
      api
        .get(`${BASE}/sms-status`, { ...config, params: { date: params.date } as Record<string, any> })
        .catch(() => null),
    ]);
    const data: any = unwrap(todayRes);

    const smsByStudent = new Map<number, SmsStatus>();
    for (const it of asArray<any>(unwrap<any>(smsRes as any)?.items)) {
      if (it?.student_id != null && it?.status) {
        smsByStudent.set(Number(it.student_id), String(it.status).toUpperCase() as SmsStatus);
      }
    }

    const rows: TodayRow[] = asArray<any>(data?.items ?? data?.rows).map((r) => ({
      ...r,
      name_bn: r?.name_bn ?? r?.student_name ?? (r?.student_id == null ? "ম্যাপ করা হয়নি" : ""),
      sms_status: r?.student_id != null ? (smsByStudent.get(Number(r.student_id)) ?? null) : null,
    }));

    return {
      summary: {
        present: num(data?.summary?.present),
        unmapped: num(data?.summary?.unmapped),
        total_punches: num(data?.summary?.total_punches),
        last_sync_at: data?.summary?.last_sync_at ?? null,
      },
      rows,
    };
  },
};

export const getApiErrorMessage = (err: unknown, fallback: string) =>
  (err as any)?.response?.data?.message || fallback;
