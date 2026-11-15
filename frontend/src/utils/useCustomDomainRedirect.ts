import { useEffect } from "react";
import { isPlatformRootHost } from "./platformHost";

/** Sends a visitor at the platform's own `/:slug` URL to that madrasa's
 * connected custom domain instead, once it's known (from the madrasa's
 * public API response) - keeps the platform URL working as a stable
 * "canonical" link while the madrasa's own domain becomes the real one
 * people land on. No-op when already on that domain (or any non-platform
 * domain) so it can't redirect-loop. */
export function useCustomDomainRedirect(customDomain?: string | null) {
  useEffect(() => {
    if (!customDomain || !isPlatformRootHost()) return;
    const { pathname, search, hash } = window.location;
    const segments = pathname.split("/").filter(Boolean);
    const rest = segments.slice(segments[0] === "m" ? 2 : 1).join("/");
    window.location.replace(`https://${customDomain}/${rest}${search}${hash}`);
  }, [customDomain]);
}
