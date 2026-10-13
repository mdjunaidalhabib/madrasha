import { z } from "zod";
import { vmsg } from "../../shared/validators/messages";

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
    reason: z.string().trim().min(1, vmsg({ bn: "কারণ আবশ্যক", en: "reason is required" })),
  }),
});

export const unpublishResultSchema = z.object({
  params: z.object({ resultMasterId: idSchema }),
});
