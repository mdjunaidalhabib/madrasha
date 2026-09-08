/** Strips protocol/path/port and lowercases, so a tenant's custom domain is
 * always stored and compared as a bare hostname (e.g. "www.example.com"),
 * matching how `req.headers.host` arrives - mirrors normalizeSlug's role for
 * slugs (see tenant.middleware.ts). Returns "" for empty/invalid input. */
export function normalizeHost(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const withoutProtocol = raw.replace(/^[a-z]+:\/\//, "");
  const hostOnly = withoutProtocol.split("/")[0].split(":")[0];
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostOnly) ? hostOnly : "";
}
