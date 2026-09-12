import { z } from "zod";
import { MarkComponentType } from "@prisma/client";

const idSchema = z.coerce.number().int().positive();

export const saveMarkComponentsSchema = z.object({
  body: z.object({
    book_id: idSchema,
    exam_id: idSchema.nullable().optional(),
    components: z
      .array(
        z.object({
          component: z.nativeEnum(MarkComponentType),
          full_mark: z.coerce.number().int().positive(),
          sort_order: z.coerce.number().int().optional(),
        }),
      )
      .min(1),
  }),
});
