import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { renderSocialPreview } from "./social-preview.mjs";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const html = await readFile(resolve(root, "index.html"), "utf8");
const builtConfig = JSON.parse(await readFile(resolve(root, "social-config.json"), "utf8"));
const config = {
  ...builtConfig,
  apiBase: process.env.PUBLIC_API_URL || builtConfig.apiBase,
  internalApiBase: process.env.INTERNAL_API_URL,
  platformHost: process.env.PLATFORM_ROOT_HOST || builtConfig.platformHost,
};
const types = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".otf": "font/otf", ".webp": "image/webp", ".txt": "text/plain", ".pdf": "application/pdf",
};

createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = resolve(root, "." + pathname);
    if ((file !== resolve(root) && !file.startsWith(root.endsWith(sep) ? root : root + sep)) || pathname.includes("\0") || pathname.split(/[\\/]/).some((part) => part.startsWith("."))) {
      res.writeHead(404).end();
      return;
    }
    // Never expose internal service addresses from the build configuration.
    if (pathname === "/social-config.json") { res.writeHead(404).end(); return; }
    let body;
    let type;
    const info = await stat(file).catch(() => null);
    if (info?.isFile() && extname(file) !== ".html") {
      type = types[extname(file)] || "application/octet-stream";
      body = await readFile(file);
      if (pathname.startsWith("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      else if (pathname.startsWith("/fonts/")) res.setHeader("Cache-Control", "public, max-age=86400");
    } else if (extname(pathname) && extname(pathname) !== ".html") {
      res.writeHead(404).end();
      return;
    } else {
      type = types[".html"];
      body = Buffer.from(await renderSocialPreview(html, req, config));
    }
    res.setHeader("Content-Type", type);
    res.setHeader("Vary", "Accept-Encoding");
    if (body.length > 512 && /text|javascript|json|svg|font/.test(type) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      body = gzipSync(body);
      res.setHeader("Content-Encoding", "gzip");
    }
    res.setHeader("Content-Length", body.length);
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(500).end("Unable to load page");
  }
}).listen(Number(process.env.PORT || 5183), "0.0.0.0", () => console.log("Frontend server is ready"));
