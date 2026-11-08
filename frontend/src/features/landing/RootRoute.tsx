import { lazy, Suspense, useEffect, useState } from "react";
import PageLoader from "@madrasha/shared-ui/src/components/ui/PageLoader";
import { isPlatformRootHost } from "../../utils/platformHost";
import { resolveDomainToSlug } from "../../services/domainResolve";
import DomainNotConnected from "./DomainNotConnected";

// Load only the page selected by the hostname. Static imports here also
// preload the institution website when the visitor only needs EMS marketing.
const PlatformLandingPage = lazy(() => import("./PlatformLandingPage"));
const PublicWebsitePage = lazy(() => import("../website/PublicWebsitePage"));

// The root "/" route is hostname-aware: on the platform's own domain it's
// the marketing landing page, on any other (tenant custom) domain it's that
// tenant's own public website, resolved from the hostname since there's no
// slug in the URL there.
export default function RootRoute() {
  const onPlatformHost = isPlatformRootHost();
  const [state, setState] = useState<"loading" | "found" | "not-found">(
    onPlatformHost ? "found" : "loading",
  );
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (onPlatformHost) return;
    let cancelled = false;
    resolveDomainToSlug().then((resolved) => {
      if (cancelled) return;
      setSlug(resolved);
      setState(resolved ? "found" : "not-found");
    });
    return () => {
      cancelled = true;
    };
  }, [onPlatformHost]);

  if (onPlatformHost) return <Suspense fallback={<PageLoader />}><PlatformLandingPage /></Suspense>;

  if (state === "loading") return <PageLoader />;

  if (state === "not-found") return <DomainNotConnected />;

  return <Suspense fallback={<PageLoader />}><PublicWebsitePage slug={slug} /></Suspense>;
}
