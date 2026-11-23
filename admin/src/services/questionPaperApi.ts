import api from "./api";
import type { QuestionPaper } from "../features/question-paper/questionPaper";

export type QuestionPaperReferences = {
  branding: { name: string; address: string | null };
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
  questions: paper.questions,
  updatedAt: paper.updatedAt,
});
export const questionPaperApi = {
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
