import { Request, Response, NextFunction } from "express";
import { logActivity } from "../utils/activity.util";
import { logger } from "../logger/logger";
import {
  ActivitySnapshot,
  buildSnapshotDetails,
  findSnapshotLoader,
} from "../utils/activityDetails";
import { findBulkDescriber } from "../utils/activityBulkDetails";
import {
  activityContext,
  sameActivityModule,
  type ActivityRequestContext,
} from "../utils/activityContext";
import { describeActivityRequest, responseEntityId } from "../utils/activityRequestDetails";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ACTION_BY_METHOD: Record<string, string> = {
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

// Background refresh and activity queries do not generate audit events.
const IGNORED_PATHS = new Set(["auth/refresh", "activity"]);

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

// DELETE on these only soft-deletes (moves to ট্র্যাশ) - see each repository.
const SOFT_DELETE_ENTITIES = new Set(["students", "teachers", "staff", "exams"]);

/** A plain "what was done" line for delete/trash actions, so the details say
 * whether the record went to trash, was wiped for good, or came back -
 * the record summary alone doesn't tell them apart. */
function actionNote(method: string, entity: string): string | null {
  if (entity.startsWith("trash/") && entity.endsWith("/restore"))
    return "কাজ: ট্র্যাশ থেকে পুনরুদ্ধার করা হয়েছে";
  if (method !== "DELETE") return null;
  if (SOFT_DELETE_ENTITIES.has(entity))
    return "কাজ: ট্র্যাশে সরানো হয়েছে — চাইলে ট্র্যাশ থেকে পুনরুদ্ধার করা যাবে";
  if (entity.startsWith("trash/"))
    return "কাজ: ট্র্যাশ থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে — আর ফেরত আনা যাবে না";
  if (entity === "students/rejected-application")
    return "কাজ: বাতিল হওয়া ভর্তি আবেদন স্থায়ীভাবে মুছে ফেলা হয়েছে";
  return null;
}

/** Puts the note right under the headline (first line) of the details. */
function withActionNote(details: string | null, note: string | null): string | null {
  if (!note) return details;
  if (!details) return note;
  const [headline, ...rest] = details.split("\n");
  return [headline, note, ...rest].join("\n");
}

// Snapshot of the record (see utils/activityDetails.ts) so the log can say
// "field: old → new" instead of a bare id. Taken before the handler runs, when
// the request isn't tenant-resolved yet - so the lookup is by id alone and the
// snapshot's own madrasaId is checked against the tenant on "finish".
async function loadSnapshot(
  entity: string,
  entityId: number | null,
): Promise<ActivitySnapshot | null> {
  if (entityId === null) return null;
  const loader = findSnapshotLoader(entity);
  if (!loader) return null;
  try {
    return await loader(entityId);
  } catch (error) {
    logger.error("Activity log snapshot failed", error);
    return null;
  }
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
  const context: ActivityRequestContext = { logged: [] };
  return activityContext.run(context, () => {
    if (!MUTATING_METHODS.has(req.method)) return next();

    const { entity, entityId } = deriveEntity(req.originalUrl);
    if (IGNORED_PATHS.has(entity)) return next();

    const bulk = findBulkDescriber(entity);
    const beforePromise = loadSnapshot(entity, entityId);
    const bulkBeforePromise: Promise<unknown> = bulk?.before
      ? bulk.before(req.body).catch((error) => {
          logger.error("Activity log bulk snapshot failed", error);
          return null;
        })
      : Promise.resolve(null);

    // Bulk describers read the handler's reply (counts, per-row preview).
    let responseBody: unknown = null;
    {
      const originalJson = res.json.bind(res);
      res.json = (payload: unknown) => {
        responseBody = payload;
        return originalJson(payload);
      };
    }

    res.on("finish", () => {
      if (res.locals.websiteActivityHandled) return;
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const madrasaId = req.tenant?.madrasa_id;
      const userId = req.user?.id;
      if (!madrasaId || !userId) return;
      // Detailed service events take precedence. New routes still get a fallback.
      if (
        context.logged.some(
          (entry) =>
            entry.madrasaId === madrasaId &&
            entry.userId === userId &&
            sameActivityModule(entity, entry.entity),
        )
      )
        return;

      (async () => {
        const resolvedId =
          entityId ?? (req.method === "POST" ? responseEntityId(responseBody) : null);
        const own = (s: ActivitySnapshot | null) => (s && s.madrasaId === madrasaId ? s : null);
        const before = own(await beforePromise);
        // Restore only flips deletedAt, so a before/after diff would read "no
        // change" - log the restored record's summary instead, like a delete.
        const after =
          req.method === "DELETE" || entity.endsWith("/restore")
            ? null
            : own(await loadSnapshot(entity, resolvedId));
        const bulkDetails = bulk
          ? await bulk
              .describe({
                madrasaId,
                body: req.body,
                response: responseBody,
                before: await bulkBeforePromise,
              })
              .catch((error) => {
                logger.error("Activity log bulk details failed", error);
                return null;
              })
          : null;
        const details = withActionNote(
          bulkDetails ??
            buildSnapshotDetails(before, after) ??
            describeActivityRequest(req.body, responseBody, resolvedId),
          actionNote(req.method, entity),
        );

        await logActivity({
          madrasa_id: madrasaId,
          user_id: userId,
          action: ACTION_BY_METHOD[req.method] ?? req.method,
          entity,
          entity_id: resolvedId,
          details,
        });
      })().catch((error) => logger.error("Auto activity log failed", error));
    });

    // Hold the handler until the "before" snapshots are read - otherwise the
    // update could land first and the diff would show no change.
    Promise.allSettled([beforePromise, bulkBeforePromise]).finally(() => next());
  });
};
