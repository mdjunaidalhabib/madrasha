import { useEffect, useState } from "react";
import { isStandalone } from "@madrasha/shared-ui/src/pwa/pwa";

/**
 * True only when the admin panel runs as an installed app (PWA) - i.e. with no
 * browser address bar / back / reload buttons of its own. Reacts live if the
 * display mode changes (e.g. the app gets installed while the tab is open).
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(() => isStandalone());

  useEffect(() => {
    const mq = window.matchMedia?.("(display-mode: standalone)");
    if (!mq) return;
    const update = () => setStandalone(isStandalone());
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return standalone;
}
