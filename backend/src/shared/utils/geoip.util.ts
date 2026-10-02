import geoip from "fast-geoip";

export interface IpLocation {
  city: string | null;
  country: string | null;
}

/** Normalises Express's req.ip ("::ffff:1.2.3.4" -> "1.2.3.4"). */
export const normalizeIp = (ip?: string | null): string | null => {
  if (!ip) return null;
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
};

/** Approximate city/country for an IP from the offline GeoLite data bundled
 * with fast-geoip - no third-party request. Private/local IPs and lookup
 * failures resolve to nulls; this is display-only, never security-relevant. */
export async function lookupIpLocation(ip?: string | null): Promise<IpLocation> {
  if (!ip) return { city: null, country: null };
  try {
    const hit = await geoip.lookup(ip);
    return { city: hit?.city || null, country: hit?.country || null };
  } catch {
    return { city: null, country: null };
  }
}
