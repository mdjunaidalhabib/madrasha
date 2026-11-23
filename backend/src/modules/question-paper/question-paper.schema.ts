import { z } from "zod";

export const questionSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(["written", "short", "mcq"]),
    text: z.string().trim().min(1).max(10000),
    marks: z.number().finite().positive().max(1000).multipleOf(0.5),
    options: z.array(z.string().trim().max(2000)).length(4),
    answer: z.string().max(10000),
  })
  .superRefine((q, ctx) => {
    if (q.type === "mcq" && (q.options.some((o) => !o) || !["0", "1", "2", "3"].includes(q.answer)))
      ctx.addIssue({ code: "custom", message: "MCQs require four options and a correct answer" });
  });

export const paperSchema = z.object({
  title: z.string().trim().min(1).max(200),
  divisionId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  duration: z.string().trim().max(100),
  instructions: z.string().trim().max(10000),
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
