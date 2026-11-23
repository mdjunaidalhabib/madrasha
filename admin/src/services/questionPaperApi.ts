import api from "./api";
import type { QuestionPaper } from "../features/question-paper/questionPaper";
import type { PaperExam } from "../features/question-paper/questionPaper";

export type ClosingTemplate = { id: string; text: string };
export type TemplateKind = "closing" | "instruction";

export const paperTemplateApi = (kind: TemplateKind) => {
  const path = `/question-papers/${kind === "closing" ? "closing" : "instruction"}-templates`;
  return {
    list: async (signal?: AbortSignal): Promise<ClosingTemplate[]> =>
      (await api.get(path, { signal })).data.data,
    create: async (text: string): Promise<ClosingTemplate> =>
      (await api.post(path, { text })).data.data,
    update: async (id: string, text: string): Promise<ClosingTemplate> =>
      (await api.put(`${path}/${id}`, { text })).data.data,
    remove: async (id: string): Promise<void> => {
      await api.delete(`${path}/${id}`);
    },
  };
};

export type QuestionPaperReferences = {
  branding: { name: string; address: string | null };
  exams: PaperExam[];
  divisions: { id: number; name: string }[];
  classes: { id: number; divisionId: number | null; name: string }[];
  subjects: { id: number; classId: number; name: string }[];
};
const payload = (paper: QuestionPaper) => ({
  title: paper.title,
  divisionId: paper.divisionId,
  classId: paper.classId,
  subjectId: paper.subjectId,
  duration: paper.duration,
  instructions: paper.instructions,
  layout: paper.layout,
  questions: paper.questions,
  updatedAt: paper.updatedAt,
});
export const questionPaperApi = {
  closingTemplates: async (signal?: AbortSignal): Promise<ClosingTemplate[]> =>
    (await api.get("/question-papers/closing-templates", { signal })).data.data,
  createClosingTemplate: async (text: string): Promise<ClosingTemplate> =>
    (await api.post("/question-papers/closing-templates", { text })).data.data,
  updateClosingTemplate: async (id: string, text: string): Promise<ClosingTemplate> =>
    (await api.put(`/question-papers/closing-templates/${id}`, { text })).data.data,
  removeClosingTemplate: async (id: string): Promise<void> => {
    await api.delete(`/question-papers/closing-templates/${id}`);
  },
  references: async (signal?: AbortSignal): Promise<QuestionPaperReferences> =>
    (await api.get("/question-papers/references", { signal })).data.data,
  list: async (signal?: AbortSignal): Promise<QuestionPaper[]> =>
    (await api.get("/question-papers", { signal })).data.data,
  create: async (paper: QuestionPaper): Promise<QuestionPaper> =>
    (await api.post("/question-papers", payload(paper))).data.data,
  update: async (paper: QuestionPaper): Promise<QuestionPaper> =>
    (await api.put(`/question-papers/${paper.id}`, payload(paper))).data.data,
  remove: async (id: string): Promise<void> => {
    await api.delete(`/question-papers/${id}`);
  },
};
