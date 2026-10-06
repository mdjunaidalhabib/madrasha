import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";

/** Windows installer for the attendance connector. The backend redirects to
 * the copy CI uploads to the platform R2 bucket. Override per deployment
 * with VITE_CONNECTOR_DOWNLOAD_URL (build-time, like VITE_PUBLIC_SITE_URL). */
export const CONNECTOR_DOWNLOAD_URL =
  (import.meta.env.VITE_CONNECTOR_DOWNLOAD_URL as string | undefined) ||
  `${API_BASE_URL.replace(/\/+$/, "")}/downloads/attendance-connector`;

/** Server origin the connector talks to (API base without the trailing /api). */
export const connectorApiBaseUrl = () => API_BASE_URL.replace(/\/api\/?$/, "");

export const PAIRING_PREFIX = "ADC1.";

export type PairingPayload = {
  v: 1;
  url: string;
  slug: string;
  inst: number;
  dev: string;
  key: string;
};

/** UTF-8 safe base64url (no padding). */
export function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Single code the connector installer / `connector setup --token` accepts. */
export function encodePairingCode(p: Omit<PairingPayload, "v">): string {
  const payload: PairingPayload = { v: 1, url: p.url, slug: p.slug, inst: p.inst, dev: p.dev, key: p.key };
  return PAIRING_PREFIX + base64UrlEncode(JSON.stringify(payload));
}
