import type { AxiosRequestConfig, AxiosResponse } from "axios";
import api from "./api";
import { getText } from "@madrasha/shared-ui/src/i18n";
import { servicesText } from "./services.text";
import type {
  AttendanceDevice,
  AttendanceHoliday,
  AttendeeType,
  CardPerson,
  ClassSummary,
  CreateDevicePayload,
  CreatedDevice,
  DeviceSettings,
  Enrollment,
  MappingPage,
  MappingQuery,
  NotArrivedItem,
  PeoplePage,
  PeopleQuery,
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

const strOrNull = (value: unknown) =>
  value === null || value === undefined || value === "" ? null : String(value);

/** The paginated mapping list may arrive as an array (+ meta), or wrapped in
 * items/rows/students - accept all of them so a small backend shape change
 * doesn't blank the page. */
const toMapping = (m: any): StudentMapping => ({
  ...m,
  name_bn: m?.name_bn ?? m?.name ?? "",
  card_number: strOrNull(m?.card_number),
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

export const toCardPerson = (p: any): CardPerson => ({
  attendee_type: (p?.attendee_type ?? "STUDENT") as AttendeeType,
  attendee_id: num(p?.attendee_id),
  name: String(p?.name ?? p?.name_bn ?? p?.name_en ?? ""),
  name_en: strOrNull(p?.name_en),
  image: strOrNull(p?.image),
  roll: p?.roll ?? null,
  registration_no: p?.registration_no ?? null,
  class_id: p?.class_id == null ? null : num(p.class_id),
  class_name: strOrNull(p?.class_name),
  designation: strOrNull(p?.designation),
  device_user_id: strOrNull(p?.device_user_id),
  card_number: strOrNull(p?.card_number),
  auto_assigned: Boolean(p?.auto_assigned),
});

const PEOPLE_PAGE_LIMIT = 500;

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
    const isStudents = (params.attendee_type ?? "STUDENT") === "STUDENT";
    const [todayRes, smsRes] = await Promise.all([
      api.get(`${BASE}/today`, { ...config, params }),
      isStudents
        ? api
            .get(`${BASE}/sms-status`, { ...config, params: { date: params.date } as Record<string, any> })
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    const data: any = unwrap(todayRes);

    const smsByStudent = new Map<number, SmsStatus>();
    for (const it of asArray<any>(unwrap<any>(smsRes as any)?.items)) {
      if (it?.student_id != null && it?.status) {
        smsByStudent.set(Number(it.student_id), String(it.status).toUpperCase() as SmsStatus);
      }
    }

    const rows: TodayRow[] = asArray<any>(data?.items ?? data?.rows).map((r) => {
      const attendeeId = r?.attendee_id ?? r?.student_id ?? null;
      const mapped = r?.mapped ?? attendeeId != null;
      return {
        ...r,
        attendee_type: (r?.attendee_type ?? params.attendee_type ?? "STUDENT") as AttendeeType,
        attendee_id: attendeeId == null ? null : Number(attendeeId),
        student_id: r?.student_id ?? null,
        mapped: Boolean(mapped),
        name_bn: r?.name_bn ?? r?.student_name ?? r?.name ?? (mapped ? "" : getText(servicesText).notMapped),
        status: r?.status ?? null,
        check_out_at: r?.check_out_at ?? null,
        punch_count: num(r?.punch_count, 1),
        sms_status: r?.student_id != null ? (smsByStudent.get(Number(r.student_id)) ?? null) : null,
      };
    });

    const s = data?.summary ?? {};
    return {
      date: data?.date ?? params.date ?? null,
      attendee_type: (data?.attendee_type ?? params.attendee_type ?? "STUDENT") as AttendeeType,
      is_holiday: Boolean(data?.is_holiday),
      holiday_title: data?.holiday_title ?? null,
      summary: {
        present: num(s.present),
        late: num(s.late),
        absent: num(s.absent),
        not_arrived: num(s.not_arrived),
        checked_out: num(s.checked_out),
        unmapped: num(s.unmapped),
        total_punches: num(s.total_punches),
        rejected_punches: num(s.rejected_punches),
        last_sync_at: s.last_sync_at ?? null,
        mapped_total: num(s.mapped_total),
      },
      rows,
      not_arrived: asArray<NotArrivedItem>(data?.not_arrived),
      classes: asArray<ClassSummary>(data?.classes),
    };
  },

  /* ---------- settings + holidays ---------- */

  getSettings: async (config?: AxiosRequestConfig) =>
    unwrap<DeviceSettings>(await api.get(`${BASE}/settings`, config)),

  updateSettings: async ({ pin_warnings: _ignored, ...payload }: Partial<DeviceSettings>) =>
    unwrap<DeviceSettings>(await api.put(`${BASE}/settings`, payload, { silent: true })),

  listHolidays: async (year: number, config?: AxiosRequestConfig) =>
    asArray<AttendanceHoliday>(unwrap(await api.get(`${BASE}/holidays`, { ...config, params: { year } as Record<string, any> }))),

  addHoliday: async (payload: { date: string; title: string }) =>
    unwrap<AttendanceHoliday>(await api.post(`${BASE}/holidays`, payload, { silent: true })),

  removeHoliday: async (id: number) => {
    await api.delete(`${BASE}/holidays/${id}`);
  },

  /* ---------- people / cards ---------- */

  listPeople: async (params: PeopleQuery, config?: AxiosRequestConfig): Promise<PeoplePage> => {
    const query: Record<string, unknown> = { ...params };
    if (params.has_card !== undefined) query.has_card = String(params.has_card);
    const data: any = unwrap(await api.get(`${BASE}/people`, { ...config, params: query }));
    const items = asArray<any>(data?.items ?? data).map(toCardPerson);
    return {
      items,
      total: num(data?.total, items.length),
      page: num(data?.page, 1),
      limit: num(data?.limit, params.limit ?? items.length),
      total_pages: num(data?.total_pages, 1),
    };
  },

  /** Every eligible person of one type (pages through the API, 500 at a time). */
  listAllPeople: async (
    params: Omit<PeopleQuery, "page" | "limit">,
    config?: AxiosRequestConfig,
  ): Promise<CardPerson[]> => {
    const all: CardPerson[] = [];
    for (let page = 1; page <= 50; page++) {
      const res = await attendanceDeviceApi.listPeople({ ...params, page, limit: PEOPLE_PAGE_LIMIT }, config);
      all.push(...res.items);
      if (page >= res.total_pages || res.items.length === 0) break;
    }
    return all;
  },

  assignPins: async (payload: { attendee_type: AttendeeType; class_id?: number }) =>
    unwrap<{ created: number }>(await api.post(`${BASE}/people/assign-pins`, payload)),

  /** Re-number system-assigned IDs to the registration-number scheme (fingerprints/cards are kept by the connector). */
  convertPins: async (payload: { attendee_type?: AttendeeType } = {}) =>
    unwrap<{ changed: number; skipped: number }>(await api.post(`${BASE}/people/convert-pins`, payload)),

  /** Manual / USB-reader card entry. Silent - the caller shows conflicts inline. */
  setCard: async (payload: { attendee_type: AttendeeType; attendee_id: number; card_number: string }) =>
    toCardPerson(unwrap(await api.put(`${BASE}/people/card`, payload, { silent: true }))),

  clearCard: async (attendeeType: AttendeeType, attendeeId: number) => {
    await api.delete(`${BASE}/people/card/${attendeeType}/${attendeeId}`);
  },

  deleteMap: async (attendeeType: AttendeeType, attendeeId: number) => {
    await api.delete(`${BASE}/people/map/${attendeeType}/${attendeeId}`);
  },

  /* ---------- card enrollment on the K40 ---------- */

  createEnrollment: async (payload: {
    attendee_type: AttendeeType;
    attendee_id: number;
    device_id?: number;
  }) => unwrap<Enrollment>(await api.post(`${BASE}/enrollments`, payload, { silent: true })),

  getEnrollment: async (id: number) =>
    unwrap<Enrollment>(await api.get(`${BASE}/enrollments/${id}`, { silent: true })),

  cancelEnrollment: async (id: number) =>
    unwrap<Enrollment>(await api.post(`${BASE}/enrollments/${id}/cancel`, undefined, { silent: true })),
};

export const getApiErrorMessage = (err: unknown, fallback: string) =>
  (err as any)?.response?.data?.message || fallback;
