import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";

import { API_BASE_URL } from "./apiConfig";
import { getTenantSlugFromPath, getTenantAdminBase } from "../utils/tenantSlug";

const baseURL = API_BASE_URL;

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const tenantSlug = getTenantSlugFromPath();
  if (tenantSlug) {
    config.headers["X-Madrasa-Slug"] = tenantSlug;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    // 401 = bad/expired/mismatched session, 410 = madrasa gone (either
    // never existed with this slug, or was trashed), 423 = madrasa
    // suspended. In all of these the locally-stored token is no longer
    // usable, so we clear it right away instead of leaving a stale session
    // sitting in the browser — that stale session was what made it look
    // like the app was "stuck" showing a deleted/suspended message until
    // the user manually cleared the browser's storage. Clearing it here
    // means the very next attempt (e.g. after a super admin
    // restores/activates the madrasa) just works by logging in fresh,
    // with no manual cleanup needed.
    // NOTE: plain 403/404 are deliberately excluded — those are used for
    // normal "no permission" / "resource not found" errors elsewhere in
    // the app and should NOT log the user out.
    if (status === 401 || status === 410 || status === 423) {
      const wasLoggedIn = !!useAuthStore.getState().token;
      useAuthStore.getState().logout();

      // Zustand's `persist` middleware writes to localStorage asynchronously.
      // If we navigate away (window.location.href) immediately after calling
      // logout(), there's a race where the write hasn't landed yet and the
      // OLD token survives the reload — which is exactly what made it look
      // like the app was "stuck" until the user manually cleared browser
      // storage. Writing the cleared auth state directly and synchronously
      // here removes that race entirely.
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            "auth-storage",
            JSON.stringify({
              state: { token: null, user: null, permissions: [], modules: [] },
              version: 0,
            }),
          );
        } catch {
          // ignore storage errors (e.g. private browsing mode)
        }
      }

      if (wasLoggedIn && typeof window !== "undefined") {
        const tenantSlug = getTenantSlugFromPath();
        window.location.href = `${getTenantAdminBase(tenantSlug)}/login`;
      }
    }

    const msg = err?.response?.data?.message || err?.message || "Something went wrong";

    useToastStore.getState().push("error", msg);

    return Promise.reject(err);
  },
);

export default api;
