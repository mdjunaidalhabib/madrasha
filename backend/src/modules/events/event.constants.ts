export const EVENT_TYPES = ["MEETING", "NOTICE", "HOLIDAY", "OTHER"] as const;
export type EventTypeValue = (typeof EVENT_TYPES)[number];

export const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DASHBOARD_UPCOMING_EVENTS_LIMIT = 5;
