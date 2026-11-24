import { z } from "zod";

export const closingTemplateSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((text) => !/[\r\n]/.test(text), "Use one line per template"),
});

export const questionSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(["written", "short", "mcq"]),
    text: z.string().trim().min(1).max(10000),
    marks: z.number().finite().positive().max(1000).multipleOf(0.5),
    options: z.array(z.string().trim().max(2000)).length(4),
    mcqTwoColumn: z.boolean().optional(),
    mcqSubquestions: z.array(z.object({
      id: z.string().uuid(),
      text: z.string().trim().min(1).max(10000),
      options: z.array(z.string().trim().max(2000)).length(4),
      twoColumn: z.boolean().optional(),
    })).max(40).optional(),
    answer: z.string().max(10000),
    bold: z.boolean().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === "mcq" && q.options.some((o) => !o))
      ctx.addIssue({ code: "custom", message: "MCQs require four options" });
    if ((q.mcqSubquestions ?? []).some((item) => item.options.some((option) => !option)))
      ctx.addIssue({ code: "custom", message: "MCQ subquestions require four options" });
  });

export const paperSchema = z.object({
  title: z.string().trim().min(1).max(200),
  divisionId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  duration: z.string().trim().max(100),
  instructions: z.string().trim().max(10000),
  layout: z
    .object({
      headerLineStyle: z.enum(["none", "solid", "double", "dashed", "dotted"]).optional(),
      headerLineThickness: z.number().int().min(1).max(4).optional(),
      footerText: z.string().max(500),
      questionSpacing: z.number().int().min(0).max(60),
      marginTop: z.number().int().min(0).max(50).optional(),
      marginRight: z.number().int().min(0).max(50).optional(),
      marginBottom: z.number().int().min(0).max(50).optional(),
      marginLeft: z.number().int().min(0).max(50).optional(),
      instructionsBold: z.boolean(),
      examBold: z.boolean().optional(),
      divisionBold: z.boolean().optional(),
      classBold: z.boolean().optional(),
      subjectBold: z.boolean().optional(),
      durationBold: z.boolean().optional(),
      marksBold: z.boolean().optional(),
      footerBold: z.boolean(),
    })
    .optional(),
  questions: z
    .array(questionSchema)
    .max(200)
    .refine(
      (q) => new Set(q.map((item) => item.id)).size === q.length,
      "Question IDs must be unique",
    ),
  updatedAt: z.string().datetime().optional(),
});
export type PaperInput = z.infer<typeof paperSchema>;
