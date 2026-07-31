import axios from "axios";
import { useGuardianAuthStore } from "../store/guardianAuthStore";
import { useToastStore } from "../store/toastStore";
import { API_BASE_URL } from "./apiConfig";
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

guardianApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401 || status === 410 || status === 423) {
      const wasLoggedIn = !!useGuardianAuthStore.getState().token;
      useGuardianAuthStore.getState().logout();

      if (wasLoggedIn && typeof window !== "undefined") {
        const tenantSlug = getTenantSlugFromPath();
        window.location.href = `${getTenantGuardianBase(tenantSlug)}/login`;
      }
    }

    const msg = err?.response?.data?.message || err?.message || "Something went wrong";
    useToastStore.getState().push("error", msg);

    return Promise.reject(err);
  },
);

export default guardianApi;
