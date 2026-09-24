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

/** Body shape for directly transferring a student into a different session. */
export const studentTransferSessionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    session_id: z.coerce.number().int().positive(),
    roll: z.coerce.number().int().positive().optional(),
    reason: z.string().trim().max(300).optional(),
  }),
});
