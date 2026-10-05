import { ZodTypeAny, z } from "zod";
import { ValidationError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import { localizeZodFlatten, vmsg } from "../../shared/validators/messages";
import { isValidDateString } from "../attendance/core/attendance-calendar";
import { LEAVE_STATUSES, LEAVE_TYPES, MAX_LEAVE_PAGE_LIMIT } from "./attendance-leave.constants";

const ATTENDEE_TYPES = ["STUDENT", "TEACHER", "STAFF"] as const;

const dateStr = z
  .string()
  .trim()
  .refine(isValidDateString, vmsg({ bn: "তারিখ YYYY-MM-DD ফরম্যাটে দিন", en: "Date must be YYYY-MM-DD" }));

const id = z.coerce.number().int().positive();
const reason = z.string().trim().min(1, vmsg({ bn: "কারণ লিখুন", en: "Reason is required" })).max(500);
const note = z.string().trim().max(255);

/* ================= admin ================= */

export const listLeavesQuerySchema = z.object({
  status: z.enum(LEAVE_STATUSES).optional(),
  attendee_type: z.enum(ATTENDEE_TYPES).optional(),
  attendee_id: id.optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LEAVE_PAGE_LIMIT).default(20),
});
export type ListLeavesQuery = z.infer<typeof listLeavesQuerySchema>;

export const createLeaveSchema = z.object({
  attendee_type: z.enum(ATTENDEE_TYPES),
  attendee_id: id,
  from_date: dateStr,
  to_date: dateStr,
  leave_type: z.enum(LEAVE_TYPES).default("other"),
  reason,
  approve_now: z.boolean().optional(),
});
export type CreateLeaveDto = z.infer<typeof createLeaveSchema>;

export const approveLeaveSchema = z.object({ note: note.optional() });
export type ApproveLeaveDto = z.infer<typeof approveLeaveSchema>;

export const rejectLeaveSchema = z.object({
  note: note.min(1, vmsg({ bn: "প্রত্যাখ্যানের কারণ লিখুন", en: "A note is required to reject" })),
});
export type RejectLeaveDto = z.infer<typeof rejectLeaveSchema>;

export const cancelLeaveSchema = z.object({ note: note.optional() });
export type CancelLeaveDto = z.infer<typeof cancelLeaveSchema>;

export const consecutiveQuerySchema = z.object({
  days: z.coerce.number().int().min(2).max(30).optional(),
  class_id: id.optional(),
});
export type ConsecutiveQuery = z.infer<typeof consecutiveQuerySchema>;

/* ================= guardian ================= */

export const guardianListLeavesQuerySchema = z.object({ student_id: id.optional() });
export type GuardianListLeavesQuery = z.infer<typeof guardianListLeavesQuerySchema>;

export const guardianCreateLeaveSchema = z.object({
  student_id: id,
  from_date: dateStr,
  to_date: dateStr,
  leave_type: z.enum(LEAVE_TYPES).default("other"),
  reason,
});
export type GuardianCreateLeaveDto = z.infer<typeof guardianCreateLeaveSchema>;

/** Validates a body/query with a schema; 422 with localized field errors on failure. */
export const parseDto = <S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> => {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new ValidationError(t({ bn: "তথ্য যাচাই ব্যর্থ হয়েছে", en: "Validation failed" }), localizeZodFlatten(result.error.flatten()));
  }
  return result.data;
};
