const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

// Only the public frontend's tenant routes are candidates. Assets never reach here.
export function tenantSlug(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[0] === "m" ? parts[1] : parts[0];
  if (!slug || ["admission", "contact", "guardian", "demo", "index.html"].includes(slug)) return null;
  return /^[a-z0-9-]+$/i.test(slug) ? slug : null;
}

export function replaceMetadata(html, { name, description, image, url }) {
  // Remove the platform tags first, including image dimensions when no logo exists.
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\b(?=[^>]*(?:name|property)\s*=\s*["'](?:description|og:[^"']+|twitter:[^"']+)["'])[^>]*>/gi, "")
    .replace(/<link\b(?=[^>]*rel\s*=\s*["']canonical["'])[^>]*>/gi, "");
  const meta = (key, value) => `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escapeHtml(value)}" />`;
  const tags = [
    `<title>${escapeHtml(name)}</title>`, meta("description", description),
    meta("og:type", "website"), meta("og:locale", "bn_BD"),
    meta("og:site_name", name), meta("og:title", name),
    meta("og:description", description), meta("og:url", url),
    meta("twitter:card", "summary"), meta("twitter:title", name),
    meta("twitter:description", description),
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
  ];
  if (image) tags.push(
    meta("og:image", image), meta("og:image:type", "image/png"),
    meta("og:image:width", "512"), meta("og:image:height", "512"),
    meta("og:image:alt", name), meta("twitter:image", image), meta("twitter:image:alt", name),
  );
  return html.replace(/<\/head>/i, `${tags.join("\n    ")}\n  </head>`);
}

export async function renderSocialPreview(html, req, config, fetcher = fetch) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
  const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim() === "https" ? "https" : "http";
  const origin = new URL(`${protocol}://${host}`).origin;
  const pathname = new URL(req.url || "/", origin).pathname;
  const slug = tenantSlug(pathname);
  const publicApi = new URL(config.apiBase, origin).href.replace(/\/$/, "");
  const requestApi = (config.internalApiBase || publicApi).replace(/\/$/, "");
  const signal = AbortSignal.timeout(4000);
  const read = async (path, headers = {}) => {
    const response = await fetcher(`${requestApi}${path}`, { headers, signal });
    if (!response.ok) throw new Error(`Share metadata: HTTP ${response.status}`);
    return (await response.json()).data;
  };
  const hostname = new URL(origin).hostname;
  const customDomain = config.platformHost && ![config.platformHost, "localhost", "127.0.0.1"].includes(hostname);
  try {
    if (!slug && !customDomain) return html.replace(/<meta property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${escapeHtml(origin + pathname)}" />`);
    const data = await read(customDomain
      ? `/website/share?host=${encodeURIComponent(hostname)}`
      : `/website/public/${encodeURIComponent(slug)}/share`);
    const image = data.logoVersion
      ? `${publicApi}/website/public/${encodeURIComponent(data.slug)}/icon/icon-512.png?v=${encodeURIComponent(data.logoVersion)}`
      : null;
    return replaceMetadata(html, { name: data.name, description: data.description, image, url: origin + pathname });
  } catch {
    // Keep the SPA available during an API outage, without advertising the
    // platform's logo as the tenant's. Do not cache this fallback response.
    return replaceMetadata(html, {
      name: "শিক্ষা প্রতিষ্ঠান", description: "প্রতিষ্ঠানের ওয়েবসাইট", image: null, url: origin + pathname,
    });
  }
}
