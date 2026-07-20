import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useToastStore } from "../store/toastStore";

import { API_BASE_URL } from "./apiConfig";

const baseURL = API_BASE_URL;
const adminApi = axios.create({ baseURL });

const GET_CACHE_TTL_MS = 20_000;
const GET_CACHE_MAX_ENTRIES = 60;
const getCache = new Map<string, { expiresAt: number; response: AxiosResponse<any> }>();
const inFlightGets = new Map<string, Promise<AxiosResponse<any>>>();
let cacheGeneration = 0;

function stableParams(params: unknown) {
  if (!params || typeof params !== "object") return String(params || "");
  return JSON.stringify(
    Object.entries(params as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function cacheKey(url: string, config?: AxiosRequestConfig) {
  const token = useAdminAuthStore.getState().token || "guest";
  return `${token}|${url}|${stableParams(config?.params)}`;
}

export function clearGetCache() {
  cacheGeneration += 1;
  getCache.clear();
  inFlightGets.clear();
}

export async function cachedGet<T = any>(
  url: string,
  config?: AxiosRequestConfig,
  ttlMs: number = GET_CACHE_TTL_MS,
): Promise<AxiosResponse<T>> {
  if (config?.signal || ttlMs <= 0) return adminApi.get<T>(url, config);

  const key = cacheKey(url, config);
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.response as AxiosResponse<T>;
  if (cached) getCache.delete(key);

  const pending = inFlightGets.get(key);
  if (pending) return pending as Promise<AxiosResponse<T>>;

  const requestGeneration = cacheGeneration;
  const request = adminApi
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

adminApi.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

adminApi.interceptors.response.use(
  (res) => {
    const method = String(res.config.method || "get").toLowerCase();
    if (method !== "get") clearGetCache();
    return res;
  },
  (err) => {
    if (err?.response?.status === 401) {
      clearGetCache();
      useAdminAuthStore.getState().logout();
    }

    const msg = err?.response?.data?.message || err?.message || "Something went wrong";

    useToastStore.getState().push("error", msg);

    return Promise.reject(err);
  },
);

export default adminApi;
