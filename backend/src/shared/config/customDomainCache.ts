import { prisma } from "../database/prisma";

// CORS's origin callback runs on every single request, so a per-tenant
// custom domain can't hit the DB each time - a short TTL cache keeps that to
// roughly one lookup per domain per minute instead of one per request, while
// still picking up a newly-connected domain (or one removed) within a
// minute without a server restart.
const TTL_MS = 60_000;
const cache = new Map<string, { allowed: boolean; expiresAt: number }>();

/** Whether `host` (bare hostname, no protocol/port) is a tenant's connected
 * custom domain - used as the CORS fallback when the origin isn't already
 * in the static CORS_ORIGINS whitelist. */
export async function isKnownCustomDomain(host: string): Promise<boolean> {
  const cached = cache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;

  const madrasa = await prisma.madrasa.findFirst({ where: { customDomain: host }, select: { id: true } });
  const allowed = Boolean(madrasa);
  cache.set(host, { allowed, expiresAt: Date.now() + TTL_MS });
  return allowed;
}
