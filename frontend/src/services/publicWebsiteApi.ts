import axios from "axios";

import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";

// Deliberately its own bare axios instance rather than reusing the admin
// app's authenticated client (see guardianApi.ts/attendanceKioskApi.ts for
// the same pattern) - these routes are hit by anonymous website visitors,
// so no Authorization header or 401-triggered logout/redirect belongs here.
const publicApi = axios.create({ baseURL: API_BASE_URL, timeout: 20_000 });

export async function getPublicWebsite(slug: string) {
  const res = await publicApi.get(`/website/public/${slug}`);
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
