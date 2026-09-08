import { useEffect, useState } from "react";
import PageLoader from "@madrasha/shared-ui/src/components/ui/PageLoader";
import { isPlatformRootHost } from "../../utils/platformHost";
import { resolveDomainToSlug } from "../../services/domainResolve";
import QmsLandingPage from "./QmsLandingPage";
import DomainNotConnected from "./DomainNotConnected";
import PublicWebsitePage from "../website/PublicWebsitePage";

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

  if (onPlatformHost) return <QmsLandingPage />;

  if (state === "loading") return <PageLoader />;

  if (state === "not-found") return <DomainNotConnected />;

  return <PublicWebsitePage slug={slug} />;
}
