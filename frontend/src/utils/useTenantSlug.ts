import { useParams } from "react-router-dom";
import { getResolvedDomainSlugSync } from "../services/domainResolve";

/** The current tenant's slug, whichever URL scheme got us here: the
 * `:madrasaSlug` route param on the platform's own domain, or (when there's
 * no such param) the slug already resolved from a tenant's custom domain
 * hostname - see CustomDomainTenantGate, which resolves it before rendering
 * any route that calls this. */
export function useTenantSlug(): string {
  const { madrasaSlug } = useParams();
  return madrasaSlug || getResolvedDomainSlugSync();
}
