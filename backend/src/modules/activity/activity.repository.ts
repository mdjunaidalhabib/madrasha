import { prisma } from "../../shared/database/prisma";
import { ACTIVITY_LOG_LIMIT } from "./activity.constants";
import { ActivityLogRow } from "./activity.types";

export class ActivityRepository {
  /**
   * activity_logs.user_id has no FK constraint in the DB schema (a log
   * should survive even if the user is later deleted), so this join isn't
   * modeled as a Prisma relation - $queryRaw keeps it exact.
   */
  findRecentByMadrasa(madrasaId: number) {
    return prisma.$queryRaw<ActivityLogRow[]>`
      SELECT a.*, u.name
      FROM activity_logs a
      JOIN users u ON u.id = a.user_id
      WHERE a.madrasa_id = ${madrasaId}
      ORDER BY a.created_at DESC
      LIMIT ${ACTIVITY_LOG_LIMIT}
    `;
  }
}

export const activityRepository = new ActivityRepository();
