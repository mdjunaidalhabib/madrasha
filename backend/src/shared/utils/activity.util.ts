import { prisma } from "../database/prisma";

export const logActivity = async (args: {
  // Nullable so platform-level (non-tenant) actions - e.g. Super Admin
  // managing a SYSTEM-scope DocumentTemplate - can still be logged; the
  // ActivityLog.madrasaId column has always allowed null.
  madrasa_id: number | null;
  // Nullable for system-triggered actions with no acting user (e.g. lazy
  // legacy-template migration, run on whichever request happens to need
  // the default first). ActivityLog.userId has no FK, so this is safe.
  user_id: number | null;
  action: string;
  entity: string;
  entity_id?: number | null;
  details?: string | null;
}) => {
  const { madrasa_id, user_id, action, entity, entity_id = null, details = null } = args;
  await prisma.activityLog.create({
    data: {
      madrasaId: madrasa_id,
      userId: user_id,
      action,
      entity,
      entityId: entity_id,
      details,
    },
  });
};
