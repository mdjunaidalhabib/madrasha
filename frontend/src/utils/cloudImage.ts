/**
 * Serves a Cloudinary upload resized + recompressed for where it is shown.
 * Admins upload originals straight from phones/cameras (often 3-8 MB each),
 * and the public site used to download every one of them at full size.
 * `f_auto,q_auto` picks WebP/AVIF at a sane quality; `c_limit,w_N` only ever
 * shrinks (never upscales). Non-Cloudinary or already-transformed URLs are
 * returned untouched.
 */
export function cldImg<T extends string | null | undefined>(url: T, width: number): T {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (/\/upload\/[^/]*\b(?:f_auto|q_auto|w_\d+)/.test(url)) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${width}/`) as T;
}
