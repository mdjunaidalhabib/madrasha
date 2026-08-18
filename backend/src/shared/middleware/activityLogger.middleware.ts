import { Request, Response, NextFunction } from "express";
import { logActivity } from "../utils/activity.util";
import { logger } from "../logger/logger";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ACTION_BY_METHOD: Record<string, string> = {
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

// These modules already call logActivity() themselves with hand-written,
// more specific details (see account.service.ts, user.service.ts,
// document-templates.service.ts) - auto-logging them again here would create
// duplicate rows for the same action.
const SELF_LOGGED_ENTITIES = new Set(["users", "accounts", "document-templates", "activity"]);

function deriveEntity(originalUrl: string): { entity: string; entityId: number | null } {
  const pathOnly = originalUrl.split("?")[0].replace(/^\/api\//, "");
  const segments = pathOnly.split("/").filter(Boolean);

  const nameSegments: string[] = [];
  let entityId: number | null = null;
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      if (entityId === null) entityId = Number(segment);
    } else {
      nameSegments.push(segment);
    }
  }

  return { entity: nameSegments.join("/") || segments[0] || "unknown", entityId };
}

/**
 * Auto-records every successful create/update/delete request as an activity
 * log row, so the audit trail covers the whole app instead of only the
 * handful of places that call logActivity() by hand. Registered early in
 * app.ts (like requestLogger) so this listener is attached before any route
 * handler runs; by the time res "finish" fires, req.user/req.tenant are
 * already populated if the matched route set them.
 */
export const activityLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    if (!MUTATING_METHODS.has(req.method)) return;
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const madrasaId = req.tenant?.madrasa_id;
    const userId = req.user?.id;
    if (!madrasaId || !userId) return;

    const { entity, entityId } = deriveEntity(req.originalUrl);
    if (SELF_LOGGED_ENTITIES.has(entity.split("/")[0])) return;

    logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: ACTION_BY_METHOD[req.method] ?? req.method,
      entity,
      entity_id: entityId,
    }).catch((error) => logger.error("Auto activity log failed", error));
  });

  next();
};
