import { activityRepository, ActivityRepository } from "./activity.repository";
import { ACTIVITY_LOG_DEFAULT_DAYS, ACTIVITY_LOG_DEFAULT_LIMIT, ACTIVITY_LOG_MAX_LIMIT } from "./activity.constants";
import { ActivityLogListResult, ActivityLogQuery } from "./activity.types";

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

    const { rows, total } = await this.repository.findByMadrasa({ madrasaId, from, to, page, limit });
    return { rows, total, page, limit };
  }
}

export const activityService = new ActivityService();
