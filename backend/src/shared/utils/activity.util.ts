import { prisma } from "../database/prisma";

export const logActivity = async (args: {
  madrasa_id: number;
  user_id: number;
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
