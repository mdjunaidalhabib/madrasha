import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";

import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Opt out of the generic error toast below - for background polling and
     * calls whose caller renders the error inline itself. */
    silent?: boolean;
  }
}

const baseURL = API_BASE_URL;

// withCredentials so the httpOnly refresh-token cookie (set by
// /auth/login and /auth/refresh, scoped to /api/auth) is sent back on the
// refresh/logout calls below - it's never readable from JS, only the
// browser attaches it automatically.
const api = axios.create({ baseURL, timeout: 20_000, withCredentials: true });

const GET_CACHE_TTL_MS = 20_000;
const GET_CACHE_MAX_ENTRIES = 80;

type GetCacheEntry = {
  expiresAt: number;
  response: AxiosResponse<any>;
};

const getCache = new Map<string, GetCacheEntry>();
const inFlightGets = new Map<string, Promise<AxiosResponse<any>>>();
let cacheGeneration = 0;

function stableParams(params: unknown) {
  if (!params || typeof params !== "object") return String(params || "");
  const entries = Object.entries(params as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify(entries);
}

function getCacheKey(url: string, config?: AxiosRequestConfig) {
  const token = useAuthStore.getState().token || "guest";
  const tenantSlug = useAuthStore.getState().madrasaSlug || "public";
  return `${tenantSlug}|${token}|${url}|${stableParams(config?.params)}`;
}

export function clearGetCache() {
  cacheGeneration += 1;
  getCache.clear();
  inFlightGets.clear();
}

/**
 * Short-lived GET cache with in-flight request de-duplication.
 * Re-visiting a page or mounting multiple components that request the same
 * reference data no longer creates duplicate network waits. Requests using
 * AbortController intentionally bypass the shared cache.
 */
export async function cachedGet<T = any>(
  url: string,
  config?: AxiosRequestConfig,
  ttlMs: number = GET_CACHE_TTL_MS,
): Promise<AxiosResponse<T>> {
  if (config?.signal || ttlMs <= 0) return api.get<T>(url, config);

  const key = getCacheKey(url, config);
  const now = Date.now();
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > now) return cached.response as AxiosResponse<T>;
  if (cached) getCache.delete(key);

  const pending = inFlightGets.get(key);
  if (pending) return pending as Promise<AxiosResponse<T>>;

  const requestGeneration = cacheGeneration;
  const request = api
    .get<T>(url, config)
    .then((response) => {
      if (requestGeneration !== cacheGeneration) return response;
      if (getCache.size >= GET_CACHE_MAX_ENTRIES) {
        const oldestKey = getCache.keys().next().value as string | undefined;
        if (oldestKey) getCache.delete(oldestKey);
      }
      getCache.set(key, { expiresAt: Date.now() + ttlMs, response });
      return response;
    })
    .finally(() => inFlightGets.delete(key));

  inFlightGets.set(key, request as Promise<AxiosResponse<any>>);
  return request;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // A request can set its own X-Madrasa-Slug explicitly (login/forgot/reset
  // password, before there's a session to read a tenant from) - that always
  // wins. Every other request falls back to the tenant resolved at login.
  if (!config.headers["X-Madrasa-Slug"]) {
    const tenantSlug = useAuthStore.getState().madrasaSlug;
    if (tenantSlug) {
      config.headers["X-Madrasa-Slug"] = tenantSlug;
    }
  }

  return config;
});

// A 401 during normal use almost always just means the short-lived access
// token expired - /auth/refresh trades the httpOnly refresh-token cookie
// for a new one, and the original request is retried once. Concurrent 401s
// share a single in-flight refresh instead of each firing their own.
let isRefreshing = false;
let refreshWaiters: Array<(token: string | null) => void> = [];

function waitForRefresh(): Promise<string | null> {
  return new Promise((resolve) => refreshWaiters.push(resolve));
}

function settleRefreshWaiters(token: string | null) {
  refreshWaiters.forEach((resolve) => resolve(token));
  refreshWaiters = [];
}

const AUTH_ENDPOINTS_WITHOUT_REFRESH = ["/auth/login", "/auth/refresh", "/auth/logout"];

