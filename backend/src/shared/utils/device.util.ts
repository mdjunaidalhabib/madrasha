/** Short device label from a User-Agent - e.g. "উইন্ডোজ কম্পিউটার",
 * "iPhone", "অ্যান্ড্রয়েড ফোন (SM-A515F)". Mirrors describeDevice() on the
 * admin profile page so the activity log names a device the same way the
 * device list does. Browser is deliberately left out. */
export function describeDevice(userAgent?: string | null): string {
  if (!userAgent) return "অজানা ডিভাইস";

  if (/iPad/.test(userAgent)) return "iPad";
  if (/iPhone|iPod/.test(userAgent)) return "iPhone";

  if (/Android/.test(userAgent)) {
    const base = /Mobile/.test(userAgent) ? "অ্যান্ড্রয়েড ফোন" : "অ্যান্ড্রয়েড ট্যাবলেট";
    const model = userAgent.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/)?.[1]?.trim();
    return model && model !== "K" ? `${base} (${model})` : base;
  }

  if (/CrOS/.test(userAgent)) return "Chromebook";
  if (/Windows/.test(userAgent)) return "উইন্ডোজ কম্পিউটার";
  if (/Macintosh|Mac OS X/.test(userAgent)) return "Mac";
  if (/Linux/.test(userAgent)) return "লিনাক্স কম্পিউটার";

  return "অজানা ডিভাইস";
}
