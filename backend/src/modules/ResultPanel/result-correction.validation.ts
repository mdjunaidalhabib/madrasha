import { z } from "zod";

const idSchema = z.coerce.number().int().positive();

// field cap mirrors ResultCorrection.field's @db.VarChar(50)
// (prisma/models/result.prisma). new_value/reason are @db.Text - unbounded.
export const requestCorrectionSchema = z.object({
  params: z.object({ resultMasterId: idSchema }),
  body: z.object({
    student_id: idSchema.optional(),
    book_id: idSchema.optional(),
    field: z.string().trim().min(1).max(50),
    new_value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    reason: z.string().trim().min(1, "reason is required"),
  }),
});

export const decideCorrectionSchema = z.object({
  params: z.object({ correctionId: idSchema }),
  body: z.object({
    approve: z.boolean(),
    decision_note: z.string().trim().optional(),
  }),
});
