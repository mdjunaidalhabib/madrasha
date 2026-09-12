import { z } from "zod";

const idSchema = z.coerce.number().int().positive();
const idParamsSchema = z.object({ id: idSchema });

// Enums mirror InvigilatorType/InvigilatorRole/InvigilatorAssignmentStatus
// (prisma/models/exam-operations.prisma). notes cap mirrors
// ExamInvigilatorAssignment.notes's @db.VarChar(300).
export const assignInvigilatorSchema = z.object({
  body: z.object({
    exam_routine_id: idSchema,
    invigilator_type: z.enum(["TEACHER", "STAFF"]),
    invigilator_id: idSchema,
    role: z.enum(["CHIEF", "ASSISTANT"]).optional(),
    notes: z.string().trim().max(300).optional(),
  }),
});

export const updateInvigilatorStatusSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    status: z.enum(["ASSIGNED", "CONFIRMED", "CANCELLED"]),
  }),
});

export const removeInvigilatorAssignmentSchema = z.object({
  params: idParamsSchema,
});
