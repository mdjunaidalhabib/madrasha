import { Request, Response } from "express";
import { ZodTypeAny, z } from "zod";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError, UnauthorizedError, ValidationError } from "../../shared/errors";
import {
  assignPinsSchema,
  convertPinsSchema,
  commandsQuerySchema,
  connectorConfigQuerySchema,
  createDeviceSchema,
  createEnrollmentSchema,
  createHolidaySchema,
  enrollmentReportSchema,
  holidaysQuerySchema,
  peopleQuerySchema,
  personParamsSchema,
  setCardSchema,
  updateSettingsSchema,
  heartbeatSchema,
  ingestSchema,
  listMappingsQuerySchema,
  setMappingSchema,
  smsStatusQuerySchema,
  todayQuerySchema,
  updateDeviceSchema,
} from "./attendance-device.dto";
import { attendanceDeviceService } from "./attendance-device.service";
import { attendanceDeviceIngestService } from "./attendance-device-ingest.service";
import { attendanceDeviceEnrollmentService } from "./attendance-device-enrollment.service";
import { attendanceDevicePeopleService } from "./attendance-device-people.service";
import { attendanceDeviceSettingsService } from "./attendance-device-settings.service";
import { t } from "../../shared/i18n";
import { localizeZodFlatten } from "../../shared/validators/messages";

const madrasaIdOf = (req: Request): number => {
  const id = req.tenant?.madrasa_id;
  if (!id) throw new TenantNotFoundInRequestError();
  return Number(id);
};

const deviceOf = (req: Request) => {
  if (!req.attendanceDevice) throw new UnauthorizedError(t({ bn: "ডিভাইস যাচাই করা হয়নি", en: "Device not authenticated" }));
  return req.attendanceDevice;
};

const parse = <S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> => {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError(t({ bn: "তথ্য যাচাই ব্যর্থ হয়েছে", en: "Validation failed" }), localizeZodFlatten(result.error.flatten()));
  return result.data;
};

const idParam = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(t({ bn: "id সঠিক নয়", en: "id is invalid" }));
  return id;
};

/* ================= connector-facing ================= */

export const connectorConfig = asyncHandler(async (req: Request, res: Response) => {
  parse(connectorConfigQuerySchema, req.query);
  const config = await attendanceDeviceIngestService.getConnectorConfig(deviceOf(req));
  // Fields are provided both under `data` (ApiResponse envelope) and at top level.
  return ApiResponse.success(res, { data: config, extra: config });
});

export const connectorHeartbeat = asyncHandler(async (req: Request, res: Response) => {
  const dto = parse(heartbeatSchema, req.body);
  const data = await attendanceDeviceIngestService.heartbeat(deviceOf(req), dto);
  return ApiResponse.success(res, { data, extra: data });
});

export const connectorIngest = asyncHandler(async (req: Request, res: Response) => {
  const dto = parse(ingestSchema, req.body);
  const { results, summary } = await attendanceDeviceIngestService.ingest(deviceOf(req), dto);
  return ApiResponse.success(res, { data: { results, summary }, extra: { results, summary } });
});

/** Desired K40 user list (PIN, ASCII name, card) the connector writes to the device. */
export const connectorUsers = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDevicePeopleService.connectorUsers(deviceOf(req).madrasaId);
  return ApiResponse.success(res, { data, extra: data });
});

/** Long-poll for the next enrollment of this device (client disconnect ends the wait). */
export const connectorCommands = asyncHandler(async (req: Request, res: Response) => {
  const q = parse(commandsQuerySchema, req.query);
  let aborted = false;
  // res 'close' before the response was written = the client went away
  // (req 'close' fires as soon as the request body is consumed on Node >= 16).
  res.on("close", () => {
    if (!res.writableEnded) aborted = true;
  });
  const data = await attendanceDeviceEnrollmentService.commands(deviceOf(req), q.wait, () => aborted);
  if (aborted || res.headersSent) return;
  return ApiResponse.success(res, { data, extra: data });
});

export const connectorEnrollmentReport = asyncHandler(async (req: Request, res: Response) => {
  const dto = parse(enrollmentReportSchema, req.body);
  const data = await attendanceDeviceEnrollmentService.report(deviceOf(req), idParam(req), dto);
  // data only: its `message` must not shadow the envelope's.
  return ApiResponse.success(res, { data });
});

/* ================= admin: devices ================= */

export const listDevices = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.listDevices(madrasaIdOf(req));
  return ApiResponse.success(res, { data });
});

export const createDevice = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.createDevice(madrasaIdOf(req), parse(createDeviceSchema, req.body));
  return ApiResponse.success(res, { message: t({ bn: "ডিভাইস যোগ করা হয়েছে", en: "Device added" }), data, statusCode: 201 });
});

export const updateDevice = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.updateDevice(
    madrasaIdOf(req),
    idParam(req),
    parse(updateDeviceSchema, req.body),
  );
  return ApiResponse.success(res, { message: t({ bn: "ডিভাইস আপডেট করা হয়েছে", en: "Device updated" }), data });
});

export const deleteDevice = asyncHandler(async (req: Request, res: Response) => {
  await attendanceDeviceService.deleteDevice(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { message: t({ bn: "ডিভাইস মুছে ফেলা হয়েছে", en: "Device deleted" }) });
});

export const rotateDeviceKey = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.rotateKey(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { message: t({ bn: "নতুন কী তৈরি হয়েছে", en: "New key generated" }), data });
});

export const requestDeviceTest = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.requestTest(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { message: t({ bn: "কানেকশন টেস্ট অনুরোধ করা হয়েছে", en: "Connection test requested" }), data });
});

/* ================= admin: mappings ================= */