// sessionStorage key LoginPage reads on mount to show TenantBlockedScreen
// after a mid-session 410/423 redirect (see the response interceptor below).
export const TENANT_BLOCK_STORAGE_KEY = "qms:tenant-block";

api.interceptors.response.use(
  (res) => {
    const method = String(res.config.method || "get").toLowerCase();
    if (method !== "get") clearGetCache();
    return res;
  },
  async (err) => {
    const status = err?.response?.status;
    const originalRequest = err?.config;
    const requestUrl = String(originalRequest?.url || "");
    const canRetryWithRefresh =
      status === 401 &&
      originalRequest &&
      !originalRequest._retriedAfterRefresh &&
      !AUTH_ENDPOINTS_WITHOUT_REFRESH.some((path) => requestUrl.includes(path));

    if (canRetryWithRefresh) {
      originalRequest._retriedAfterRefresh = true;

      if (isRefreshing) {
        const token = await waitForRefresh();
        if (!token) return Promise.reject(err);
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` };
        return api(originalRequest);
      }

      isRefreshing = true;
      try {
        const tenantSlug = useAuthStore.getState().madrasaSlug;
        const refreshRes = await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true, headers: tenantSlug ? { "X-Madrasa-Slug": tenantSlug } : {} },
        );
        const newToken = refreshRes.data?.token as string;
        useAuthStore.getState().setToken(newToken);
        settleRefreshWaiters(newToken);
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newToken}` };
        return api(originalRequest);
      } catch (refreshErr) {
        settleRefreshWaiters(null);
        // Falls through to the existing 401 handling below, which clears
        // the (now-unrefreshable) session and redirects to /login.
      } finally {
        isRefreshing = false;
      }
    }

    // 401 = bad/expired/mismatched session (or a failed refresh above),
    // 410 = madrasa gone (either
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
      clearGetCache();
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
              state: { token: null, user: null, permissions: [], modules: [], madrasaSlug: null },
              version: 0,
            }),
          );
        } catch {
          // ignore storage errors (e.g. private browsing mode)
        }
      }

      // A 410/423 hit mid-session (the madrasa was suspended/deleted from
      // the super-admin panel while this tab was open) needs more than a
      // silent logout - the user was in the middle of using the dashboard
      // and would otherwise just land back on a bare login form with no
      // explanation. Stash the server's message in sessionStorage (it has
      // to survive the full-page reload below) so LoginPage can read it on
      // mount and show TenantBlockedScreen instead of the normal form. A
      // 401 (plain expired/bad token) gets no such treatment - that's a
      // routine "please log in again", not an account-level block.
      if (wasLoggedIn && (status === 410 || status === 423) && typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            TENANT_BLOCK_STORAGE_KEY,
            JSON.stringify({ status, message: err?.response?.data?.message }),
          );
        } catch {
          // ignore storage errors (e.g. private browsing mode)
        }
      }

      if (wasLoggedIn && typeof window !== "undefined") {
        window.location.href = "/login";
      }

      // The redirect above (or the already-logged-out state) is all the
      // feedback this needs - a generic "Something went wrong" toast on top
      // just reads as a scary error immediately after a normal logout. A
      // 410/423 hit while NOT logged in (i.e. a login attempt itself failed)
      // falls through here too - LoginPage's own catch block reads
      // err.response directly to show TenantBlockedScreen inline, so no
      // toast is needed for that case either.
      return Promise.reject(err);
    }

    // 429 = rate-limited (see backend/src/core/app.ts's global limiter, or
    // one of the route-level ones on login/refresh/etc). express-rate-limit
    // always sets Retry-After (seconds) when standardHeaders is on, so surface
    // that instead of letting this fall through to the generic "Something
    // went wrong" toast below - and never auto-retry a 429, immediately or
    // otherwise, since the server just told us to back off.
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

    // /auth/logout is a best-effort, fire-and-forget call (see
    // logoutSession in profileApi.ts, which swallows its own errors) - local
    // logout proceeds regardless, so a failure here shouldn't surface an
    // error toast to the user.
    if (!requestUrl.includes("/auth/logout") && !originalRequest?.silent) {
      const msg = err?.response?.data?.message || err?.message || "Something went wrong";
      useToastStore.getState().push("error", msg);
    }

    return Promise.reject(err);
  },
);

export default api;
