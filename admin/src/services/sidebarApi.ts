import api, { cachedGet } from "./api";
import { useSidebarStore } from "../store/sidebarStore";
import { useAuthStore } from "../store/authStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

export async function loadSidebar() {
  const res = await cachedGet("/sidebar");
  return res.data;
}

// Bypasses the GET cache so sidebar badge counts (e.g. পেন্ডিং ভর্তি
// অনুমোদন) reflect an action just taken on the current page immediately,
// instead of waiting out cachedGet's TTL.
export async function refreshSidebar() {
  const res = await api.get("/sidebar", { silent: true });
  return res.data;
}

let refreshVersion = 0;

/** Reconcile badge counts immediately after a successful admission action. */
export async function refreshSidebarCounts() {
  const version = ++refreshVersion;
  const { token, madrasaSlug } = useAuthStore.getState();
  try {
    const data = await refreshSidebar();
    const session = useAuthStore.getState();
    if (version === refreshVersion && session.token === token && session.madrasaSlug === madrasaSlug) {
      useSidebarStore.getState().setItems(data);
    }
  } catch (error) {
    logger.error("Sidebar refresh failed:", error);
  }
}
