import { z } from "zod";
import { idParamSchema } from "../../shared/validators";

/**
 * Route param validation only. Request-body validation (required fields,
 * DOB format, bulk array shape) intentionally stays as bespoke logic in
 * student.service.ts rather than a generic zod schema here, because the
 * existing API contract returns specific shapes on failure (e.g.
 * `{ message, missing_fields, received }`) that a generic
 * "Validation failed" envelope would not reproduce exactly.
 */
export const studentIdParamSchema = idParamSchema;

/** `/students/by-registration/:regNo` - the madrasa's own registration no. */
export const registrationNoParamSchema = z.object({
  params: z.object({
    regNo: z.coerce.number().int().positive(),
  }),
});

/** Body shape for the Student List bulk "move to Trash" action. */
export const studentBulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(z.coerce.number().int().positive()).min(1),
  }),
});

/** Body shape for toggling a student's Expel status. */
export const studentExpelSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ expelled: z.boolean() }),
});

/** Body shape for toggling a student's Inactive (নিষ্ক্রিয়) status. */
export const studentInactiveSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ inactive: z.boolean() }),
});

/**
 * Body shape for the dedicated photo manager (ছবি আপলোড) - sets ONLY the
 * student's photo. `image` is a hosted URL or (when cloud storage isn't
 * configured) a base64 data-URI, so the cap is generous; null/"" removes it.
 */
export const studentPhotoSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    image: z
      .string()
      .trim()
      .max(3_000_000)
      .refine((v) => v === "" || /^(https?:\/\/|data:image\/)/i.test(v), "Invalid image")
      .nullable(),
  }),
});

const nameField = z.string().trim().max(200).nullable().optional();

/**
 * Body shape for the নাম (৩ ভাষা) page's bulk save - only the বাংলা/আরবি/
 * English name trios of the student, father and mother. name_bn is the one
 * required column, so it may be omitted but never blanked.
 */
export const studentNamesBulkSchema = z.object({
  body: z.object({
    items: z
      .array(
        z
          .object({
            id: z.coerce.number().int().positive(),
            name_bn: z.string().trim().min(1, "বাংলা নাম আবশ্যক").max(200).optional(),
            arabic_name: nameField,
            name_en: nameField,
            father_name: nameField,
            father_arabic_name: nameField,
            father_name_en: nameField,
            mother_name: nameField,
            mother_arabic_name: nameField,
            mother_name_en: nameField,
          })
          .strict(),
      )
      .min(1)
      .max(500)
      .refine((items) => new Set(items.map((i) => i.id)).size === items.length, "Duplicate id"),
  }),
});

/** Body shape for directly transferring a student into a different session. */
export const studentTransferSessionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    session_id: z.coerce.number().int().positive(),
    roll: z.coerce.number().int().positive().optional(),
    reason: z.string().trim().max(300).optional(),
  }),
});
