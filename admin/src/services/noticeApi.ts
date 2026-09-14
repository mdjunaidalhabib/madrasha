import api from "./api";

export interface NoticeDto {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export const noticeApi = {
  // Deliberately NOT cachedGet - this page creates/edits/deletes constantly
  // and always wants the freshest list right after a mutation.
  list: () => api.get<{ data: NoticeDto[] }>("/notices"),
  create: (payload: { title: string; body: string }) => api.post<{ data: NoticeDto }>("/notices", payload),
  update: (id: number, payload: Partial<{ title: string; body: string }>) => api.put(`/notices/${id}`, payload),
  delete: (id: number) => api.delete(`/notices/${id}`),
};
