import { prisma } from "../shared/database/prisma";
import { logger } from "../shared/logger/logger";
import { syncSuperAdminFromEnv } from "../modules/super-admin/superadmin-env-sync";

/** Provision only the platform owner at boot, independently of catalog seed. */
export async function syncStartupSuperAdmin(): Promise<void> {
  try {
    const { status } = await syncSuperAdminFromEnv(prisma.superAdmin);
    const messages = {
      created: "Super admin: account created.",
      updated: "Super admin: account updated.",
      unchanged: "Super admin: account unchanged.",
    };
    logger.status(status, messages[status]);
  } catch (error) {
    // Raw database exceptions may embed credential query arguments. Print only
    // known validation reasons and let the rest of the server boot continue.
    const message = error instanceof Error ? error.message : "";
    const reason = message.startsWith("No existing Super Admin")
      ? "missing configuration"
      : message.includes("must be at least 8 characters")
        ? "invalid password configuration"
        : message.includes("belongs to another Super Admin")
          ? "email conflict"
          : "database or configuration error";
    logger.status("failed", `Super admin: sync failed (${reason}).`);
  }
}
