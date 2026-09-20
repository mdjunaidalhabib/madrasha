import { Request, Response } from "express";
import { ZodTypeAny, z } from "zod";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError, UnauthorizedError, ValidationError } from "../../shared/errors";
import {
  connectorConfigQuerySchema,
  createDeviceSchema,
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

const madrasaIdOf = (req: Request): number => {
  const id = req.tenant?.madrasa_id;
  if (!id) throw new TenantNotFoundInRequestError();
  return Number(id);
};

const deviceOf = (req: Request) => {
  if (!req.attendanceDevice) throw new UnauthorizedError("Device not authenticated");
  return req.attendanceDevice;
};

const parse = <S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> => {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError("Validation failed", result.error.flatten());
  return result.data;
};

const idParam = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError("id is invalid");
  return id;
};

/* ================= connector-facing ================= */

export const connectorConfig = asyncHandler(async (req: Request, res: Response) => {
  parse(connectorConfigQuerySchema, req.query);
  const config = attendanceDeviceIngestService.getConnectorConfig(deviceOf(req));
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

/* ================= admin: devices ================= */

export const listDevices = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.listDevices(madrasaIdOf(req));
  return ApiResponse.success(res, { data });
});

export const createDevice = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.createDevice(madrasaIdOf(req), parse(createDeviceSchema, req.body));
  return ApiResponse.success(res, { message: "ডিভাইস যোগ করা হয়েছে", data, statusCode: 201 });
});

export const updateDevice = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.updateDevice(
    madrasaIdOf(req),
    idParam(req),
    parse(updateDeviceSchema, req.body),
  );
  return ApiResponse.success(res, { message: "ডিভাইস আপডেট করা হয়েছে", data });
});

export const deleteDevice = asyncHandler(async (req: Request, res: Response) => {
  await attendanceDeviceService.deleteDevice(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { message: "ডিভাইস মুছে ফেলা হয়েছে" });
});

export const rotateDeviceKey = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.rotateKey(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { message: "নতুন কী তৈরি হয়েছে", data });
});

export const requestDeviceTest = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.requestTest(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { message: "কানেকশন টেস্ট অনুরোধ করা হয়েছে", data });
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
  return ApiResponse.success(res, { message: "ম্যাপিং সংরক্ষণ করা হয়েছে", data });
});

export const deleteMapping = asyncHandler(async (req: Request, res: Response) => {
  await attendanceDeviceService.deleteMapping(madrasaIdOf(req), Number(req.params.studentId));
  return ApiResponse.success(res, { message: "ম্যাপিং মুছে ফেলা হয়েছে" });
});

export const listUnmappedUsers = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceDeviceService.unmappedUsers(madrasaIdOf(req));
  return ApiResponse.success(res, { data });
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
