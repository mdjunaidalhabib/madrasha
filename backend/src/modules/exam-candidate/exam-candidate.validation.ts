import { z } from "zod";
import { EXAM_CANDIDATE_STATUSES } from "./exam-candidate.constants";

// Ids arrive as JSON body values that may be a number or a numeric string
// (see exam-candidate.dto.ts's `number | string` fields) - z.coerce.number()
// accepts both without rejecting existing numeric payloads.
const idSchema = z.coerce.number().int().positive();
const MAX_BULK_ITEMS = 200; // mirrors exam-candidate.service.ts's MAX_BULK_ITEMS

export const bulkUpdateCandidateStatusSchema = z.object({
  body: z.object({
    ids: z.array(idSchema).min(1).max(MAX_BULK_ITEMS),
    status: z.enum(EXAM_CANDIDATE_STATUSES),
    notes: z.string().trim().max(500).optional(),
  }),
});

export const eligibilityCheckSchema = z.object({
  body: z.object({
    exam_id: idSchema.optional(),
    student_id: idSchema.optional(),
    candidate_id: idSchema.optional(),
  }),
});

export const bulkCheckEligibilitySchema = z.object({
  body: z.object({
    exam_id: idSchema,
    candidate_ids: z.array(idSchema).max(MAX_BULK_ITEMS).optional(),
  }),
});

export const updateEligibilitySettingsSchema = z.object({
  body: z.object({
    require_active_student: z.boolean().optional(),
    require_approved_admission: z.boolean().optional(),
    check_dues: z.boolean().optional(),
    scope_dues_to_exam_fee: z.boolean().optional(),
    check_attendance: z.boolean().optional(),
    min_attendance_percent: z.coerce.number().min(0).max(100).optional(),
  }),
});

export const updateCandidateStatusSchema = z.object({
  params: z.object({ id: idSchema }),
  body: z.object({
    status: z.enum(EXAM_CANDIDATE_STATUSES),
    notes: z.string().trim().max(500).optional(),
  }),
});

export const cancelCandidateSchema = z.object({
  params: z.object({ id: idSchema }),
});
