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