export const listMappings = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.listMappings(madrasaIdOf(req), parse(listMappingsQuerySchema, req.query));
  return ApiResponse.success(res, {
    data,
    extra: { pagination: { page: data.page, limit: data.limit, total: data.total, totalPages: data.total_pages } },
  });
});

export const setMapping = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.setMapping(madrasaIdOf(req), parse(setMappingSchema, req.body));
  return ApiResponse.success(res, { message: t({ bn: "ম্যাপিং সংরক্ষণ করা হয়েছে", en: "Mapping saved" }), data });
});

export const deleteMapping = asyncHandler(async (req: Request, res: Response) => {
  await attendanceDeviceService.deleteMapping(madrasaIdOf(req), Number(req.params.studentId));
  return ApiResponse.success(res, { message: t({ bn: "ম্যাপিং মুছে ফেলা হয়েছে", en: "Mapping deleted" }) });
});

export const listUnmappedUsers = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.unmappedUsers(madrasaIdOf(req));
  return ApiResponse.success(res, { data });
});

/* ================= admin: settings / holidays ================= */

/** Settings + read-only `pin_warnings` (registration-number PIN ranges that may overlap). */
const withPinWarnings = async (madrasaId: number, settings: object) => ({
  ...settings,
  pin_warnings: await attendanceDevicePeopleService.pinWarnings(madrasaId),
});

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = madrasaIdOf(req);
  const data = await withPinWarnings(madrasaId, await attendanceDeviceSettingsService.getSettings(madrasaId));
  return ApiResponse.success(res, { data });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = madrasaIdOf(req);
  const saved = await attendanceDeviceSettingsService.updateSettings(madrasaId, parse(updateSettingsSchema, req.body));
  const data = await withPinWarnings(madrasaId, saved);
  return ApiResponse.success(res, { message: t({ bn: "সেটিংস সংরক্ষণ করা হয়েছে", en: "Settings saved" }), data });
});

export const listHolidays = asyncHandler(async (req: Request, res: Response) => {
  const q = parse(holidaysQuerySchema, req.query);
  const data = await attendanceDeviceSettingsService.listHolidays(madrasaIdOf(req), q.year);
  return ApiResponse.success(res, { data });
});

export const createHoliday = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceSettingsService.createHoliday(madrasaIdOf(req), parse(createHolidaySchema, req.body));
  return ApiResponse.success(res, { message: t({ bn: "ছুটি যোগ করা হয়েছে", en: "Holiday added" }), data, statusCode: 201 });
});

export const deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
  await attendanceDeviceSettingsService.deleteHoliday(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { message: t({ bn: "ছুটি মুছে ফেলা হয়েছে", en: "Holiday deleted" }) });
});

/* ================= admin: people / cards ================= */

const personParams = (req: Request) => {
  const p = parse(personParamsSchema, req.params);
  return { type: p.attendeeType, id: p.attendeeId };
};

export const listPeople = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDevicePeopleService.listPeople(madrasaIdOf(req), parse(peopleQuerySchema, req.query));
  return ApiResponse.success(res, {
    data,
    extra: { pagination: { page: data.page, limit: data.limit, total: data.total, totalPages: data.total_pages } },
  });
});

export const assignPins = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDevicePeopleService.assignPins(madrasaIdOf(req), parse(assignPinsSchema, req.body));
  return ApiResponse.success(res, { message: t({ bn: "ডিভাইস আইডি (PIN) বরাদ্দ করা হয়েছে", en: "Device PINs assigned" }), data });
});

export const convertPins = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDevicePeopleService.convertPins(madrasaIdOf(req), parse(convertPinsSchema, req.body ?? {}));
  return ApiResponse.success(res, {
    message: t({ bn: "PIN রেজিস্ট্রেশন নম্বরে রূপান্তর করা হয়েছে", en: "PINs converted to registration numbers" }),
    data,
  });
});

export const setCard = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDevicePeopleService.setCard(madrasaIdOf(req), parse(setCardSchema, req.body));
  return ApiResponse.success(res, { message: t({ bn: "কার্ড সংরক্ষণ করা হয়েছে", en: "Card saved" }), data });
});

export const clearCard = asyncHandler(async (req: Request, res: Response) => {
  await attendanceDevicePeopleService.clearCard(madrasaIdOf(req), personParams(req));
  return ApiResponse.success(res, { message: t({ bn: "কার্ড সরানো হয়েছে", en: "Card removed" }) });
});

export const deletePersonMap = asyncHandler(async (req: Request, res: Response) => {
  await attendanceDevicePeopleService.deleteMap(madrasaIdOf(req), personParams(req));
  return ApiResponse.success(res, { message: t({ bn: "ম্যাপিং মুছে ফেলা হয়েছে", en: "Mapping deleted" }) });
});

/* ================= admin: enrollment ================= */

export const createEnrollment = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.user?.id) || null;
  const data = await attendanceDeviceEnrollmentService.create(madrasaIdOf(req), userId, parse(createEnrollmentSchema, req.body));
  return ApiResponse.success(res, {
    message: t({ bn: "ডিভাইসে কার্ড স্পর্শ করুন", en: "Tap the card on the device" }),
    data,
    statusCode: 201,
  });
});

export const getEnrollment = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceEnrollmentService.get(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { data });
});

export const cancelEnrollment = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceEnrollmentService.cancel(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { message: t({ bn: "এনরোলমেন্ট বাতিল করা হয়েছে", en: "Enrollment cancelled" }), data });
});

/* ================= admin: today / sms ================= */

export const getToday = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.today(madrasaIdOf(req), parse(todayQuerySchema, req.query));
  return ApiResponse.success(res, { data });
});

export const getSmsStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.smsStatus(madrasaIdOf(req), parse(smsStatusQuerySchema, req.query));
  return ApiResponse.success(res, { data });
});
