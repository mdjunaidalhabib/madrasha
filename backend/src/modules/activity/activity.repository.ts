import { prisma } from "../../shared/database/prisma";
import { ActivityLogRow } from "./activity.types";

export class ActivityRepository {
  /**
   * activity_logs.user_id has no FK constraint in the DB schema (a log
   * should survive even if the user is later deleted), so this join isn't
   * modeled as a Prisma relation - $queryRaw keeps it exact. LEFT JOIN (not
   * INNER) because some rows are system-triggered with a null user_id and
   * must still show up, not disappear from the list.
   */
  async findByMadrasa(params: {
    madrasaId: number;
    from: Date;
    to: Date;
    page: number;
    limit: number;
  }): Promise<{ rows: ActivityLogRow[]; total: number }> {
    const { madrasaId, from, to, page, limit } = params;
    const offset = (page - 1) * limit;

    const [rows, totalRows] = await Promise.all([
      prisma.$queryRaw<ActivityLogRow[]>`
        SELECT a.*, u.name
        FROM activity_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.madrasa_id = ${madrasaId} AND a.created_at >= ${from} AND a.created_at <= ${to}
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM activity_logs a
        WHERE a.madrasa_id = ${madrasaId} AND a.created_at >= ${from} AND a.created_at <= ${to}
      `,
    ]);

    return { rows, total: Number(totalRows[0]?.count ?? 0) };
  }

  purgeOlderThan(cutoff: Date) {
    return prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}

export const activityRepository = new ActivityRepository();
