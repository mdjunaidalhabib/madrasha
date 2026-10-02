import { activityRepository, ActivityRepository } from "./activity.repository";
import { ACTIVITY_LOG_DEFAULT_DAYS, ACTIVITY_LOG_DEFAULT_LIMIT, ACTIVITY_LOG_MAX_LIMIT } from "./activity.constants";
import { ActivityLogListResult, ActivityLogQuery, ActivityLogRow } from "./activity.types";

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export class ActivityService {
  constructor(private readonly repository: ActivityRepository = activityRepository) {}

  async getLogs(madrasaId: number, query: ActivityLogQuery): Promise<ActivityLogListResult> {
    const now = new Date();
    const customFrom = parseDate(query.from);
    const customTo = parseDate(query.to);

    let from: Date;
    let to: Date;

    if (customFrom || customTo) {
      from = customFrom ?? new Date(0);
      to = customTo ?? now;
      // A date-only "to" (e.g. "2026-08-18") must include the whole day,
      // not just its midnight instant - otherwise same-day entries vanish.
      if (customTo) to.setHours(23, 59, 59, 999);
    } else {
      const days = query.days && query.days > 0 ? query.days : ACTIVITY_LOG_DEFAULT_DAYS;
      from = new Date(now);
      from.setDate(from.getDate() - days);
      to = now;
    }

    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const limit = Math.min(
      query.limit && query.limit > 0 ? Math.floor(query.limit) : ACTIVITY_LOG_DEFAULT_LIMIT,
      ACTIVITY_LOG_MAX_LIMIT,
    );

    const { rows, total } = await this.repository.findByMadrasa({
      madrasaId,
      from,
      to,
      page,
      limit,
      entity: query.entity,
    });
    return { rows: await this.withNames(madrasaId, rows), total, page, limit };
  }

  /**
   * Super-admin user actions log `{"user_id": 10, ...}` - a bare id means
   * nothing to the reader. Swap it for the user's name (the madrasa's own
   * name is left out - this is already that madrasa's log). An id whose
   * user no longer exists (deleted) is left as the id.
   */
  private async withNames(madrasaId: number, rows: ActivityLogRow[]): Promise<ActivityLogRow[]> {
    const parsed = rows.map((row) => {
      if (row.entity !== "user" || !row.details?.trim().startsWith("{")) return null;
      try {
        const data = JSON.parse(row.details);
        return data && typeof data === "object" && Number(data.user_id) ? (data as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    });
    const userIds = [...new Set(parsed.filter(Boolean).map((d) => Number(d!.user_id)))];
    if (!userIds.length) return rows;

    const users = await this.repository.findUserNames(madrasaId, userIds);
    const names = new Map(users.map((u) => [u.id, u.name]));

    return rows.map((row, i) => {
      const data = parsed[i];
      if (!data) return row;
      const { user_id, ...rest } = data;
      // A logged name change ({ from, to }) already says whose account it
      // was - a separate "ইউজার: <new name>" line would just repeat it.
      const nameChange = rest.name && typeof rest.name === "object";
      const userName = names.get(Number(user_id));
      const details = {
        ...(nameChange ? {} : userName ? { user_name: userName } : { user_id }),
        ...rest,
      };
      return { ...row, details: JSON.stringify(details) };
    });
  }
}

export const activityService = new ActivityService();
