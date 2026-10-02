import { prisma } from "../database/prisma";

/** Short cache so authMiddleware doesn't hit the DB on every request. Same-
 * process revocations clear it immediately (invalidateSessionCache); on a
 * multi-instance deployment a revoked device is kicked out within the TTL. */
const CACHE_TTL_MS = 10_000;
const cache = new Map<number, { active: boolean; until: number }>();

/** Whether the login session (refresh-token row) an access token was issued
 * for is still active - lets "log out this device / all devices" take effect
 * on the very next request instead of after the access token expires. */
export async function isSessionActive(sessionId: number): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(sessionId);
  if (hit && hit.until > now) return hit.active;

  let active: boolean;
  try {
    const row = await prisma.refreshToken.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    active = Boolean(row);
  } catch {
    // A DB hiccup must not log every user out - the route itself will
    // fail on its own if the database is really down.
    return true;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(sessionId, { active, until: now + CACHE_TTL_MS });
  return active;
}

export function invalidateSessionCache(): void {
  cache.clear();
}
