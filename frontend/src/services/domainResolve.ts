import axios from "axios";

import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";

// Anonymous, like publicWebsiteApi's client - a visitor on a tenant's custom
// domain hasn't identified any tenant yet, so nothing here can be
// authenticated.
const domainApi = axios.create({ baseURL: API_BASE_URL, timeout: 20_000 });

// One resolution per page load is enough - a module-level cache (not
// sessionStorage) so a stale slug never survives past a hard reload, in
// case a tenant's connected domain gets reassigned.
let cached: Promise<string> | null = null;
let resolvedSync = "";

async function fetchSlugForCurrentHost(): Promise<string> {
  const res = await domainApi.get("/website/resolve-domain");
  return res.data?.data?.slug || "";
}

/** Resolves which madrasa owns the domain this page is currently loaded on
 * (used when there's no slug in the URL, i.e. a tenant's own custom domain
 * root) - returns "" if no madrasa is connected to it. */
export function resolveDomainToSlug(): Promise<string> {
  if (!cached) {
    cached = fetchSlugForCurrentHost()
      .then((slug) => {
        resolvedSync = slug;
        return slug;
      })
      .catch(() => "");
  }
  return cached;
}

/** Synchronous read of the slug resolved by `resolveDomainToSlug()` - "" if
 * resolution hasn't finished yet (or was never triggered). Every route that
 * renders after that resolution (see CustomDomainTenantGate) can rely on
 * this being populated already, so per-request helpers that can't `await`
 * (the guardianApi interceptor, tenantSlug.ts) can still read the slug. */
export function getResolvedDomainSlugSync() {
  return resolvedSync;
}
