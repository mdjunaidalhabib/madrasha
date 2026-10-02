import { Prisma } from "@prisma/client";
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
    entity?: string;
  }): Promise<{ rows: ActivityLogRow[]; total: number }> {
    const { madrasaId, from, to, page, limit, entity } = params;
    const offset = (page - 1) * limit;
    const entityFilter = entity ? Prisma.sql`AND a.entity = ${entity}` : Prisma.empty;

    const [rows, totalRows] = await Promise.all([
      prisma.$queryRaw<ActivityLogRow[]>`
        SELECT a.*, u.name, r.name_bn AS role_name
        FROM activity_logs a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE a.madrasa_id = ${madrasaId} AND a.created_at >= ${from} AND a.created_at <= ${to} ${entityFilter}
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM activity_logs a
        WHERE a.madrasa_id = ${madrasaId} AND a.created_at >= ${from} AND a.created_at <= ${to} ${entityFilter}
      `,
    ]);

    return { rows, total: Number(totalRows[0]?.count ?? 0) };
  }

  findUserNames(madrasaId: number, ids: number[]) {
    return prisma.user.findMany({ where: { madrasaId, id: { in: ids } }, select: { id: true, name: true } });
  }

  purgeOlderThan(cutoff: Date) {
    return prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}

export const activityRepository = new ActivityRepository();
