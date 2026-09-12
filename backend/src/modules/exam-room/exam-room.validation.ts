import { z } from "zod";

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

// String length caps mirror ExamRoom's @db.VarChar limits (exam-operations.prisma):
// name VarChar(100), code VarChar(30), floor VarChar(50), location VarChar(150), notes VarChar(500).
export const createExamRoomSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    code: z.string().trim().min(1).max(30),
    capacity: z.coerce.number().int().min(0).optional(),
    floor: z.string().trim().max(50).optional(),
    location: z.string().trim().max(150).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
});

export const updateExamRoomSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    code: z.string().trim().min(1).max(30).optional(),
    capacity: z.coerce.number().int().min(0).optional(),
    floor: z.string().trim().max(50).optional(),
    location: z.string().trim().max(150).optional(),
    notes: z.string().trim().max(500).optional(),
    is_active: z.boolean().optional(),
  }),
});

export const deactivateExamRoomSchema = z.object({
  params: idParamsSchema,
});
