import type { Question, QuestionPaper } from "./questionPaper";

export type QuestionWorkspaceDraft = {
  version: 1;
  paper: QuestionPaper;
  question: Question;
  editing: string | null;
  customClosingNote: string;
  customInstructionNote?: string;
  dirty: boolean;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validQuestion(value: unknown): value is Question {
  return (
    record(value) &&
    ["id", "text", "answer"].every((key) => typeof value[key] === "string") &&
    ["written", "short", "mcq"].includes(String(value.type)) &&
    typeof value.marks === "number" &&
    Number.isFinite(value.marks) &&
    Array.isArray(value.options) &&
    value.options.length === 4 &&
    value.options.every((option) => typeof option === "string") &&
    (value.mcqTwoColumn === undefined || typeof value.mcqTwoColumn === "boolean") &&
    (value.mcqSubquestions === undefined ||
      (Array.isArray(value.mcqSubquestions) && value.mcqSubquestions.every(
        (item) => record(item) && typeof item.id === "string" && typeof item.text === "string" &&
          Array.isArray(item.options) && item.options.length === 4 &&
          item.options.every((option) => typeof option === "string") &&
          (item.twoColumn === undefined || typeof item.twoColumn === "boolean"),
      ))) &&
    (value.bold === undefined || typeof value.bold === "boolean")
  );
}

function validPaper(value: unknown): value is QuestionPaper {
  if (
    !record(value) ||
    ![
      "id",
      "institution",
      "address",
      "divisionName",
      "title",
      "subject",
      "className",
      "duration",
      "instructions",
      "updatedAt",
    ].every((key) => typeof value[key] === "string") ||
    !["divisionId", "classId", "subjectId"].every(
      (key) =>
        value[key] === null || (typeof value[key] === "number" && Number.isFinite(value[key])),
    ) ||
    !Array.isArray(value.questions) ||
    !value.questions.every(validQuestion)
  )
    return false;
  if (value.layout !== undefined) {
    if (!record(value.layout)) return false;
    const layout = value.layout;
    if (
      layout.headerLineStyle !== undefined &&
      !["none", "solid", "double", "dashed", "dotted"].includes(String(layout.headerLineStyle))
    )
      return false;
    if (
      layout.headerLineThickness !== undefined &&
      (typeof layout.headerLineThickness !== "number" ||
        !Number.isInteger(layout.headerLineThickness) ||
        layout.headerLineThickness < 1 ||
        layout.headerLineThickness > 4)
    )
      return false;
    if (layout.footerText !== undefined && typeof layout.footerText !== "string") return false;
    if (
      layout.questionSpacing !== undefined &&
      (typeof layout.questionSpacing !== "number" ||
        !Number.isInteger(layout.questionSpacing) ||
        layout.questionSpacing < 0 ||
        layout.questionSpacing > 60)
    )
      return false;
    if (
      !["marginTop", "marginRight", "marginBottom", "marginLeft"].every(
        (key) =>
          layout[key] === undefined ||
          (typeof layout[key] === "number" &&
            Number.isInteger(layout[key]) &&
            layout[key] >= 0 &&
            layout[key] <= 50),
      )
    )
      return false;
    if (
      !["instructionsBold", "footerBold", "examBold", "divisionBold", "classBold", "subjectBold", "durationBold", "marksBold"].every(
        (key) => layout[key] === undefined || typeof layout[key] === "boolean",
      )
    )
      return false;
  }
  return true;
}

export function readQuestionDraft(key: string | null): {
  draft: QuestionWorkspaceDraft | null;
  failed: boolean;
} {
  if (!key) return { draft: null, failed: false };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { draft: null, failed: false };
    const data: unknown = JSON.parse(raw);
    if (
      !record(data) ||
      data.version !== 1 ||
      !validPaper(data.paper) ||
      !validQuestion(data.question) ||
      (data.editing !== null && typeof data.editing !== "string") ||
      typeof data.customClosingNote !== "string" ||
      (data.customInstructionNote !== undefined &&
        typeof data.customInstructionNote !== "string") ||
      typeof data.dirty !== "boolean"
    ) {
      return { draft: null, failed: true };
    }
    return { draft: data as QuestionWorkspaceDraft, failed: false };
  } catch {
    return { draft: null, failed: true };
  }
}

export function writeQuestionDraft(key: string, draft: QuestionWorkspaceDraft | null): boolean {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
