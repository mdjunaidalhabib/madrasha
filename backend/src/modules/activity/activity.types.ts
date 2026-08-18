export interface ActivityLogRow {
  id: number;
  madrasa_id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string | null;
  created_at: Date;
  // Nullable: activity_logs.user_id has no FK (see activity.util.ts), and the
  // repository now LEFT JOINs users so system-triggered rows (no acting user)
  // still show up instead of silently disappearing from the list.
  name: string | null;
}

export interface ActivityLogQuery {
  /** Quick filter: last N days (e.g. 3, 7, 30, 90). Ignored if from/to given. */
  days?: number;
  /** Custom range start (ISO date string), inclusive. */
  from?: string;
  /** Custom range end (ISO date string), inclusive (end-of-day). */
  to?: string;
  page?: number;
  limit?: number;
}

export interface ActivityLogListResult {
  rows: ActivityLogRow[];
  total: number;
  page: number;
  limit: number;
}
