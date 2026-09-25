import { z } from "zod";

const nameField = z.string().trim().max(200).nullable().optional();

/**
 * Body shape for the নাম (৩ ভাষা) page's bulk save - only the বাংলা/আরবি/
 * English name columns (same keys the list API returns: name_bn, name_ar,
 * name_en). name_bn is required on the model, so it may be omitted but never
 * blanked. Mirrors studentNamesBulkSchema.
 */
export const teacherNamesBulkSchema = z.object({
  body: z.object({
    items: z
      .array(
        z
          .object({
            id: z.coerce.number().int().positive(),
            name_bn: z.string().trim().min(1, "বাংলা নাম আবশ্যক").max(200).optional(),
            name_ar: nameField,
            name_en: nameField,
          })
          .strict(),
      )
      .min(1)
      .max(500)
      .refine((items) => new Set(items.map((i) => i.id)).size === items.length, "Duplicate id"),
  }),
});
