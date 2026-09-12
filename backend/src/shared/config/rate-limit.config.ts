import type { Request } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env";

type DecodedForRateLimit = {
  id?: number;
  guardianId?: number;
  type?: string;
  role?: string;
} | null;

function normalizeHeaderValue(value: unknown) {
  return String(Array.isArray(value) ? value[0] : value || "")
    .trim()
    .toLowerCase();
}

/**
 * Partitions the GLOBAL rate limiter (see app.ts) by the actual actor
 * making the request instead of raw IP. This limiter sits in front of the
 * whole router, so it runs BEFORE tenantMiddleware/authMiddleware resolve
 * req.user/req.tenant - it can't read those. Instead it decodes the bearer
 * token itself. This is only ever used to pick a fairness bucket, never to
 * authorize anything, so a forged/expired token can at most land itself in
 * its own bucket - it can't grant access or affect anyone else's limit.
 *
 * Without this, every staff member across every madrasa behind the same
 * office/NAT'd IP shared a single limiter bucket - one busy tenant's normal
 * traffic could 429 every other tenant's completely unrelated requests on
 * that same IP. Keying by the signed-in user (falling back to the tenant
 * slug, then IP for fully unauthenticated requests) means unrelated actors
 * on the same network no longer compete for the same budget.
 */
function rateLimitKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.decode(authHeader.slice(7)) as DecodedForRateLimit;
      if (decoded?.type === "guardian" && decoded.guardianId) return `guardian:${decoded.guardianId}`;
      if (decoded?.role === "super_admin" && decoded.id) return `superadmin:${decoded.id}`;
      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      // Malformed token - fall through to tenant/IP keying below.
    }
  }

  const tenantSlug = normalizeHeaderValue(req.headers["x-madrasa-slug"]);
  if (tenantSlug) return `tenant:${tenantSlug}`;

  return req.ip || "unknown";
}

export const rateLimitConfig = {
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  // A plain string message is sent as text/plain by express-rate-limit's
  // default handler, which left api.ts's interceptor with no `.message`
  // field to read (it fell back to axios's generic "Request failed with
  // status code 429"). Sending an object here gets JSON-serialized instead,
  // consistent with every other error response and every other limiter
  // (loginLimiter, passwordResetLimiter, refreshLimiter) in this codebase.
  message: { message: "অনেক বেশি অনুরোধ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
};
