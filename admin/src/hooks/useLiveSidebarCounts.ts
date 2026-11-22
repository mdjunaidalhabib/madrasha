import { useEffect } from "react";
import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";
import { useAuthStore } from "../store/authStore";
import { useAdminDomainStore } from "../store/adminDomainStore";
import { refreshSidebarCounts } from "../services/sidebarApi";

export const ADMISSION_CHANGED_EVENT = "admissions:changed";

export function useLiveSidebarCounts() {
  const token = useAuthStore((state) => state.token);
  const slug = useAuthStore((state) => state.madrasaSlug);
  const domain = useAdminDomainStore((state) => state.institution);

  useEffect(() => {
    if (!token || !(domain?.slug || slug)) return;
    const controller = new AbortController();
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (controller.signal.aborted) return;
      void refreshSidebarCounts();
      window.dispatchEvent(new Event(ADMISSION_CHANGED_EVENT));
    };
    const connect = async () => {
      try {
        const base = domain ? "/api" : API_BASE_URL.replace(/\/$/, "");
        const response = await fetch(`${base}/sidebar/events`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Madrasa-Slug": domain?.slug || slug!,
            Accept: "text/event-stream",
          },
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          // Normal API refresh handles expired access tokens and invalid sessions.
          if (response.status === 401) void refreshSidebarCounts();
          throw new Error("Sidebar stream unavailable");
        }
        if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream"))
          throw new Error("Invalid sidebar stream");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        try {
          while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true }).replace(/\r/g, "");
            let boundary: number;
            while ((boundary = pending.indexOf("\n\n")) !== -1) {
              const event = pending.slice(0, boundary);
              pending = pending.slice(boundary + 2);
              if (/^event: (ready|changed)$/m.test(event)) refresh();
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch {
        // Reconnect quietly; the ordinary sidebar request handles user-facing errors.
      } finally {
        if (!controller.signal.aborted) reconnect = setTimeout(() => void connect(), 2000);
      }
    };
    void connect();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    // Reconcile missed updates after network interruptions or across server workers.
    const fallback = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);
    return () => {
      controller.abort();
      clearTimeout(reconnect);
      clearInterval(fallback);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, slug, domain]);
}
