import { z } from "zod";
import { EXAM_STATUSES } from "./exam.constants";

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

// name/exam_type/description caps mirror Exam's @db.VarChar limits
// (prisma/models/exam.prisma): name VarChar(100), exam_type VarChar(50),
// description VarChar(500).
export const createExamSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    exam_type: z.string().trim().max(50).optional(),
    start_date: z.string().trim().min(1).optional(),
    end_date: z.string().trim().min(1).optional(),
    description: z.string().trim().max(500).optional(),
  }),
});

export const updateExamSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    is_active: z.boolean().optional(),
    exam_type: z.string().trim().max(50).optional(),
    start_date: z.string().trim().min(1).optional(),
    end_date: z.string().trim().min(1).optional(),
    description: z.string().trim().max(500).optional(),
  }),
});

export const deleteExamSchema = z.object({
  params: idParamsSchema,
});

export const activateExamFeeSchema = z.object({
  params: idParamsSchema,
});

export const reorderExamsSchema = z.object({
  body: z.object({
    ids: z.array(z.coerce.number().int().positive()).min(1),
  }),
});

export const updateExamStatusSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    status: z.enum(EXAM_STATUSES),
  }),
});

// Optional grade scope: omitted/null = madrasa-wide default scale, a number =
// that division's own scale (only allowed once it has a fail-mark override).
const divisionIdField = z.coerce.number().int().positive().nullish();

// GeneralGrade.name is @db.VarChar(10) (prisma/models/academic.prisma).
export const saveGeneralGradeSchema = z.object({
  body: z.object({
    division_id: divisionIdField,
    name: z.string().trim().min(1).max(10),
    min_mark: z.coerce.number(),
    max_mark: z.coerce.number(),
    point: z.coerce.number().min(0).optional(),
  }),
});

export const updateGeneralGradeSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    name: z.string().trim().min(1).max(10),
    min_mark: z.coerce.number(),
    max_mark: z.coerce.number(),
    point: z.coerce.number().min(0).optional(),
  }),
});

export const deleteGeneralGradeSchema = z.object({
  params: idParamsSchema,
});

// MadrasaGrade.name is @db.VarChar(50) (prisma/models/academic.prisma).
export const saveMadrasaGradeSchema = z.object({
  body: z.object({
    division_id: divisionIdField,
    name: z.string().trim().min(1).max(50),
    min_mark: z.coerce.number(),
    max_mark: z.coerce.number(),
    point: z.coerce.number().min(0).optional(),
  }),
});

export const updateMadrasaGradeSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    name: z.string().trim().min(1).max(50),
    min_mark: z.coerce.number(),
    max_mark: z.coerce.number(),
    point: z.coerce.number().min(0).optional(),
  }),
});

export const deleteMadrasaGradeSchema = z.object({
  params: idParamsSchema,
});

export const updateFailMarkSchema = z.object({
  body: z.object({
    value: z.coerce.number(),
  }),
});

export const updateDivisionFailMarkSchema = z.object({
  params: z.object({ divisionId: z.coerce.number().int().positive() }),
  // null clears the override (division follows the global fail mark again).
  body: z.object({
    value: z.union([z.null(), z.coerce.number().int().min(0).max(100)]),
  }),
});
