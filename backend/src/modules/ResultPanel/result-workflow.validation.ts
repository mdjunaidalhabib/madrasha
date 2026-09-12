import { z } from "zod";

const idSchema = z.coerce.number().int().positive();

export const submitBookSchema = z.object({
  params: z.object({ resultMasterId: idSchema, bookId: idSchema }),
});

export const verifyBookSchema = z.object({
  params: z.object({ resultMasterId: idSchema, bookId: idSchema }),
  body: z.object({
    comment: z.string().trim().optional(),
  }),
});

export const rejectBookSchema = z.object({
  params: z.object({ resultMasterId: idSchema, bookId: idSchema }),
  body: z.object({
    reason: z.string().trim().min(1, "reason is required"),
  }),
});

export const verifyResultSchema = z.object({
  params: z.object({ resultMasterId: idSchema }),
  body: z.object({
    remarks: z.string().trim().optional(),
  }),
});

export const decideApprovalSchema = z.object({
  params: z.object({ resultMasterId: idSchema }),
  body: z.object({
    approve: z.boolean(),
    remarks: z.string().trim().optional(),
  }),
});

export const lockResultSchema = z.object({
  params: z.object({ resultMasterId: idSchema }),
});
