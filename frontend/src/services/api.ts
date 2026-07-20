import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";

import { API_BASE_URL } from "./apiConfig";
import { getTenantSlugFromPath, getTenantAdminBase } from "../utils/tenantSlug";

const baseURL = API_BASE_URL;

const api = axios.create({ baseURL });

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
  const tenantSlug = getTenantSlugFromPath() || "public";
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

  const tenantSlug = getTenantSlugFromPath();
  if (tenantSlug) {
    config.headers["X-Madrasa-Slug"] = tenantSlug;
  }

  return config;
});

api.interceptors.response.use(
  (res) => {
    const method = String(res.config.method || "get").toLowerCase();
    if (method !== "get") clearGetCache();
    return res;
  },
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
