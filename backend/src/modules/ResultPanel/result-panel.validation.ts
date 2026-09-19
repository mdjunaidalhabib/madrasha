import { z } from "zod";

const idSchema = z.coerce.number().int().positive();

// A mark/component value arrives as a number, a numeric string, an empty
// string, or null - "" and null both mean "clear this mark" (see
// ResultPanelService.saveMarks's doc-comment). z.literal checks are tried
// before z.coerce.number() in the union below so "" and null are never
// silently coerced into 0.
const markValueSchema = z.union([z.literal(null), z.literal(""), z.coerce.number()]);

const markComponentValueSchema = z.object({
  component: z.string().trim().min(1),
  value: markValueSchema.nullable().optional(),
});

const markRowSchema = z.object({
  student_id: idSchema,
  exam_id: idSchema,
  class_id: idSchema,
  book_id: idSchema,
  // Optional (not just nullable): ResultPanelService.saveMarks's isCleared
  // check treats an OMITTED mark key the same as null/"" ("clear this
  // cell") - if this were required, a client that omits the key entirely
  // would get a validation error instead of a clear.
  mark: markValueSchema.optional(),
  is_absent: z.boolean().optional(),
  is_exempted: z.boolean().optional(),
  is_withheld: z.boolean().optional(),
  note: z.string().nullable().optional(),
  components: z.array(markComponentValueSchema).optional(),
});

export const createSessionSchema = z.object({
  body: z.object({
    exam_id: idSchema,
    class_id: idSchema,
  }),
});

// The marks-entry grid saves the WHOLE class x every unlocked subject in
// one request (see ResultEntryPage.tsx's buildMarksPayload), not one
// subject at a time - a large class (hundreds of students) x many subjects
// can legitimately reach a few thousand rows. 5000 comfortably covers any
// realistic single-class save while still capping a pathological/malicious
// payload.
const MAX_SAVE_MARKS_ROWS = 5000;

export const saveMarksSchema = z.object({
  body: z.object({
    result_master_id: idSchema.optional(),
    data: z.array(markRowSchema).min(1).max(MAX_SAVE_MARKS_ROWS),
  }),
});

export const processResultSchema = z.object({
  body: z.object({
    exam_id: idSchema,
    class_id: idSchema,
    result_master_id: idSchema.optional(),
  }),
});

export const recalculateResultsSchema = z.object({
  body: z.object({
    // Omit to recalculate every processed session in the madrasa.
    result_master_id: idSchema.optional(),
    // PUBLISHED/LOCKED sessions are only rewritten when this is true.
    include_published: z.boolean().optional(),
    // Report what would change without writing anything.
    dry_run: z.boolean().optional(),
  }),
});

export const publishResultSchema = z.object({
  body: z.object({
    result_master_id: idSchema,
  }),
});

export const applyRollByRankSchema = z.object({
  body: z.object({
    result_master_id: idSchema,
  }),
});

export const deleteResultSchema = z.object({
  params: z.object({ id: idSchema }),
});
