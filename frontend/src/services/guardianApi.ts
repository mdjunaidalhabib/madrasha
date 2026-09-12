import axios from "axios";
import { useGuardianAuthStore } from "../store/guardianAuthStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";
import { getTenantSlugFromPath, getTenantGuardianBase } from "../utils/tenantSlug";

// Separate axios instance from services/api.ts on purpose: that instance's
// interceptors are hard-wired to the tenant-admin auth store, so reusing it
// here would attach the admin's token (or none) to guardian requests, and a
// guardian-side 401 would wipe the admin session and redirect to the admin
// login page instead of the guardian one.
const guardianApi = axios.create({ baseURL: API_BASE_URL });

guardianApi.interceptors.request.use((config) => {
  const token = useGuardianAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const tenantSlug = getTenantSlugFromPath();
  if (tenantSlug) {
    config.headers["X-Madrasa-Slug"] = tenantSlug;
  }

  return config;
});

// sessionStorage key GuardianLoginPage reads on mount to show
// TenantBlockedScreen after a mid-session 410/423 redirect below.
export const GUARDIAN_TENANT_BLOCK_STORAGE_KEY = "qms:guardian-tenant-block";

guardianApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401 || status === 410 || status === 423) {
      const wasLoggedIn = !!useGuardianAuthStore.getState().token;
      useGuardianAuthStore.getState().logout();

      if (wasLoggedIn && typeof window !== "undefined") {
        // 410/423 mid-session (madrasa suspended/deleted from the
        // super-admin panel while this guardian was browsing) needs to
        // explain itself, not just bounce silently to a bare login form -
        // see GuardianLoginPage, which reads this on mount and renders
        // TenantBlockedScreen instead of the login form. A plain 401
        // (expired token) skips this - that's routine, not an account block.
        if (status === 410 || status === 423) {
          try {
            window.sessionStorage.setItem(
              GUARDIAN_TENANT_BLOCK_STORAGE_KEY,
              JSON.stringify({ status, message: err?.response?.data?.message }),
            );
          } catch {
            // ignore storage errors (e.g. private browsing mode)
          }
        }

        const tenantSlug = getTenantSlugFromPath();
        window.location.href = `${getTenantGuardianBase(tenantSlug)}/login`;
        // The redirect above is all the feedback a mid-session 410/423
        // needs - skip the generic toast below so it doesn't flash right
        // before the page unloads.
        return Promise.reject(err);
      }
    }

    // 429 = rate-limited (see backend/src/core/app.ts's global limiter, or
    // guardian.routes.ts's own loginLimiter). express-rate-limit always sets
    // Retry-After (seconds) when standardHeaders is on - surface that
    // instead of a generic message, and never auto-retry a 429.
    if (status === 429) {
      const retrySeconds = Number(err?.response?.headers?.["retry-after"]);
      const baseMsg = err?.response?.data?.message || "অনেক বেশি অনুরোধ হয়েছে।";
      const msg =
        Number.isFinite(retrySeconds) && retrySeconds > 0
          ? `${baseMsg} অনুগ্রহ করে ${retrySeconds} সেকেন্ড পর আবার চেষ্টা করুন।`
          : baseMsg;
      useToastStore.getState().push("error", msg);
      return Promise.reject(err);
    }

    const msg = err?.response?.data?.message || err?.message || "Something went wrong";
    useToastStore.getState().push("error", msg);

    return Promise.reject(err);
  },
);

export default guardianApi;
