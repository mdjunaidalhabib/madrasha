import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import PageLoader from "@madrasha/shared-ui/src/components/ui/PageLoader";
import { isPlatformRootHost } from "../../utils/platformHost";
import { resolveDomainToSlug } from "../../services/domainResolve";
import DomainNotConnected from "./DomainNotConnected";
import NotFoundPage from "../common/NotFoundPage";

// Layout route (no path of its own) for the bare, no-slug tenant paths
// (/admission, /guardian/*, /kiosk) that only make sense on a madrasa's own
// custom domain - resolves which tenant owns the current hostname once,
// before rendering any child route, so every child can read the slug
// synchronously (see useTenantSlug). On the platform's own domain these
// bare paths have no meaning (a real visitor always has a slug in the URL
// there), so they 404 instead.
export default function CustomDomainTenantGate() {
  const onPlatformHost = isPlatformRootHost();
  const [state, setState] = useState<"loading" | "found" | "not-found">("loading");

  useEffect(() => {
    if (onPlatformHost) return;
    let cancelled = false;
    resolveDomainToSlug().then((resolved) => {
      if (!cancelled) setState(resolved ? "found" : "not-found");
    });
    return () => {
      cancelled = true;
    };
  }, [onPlatformHost]);

  if (onPlatformHost) return <NotFoundPage />;
  if (state === "loading") return <PageLoader />;
  if (state === "not-found") return <DomainNotConnected />;

  return <Outlet />;
}
