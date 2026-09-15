import { Request, Response, NextFunction } from "express";
import { logActivity } from "../utils/activity.util";
import { logger } from "../logger/logger";
import { prisma } from "../database/prisma";

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

// Same idea as SELF_LOGGED_ENTITIES, but for individual sub-routes rather
// than a whole top-level module - these hand-log a detailed, student-aware
// message (student id/name/class + what happened) in FeeService/
// StudentService, so letting the generic body-field fallback below log a
// second, shallower row for the same request would just create a duplicate.
const SELF_LOGGED_ENTITY_PATHS = new Set([
  "invoices/pay",
  "invoices/waive",
  "students/admission",
  "students/approve",
  "students/reject",
  // Marks/Result workflow (result-panel/result-workflow/result-correction/
  // mark-component services) - each of these calls logActivity() itself
  // with a richer, action-specific detail payload (see each service file),
  // so letting the generic fallback log a second shallow row would create
  // duplicates. "results/process" and "results/publish" are on the
  // pre-existing result-panel.routes.ts routes, which only started
  // self-logging once the process/publish status-transition rules were
  // added here.
  "results/process",
  "results/publish",
  "results/books/submit",
  "results/books/verify",
  "results/books/reject",
  "results/verify-result",
  "results/approve",
  "results/lock",
  "results/corrections",
  "results/corrections/decide",
  "results/mark-components",
  // Branding settings (see SettingsService.updateBranding/deleteBrandingImage)
  // self-log a field-by-field before→after diff - letting the generic
  // fallback log a second shallow row (or none at all, since PUT /branding
  // has no numeric id and its body rarely matches DETAIL_FIELD_CANDIDATES)
  // would just create a duplicate/less useful entry.
  "settings/branding",
  "settings/branding/report_logo",
  "settings/branding/report_banner",
  "settings/branding/report_watermark",
  "settings/branding/report_header_image",
  "settings/branding/report_footer_image",
]);

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

// Only ever read from this allow-list of known identifying fields - never a
// generic dump of req.body - so sensitive fields (password, token, base64
// file data, etc.) can never end up in the details column.
const DETAIL_FIELD_CANDIDATES = ["name_bn", "name", "title", "designation"];
const MAX_DETAIL_LENGTH = 190;

function deriveBodyDetails(body: unknown): string | null {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    for (const key of DETAIL_FIELD_CANDIDATES) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        const trimmed = value.trim();
        return trimmed.length > MAX_DETAIL_LENGTH ? `${trimmed.slice(0, MAX_DETAIL_LENGTH)}…` : trimmed;
      }
    }
  }
  return null;
}

// The raw DB primary key means nothing to madrasa staff reading the log -
// for a student row it's the roll/registration number they actually
// recognize, so this looks those up instead of falling back to a bare
// "আইডি: <id>" line for any student sub-route without a name-bearing body
// (expel, transfer-session, delete, etc - see student.routes.ts).
async function deriveStudentDetails(entityId: number, madrasaId: number): Promise<string | null> {
  try {
    const student = await prisma.student.findFirst({
      where: { id: entityId, madrasaId },
      select: { nameBn: true, roll: true, registrationNo: true },
    });
    if (!student) return null;
    return `নাম: ${student.nameBn}, রোল: ${student.roll ?? "—"}, রেজিস্ট্রেশন নম্বর: ${student.registrationNo ?? "—"}`;
  } catch (error) {
    logger.error("Activity log student detail lookup failed", error);
    return null;
  }
}

async function deriveDetails(
  body: unknown,
  entity: string,
  entityId: number | null,
  madrasaId: number,
): Promise<string | null> {
  const bodyDetails = deriveBodyDetails(body);
  if (bodyDetails) return bodyDetails;

  if (entityId !== null && entity.split("/")[0] === "students") {
    const studentDetails = await deriveStudentDetails(entityId, madrasaId);
    if (studentDetails) return studentDetails;
  }

  return entityId !== null ? `আইডি: ${entityId}` : null;
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
    if (SELF_LOGGED_ENTITIES.has(entity.split("/")[0]) || SELF_LOGGED_ENTITY_PATHS.has(entity)) return;

    deriveDetails(req.body, entity, entityId, madrasaId)
      .then((details) =>
        logActivity({
          madrasa_id: madrasaId,
          user_id: userId,
          action: ACTION_BY_METHOD[req.method] ?? req.method,
          entity,
          entity_id: entityId,
          details,
        }),
      )
      .catch((error) => logger.error("Auto activity log failed", error));
  });

  next();
};
