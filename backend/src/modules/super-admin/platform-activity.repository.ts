import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export type PlatformActivityQuery = { page: number; limit: number; search?: string; from?: Date; to?: Date };

export async function listPlatformActivities(query: PlatformActivityQuery) {
  const search = query.search?.trim().slice(0, 200);
  const filters = Prisma.sql`
    ${query.from ? Prisma.sql`AND a.created_at >= ${query.from}` : Prisma.empty}
    ${query.to ? Prisma.sql`AND a.created_at <= ${query.to}` : Prisma.empty}
    ${search ? Prisma.sql`AND POSITION(LOWER(${search}) IN LOWER(CONCAT_WS(' ', a.details, a.entity, a.action, m.name, s.name))) > 0` : Prisma.empty}
  `;
  // A request can produce several detailed business events. Show its platform
  // envelope once; those events remain embedded in its details and tenant log.
  const scope = Prisma.sql`
    WITH captured AS (
      SELECT jsonb_array_elements_text(details::jsonb->'source_log_ids')::integer AS id
      FROM activity_logs WHERE action = 'SUPER_ADMIN_AUDIT'
    ), visible AS (
      SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.created_at,
        CASE WHEN a.action = 'SUPER_ADMIN_AUDIT' THEN a.details::jsonb->>'actor_name' ELSE s.name END AS user_name,
        CASE WHEN a.action = 'SUPER_ADMIN_AUDIT' THEN a.details::jsonb->>'madrasa_name' ELSE m.name END AS madrasa_name
      FROM activity_logs a
      LEFT JOIN madrasas m ON m.id = a.madrasa_id
      LEFT JOIN super_admins s ON s.id = a.user_id
      WHERE (a.action = 'SUPER_ADMIN_AUDIT' OR (
        (a.action LIKE 'SUPER_ADMIN%' OR a.action LIKE 'PLAN_%' OR a.action = 'MADRASA_CREATED'
          OR (a.madrasa_id IS NULL AND a.action LIKE 'document_template.%'))
        AND NOT EXISTS (SELECT 1 FROM captured c WHERE c.id = a.id)
      )) ${filters}
    )
  `;
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<unknown[]>(Prisma.sql`${scope} SELECT * FROM visible ORDER BY created_at DESC, id DESC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
    prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`${scope} SELECT COUNT(*)::bigint AS total FROM visible`),
  ]);
  return { rows, total: Number(count[0]?.total ?? 0), page: query.page, limit: query.limit };
}
