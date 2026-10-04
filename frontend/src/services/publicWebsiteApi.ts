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

export async function getPublicWebsite(slug: string) {
  const res = await publicApi.get(`/website/public/${slug}`);
  // The visitor sees the site in the institution default language (super-
  // admin controlled) unless they picked another one themselves.
  useLanguageStore.getState().setInstitution(res.data?.data?.madrasa?.institution);
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
