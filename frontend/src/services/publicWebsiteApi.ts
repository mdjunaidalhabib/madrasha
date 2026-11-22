import axios from "axios";
import { attachLanguageHeader } from "@madrasha/shared-ui/src/i18n";

import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";
import { useLanguageStore } from "@madrasha/shared-ui/src/i18n";

// Deliberately its own bare axios instance rather than reusing the admin
// app's authenticated client (see guardianApi.ts for
// the same pattern) - these routes are hit by anonymous website visitors,
// so no Authorization header or 401-triggered logout/redirect belongs here.
const publicApi = axios.create({ baseURL: API_BASE_URL, timeout: 20_000 });
attachLanguageHeader(publicApi);

export type PublicBrand = {
  slug: string;
  name: string;
  address?: string | null;
  logo_url?: string | null;
  institution?: Parameters<ReturnType<typeof useLanguageStore.getState>["setInstitution"]>[0];
};
type BrandCache = { brand: PublicBrand; savedAt: number };
const brandCache = new Map<string, BrandCache>();
const brandRequests = new Map<string, Promise<PublicBrand>>();
const BRAND_MEMORY_TTL = 60_000;
const BRAND_STORAGE_TTL = 30 * 60_000;
const brandKey = (slug: string) => `ems:public-brand:${API_BASE_URL}:${slug}`;

function saveBrand(brand: PublicBrand) {
  const entry = { brand, savedAt: Date.now() };
  brandCache.set(brand.slug, entry);
  try { sessionStorage.setItem(brandKey(brand.slug), JSON.stringify(entry)); } catch { /* Storage is optional. */ }
}

/** Show recent branding immediately while a fresh request runs in the background. */
export function getCachedPublicBrand(slug: string): PublicBrand | null {
  let entry = brandCache.get(slug);
  if (!entry) {
    try { entry = JSON.parse(sessionStorage.getItem(brandKey(slug)) || "null"); } catch { /* Ignore invalid storage. */ }
  }
  return entry?.brand?.slug === slug && Date.now() - entry.savedAt < BRAND_STORAGE_TTL ? entry.brand : null;
}

/** A login/manifest needs branding only, not galleries, classes or admission data. */
export function getPublicBrand(slug: string): Promise<PublicBrand> {
  const cached = brandCache.get(slug);
  if (cached && Date.now() - cached.savedAt < BRAND_MEMORY_TTL) {
    useLanguageStore.getState().setInstitution(cached.brand.institution);
    return Promise.resolve(cached.brand);
  }
  const pending = brandRequests.get(slug);
  if (pending) return pending;
  const request = publicApi.get(`/website/public/${encodeURIComponent(slug)}/brand`).then((res) => {
    const brand = res.data?.data as PublicBrand;
    if (!brand || brand.slug !== slug) throw new Error("Invalid institution brand");
    saveBrand(brand);
    useLanguageStore.getState().setInstitution(brand.institution);
    return brand;
  }).catch((error) => {
    brandCache.delete(slug);
    try { sessionStorage.removeItem(brandKey(slug)); } catch { /* Storage is optional. */ }
    throw error;
  }).finally(() => { brandRequests.delete(slug); });
  brandRequests.set(slug, request);
  return request;
}

export async function getPublicWebsite(slug: string) {
  const res = await publicApi.get(`/website/public/${slug}`);
  // The visitor sees the site in the institution default language (super-
  // admin controlled) unless they picked another one themselves.
  useLanguageStore.getState().setInstitution(res.data?.data?.madrasa?.institution);
  if (res.data?.data?.madrasa?.slug === slug) {
    const { name, address, logo_url, institution } = res.data.data.madrasa;
    saveBrand({ slug, name, address, logo_url, institution });
  }
  return res.data.data;
}

/**
 * Full admission form (mirrors the admin admission form field set) - creates
 * a real PENDING student record for a Muhtamim to review.
 */
export async function submitFullAdmissionApplication(slug: string, payload: Record<string, unknown>) {
  const res = await publicApi.post(`/website/public/${slug}/admission-full`, payload);
  return res.data;
}
