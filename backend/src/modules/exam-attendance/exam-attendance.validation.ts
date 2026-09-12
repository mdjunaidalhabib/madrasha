import { z } from "zod";
import { EXAM_ATTENDANCE_STATUSES } from "./exam-attendance.constants";

const idSchema = z.coerce.number().int().positive();
const idParamsSchema = z.object({ id: idSchema });
const MAX_BULK_ENTRIES = 200; // mirrors exam-attendance.service.ts's MAX_BULK_ENTRIES

// remarks cap mirrors ExamAttendance.remarks's @db.VarChar(300)
// (prisma/models/exam-operations.prisma).
export const bulkMarkExamAttendanceSchema = z.object({
  body: z.object({
    exam_routine_id: idSchema,
    entries: z
      .array(
        z.object({
          exam_candidate_id: idSchema,
          status: z.enum(EXAM_ATTENDANCE_STATUSES),
          remarks: z.string().trim().max(300).optional(),
        }),
      )
      .min(1)
      .max(MAX_BULK_ENTRIES),
    mark_absent_by_default: z.boolean().optional(),
  }),
});

export const updateExamAttendanceSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    status: z.enum(EXAM_ATTENDANCE_STATUSES).optional(),
    remarks: z.string().trim().max(300).optional(),
  }),
});

export const lockExamAttendanceSchema = z.object({
  body: z.object({
    exam_routine_id: idSchema,
  }),
});

export const unlockExamAttendanceSchema = z.object({
  body: z.object({
    exam_routine_id: idSchema,
  }),
});
