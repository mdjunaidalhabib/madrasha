import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { institutionHtml } from "./branding.mjs";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const html = await readFile(resolve(root, "index.html"), "utf8");
const built = JSON.parse(await readFile(resolve(root, "admin-config.json"), "utf8"));
const publicApi = process.env.PUBLIC_API_URL || built.apiBase;
const api = (process.env.INTERNAL_API_URL || publicApi).replace(/\/$/, "");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

createServer(async (req, res) => {
  try {
    if (req.url === "/api" || req.url.startsWith("/api/")) {
      // Keep refresh cookies on the institution's own origin. Cross-site
      // API cookies would otherwise be blocked by some browsers.
      const target = new URL(api + req.url.slice(4));
      const host = String(req.headers.host || "");
      if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
        res.writeHead(400).end();
        return;
      }
      const upstream = (target.protocol === "https:" ? httpsRequest : httpRequest)(
        target,
        {
          method: req.method,
          headers: { ...req.headers, host: target.host, origin: `https://${host}` },
        },
        (response) => {
          res.writeHead(response.statusCode || 502, response.headers);
          response.pipe(res);
        },
      );
      upstream.setTimeout(120000, () => upstream.destroy(new Error("API timeout")));
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.on("aborted", () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = resolve(root, "." + pathname);
    if (
      (file !== resolve(root) && !file.startsWith(root.endsWith(sep) ? root : root + sep)) ||
      pathname.includes("\0") ||
      pathname.split(/[\\/]/).some((part) => part.startsWith(".")) ||
      pathname === "/admin-config.json"
    ) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    const info = await stat(file).catch(() => null);
    let body;
    let type;
    if (info?.isFile() && extname(file) !== ".html") {
      type = types[extname(file)] || "application/octet-stream";
      body = await readFile(file);
      if (pathname.startsWith("/assets/"))
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      else if (pathname.startsWith("/fonts/"))
        res.setHeader("Cache-Control", "public, max-age=86400");
    } else if (extname(pathname) && extname(pathname) !== ".html") {
      res.writeHead(404).end();
      return;
    } else {
      // Resolve from this exact host. Do not trust arbitrary forwarded hosts.
      const host = String(req.headers.host || "");
      if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
        res.writeHead(400).end();
        return;
      }
      const response = await fetch(`${api}/website/resolve-admin-domain`, {
        headers: { Origin: `https://${host}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Domain lookup failed");
      const { data } = await response.json();
      body = Buffer.from(data ? institutionHtml(html, data, publicApi) : html);
      type = types[".html"];
    }
    res.setHeader("Content-Type", type);
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (
      body.length > 512 &&
      /text|javascript|json|svg|font/.test(type) &&
      /\bgzip\b/.test(req.headers["accept-encoding"] || "")
    ) {
      body = gzipSync(body);
      res.setHeader("Content-Encoding", "gzip");
    }
    res.setHeader("Content-Length", body.length);
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res
      .writeHead(503, { "Content-Type": "text/plain; charset=utf-8" })
      .end("Unable to connect. Please try again.");
  }
}).listen(Number(process.env.PORT || 5181), "0.0.0.0");
