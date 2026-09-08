import api, { cachedGet } from "./api";

export type EventType = "MEETING" | "NOTICE" | "HOLIDAY" | "OTHER";

export interface EventDto {
  id: number;
  title: string;
  type: EventType;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  MEETING: "মিটিং",
  NOTICE: "নোটিশ",
  HOLIDAY: "ছুটি",
  OTHER: "অন্যান্য",
};

export const eventApi = {
  list: () => cachedGet<{ data: EventDto[] }>("/events"),
  create: (payload: {
    title: string;
    type: EventType;
    event_date: string;
    start_time?: string;
    end_time?: string;
    description?: string;
  }) => api.post("/events", payload),
  update: (
    id: number,
    payload: Partial<{
      title: string;
      type: EventType;
      event_date: string;
      start_time: string | null;
      end_time: string | null;
      description: string | null;
    }>,
  ) => api.put(`/events/${id}`, payload),
  remove: (id: number) => api.delete(`/events/${id}`),
};
