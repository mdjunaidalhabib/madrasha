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
    action?: string;
    search?: string;
  }): Promise<{ rows: ActivityLogRow[]; total: number }> {
    const { madrasaId, from, to, page, limit, entity, action, search } = params;
    const offset = (page - 1) * limit;
    const aliases: Record<string, string[]> = {
      users: ["users", "user"],
      accounts: ["accounts", "account", "income", "expense", "fund_settings", "category_settings"],
      "document-templates": ["document-templates", "documenttemplate"],
    };
    const entityNames = entity ? (aliases[entity] ?? [entity.toLowerCase()]) : [];
    const entityFilter = entityNames.length
      ? Prisma.sql`AND LOWER(SPLIT_PART(a.entity, '/', 1)) IN (${Prisma.join(entityNames)})`
      : Prisma.empty;
    const actionFilter = action
      ? Prisma.sql`AND UPPER(a.action) = ${action.toUpperCase()}`
      : Prisma.empty;
    // POSITION treats user input literally, including SQL LIKE wildcard characters.
    const searchFilter = search
      ? Prisma.sql`AND (
      POSITION(LOWER(${search}) IN LOWER(COALESCE(a.details, ''))) > 0 OR
      POSITION(LOWER(${search}) IN LOWER(COALESCE(u.name, ''))) > 0 OR
      POSITION(LOWER(${search}) IN LOWER(a.entity)) > 0 OR
      POSITION(LOWER(${search}) IN LOWER(a.action)) > 0
    )`
      : Prisma.empty;

    const [rows, totalRows] = await Promise.all([
      prisma.$queryRaw<ActivityLogRow[]>`
        SELECT a.*, u.name, r.name_bn AS role_name
        FROM activity_logs a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE a.madrasa_id = ${madrasaId} AND a.created_at >= ${from} AND a.created_at <= ${to} ${entityFilter} ${actionFilter} ${searchFilter}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM activity_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.madrasa_id = ${madrasaId} AND a.created_at >= ${from} AND a.created_at <= ${to} ${entityFilter} ${actionFilter} ${searchFilter}
      `,
    ]);

    return { rows, total: Number(totalRows[0]?.count ?? 0) };
  }

  findUserNames(madrasaId: number, ids: number[]) {
    return prisma.user.findMany({
      where: { madrasaId, id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  purgeOlderThan(cutoff: Date) {
    return prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}

export const activityRepository = new ActivityRepository();
