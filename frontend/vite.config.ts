import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { renderSocialPreview } from "./server/social-preview.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT) || 5183;
  const apiBase = (env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
  const socialImageUrl = `${apiBase}/platform-brand/icon/icon-512.png`;

  return {
    plugins: [
      react(),
      {
        name: "ems-social-preview",
        generateBundle() {
          this.emitFile({ type: "asset", fileName: "social-config.json", source: JSON.stringify({
            apiBase, platformHost: env.VITE_PLATFORM_ROOT_HOST || "",
          }) });
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.headers.accept?.includes("text/html")) return next();
            try {
              const template = await readFile(new URL("./index.html", import.meta.url), "utf8");
              const html = await server.transformIndexHtml(req.url || "/", template);
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(await renderSocialPreview(html, req, { apiBase, platformHost: env.VITE_PLATFORM_ROOT_HOST || "" }));
            } catch (error) { next(error); }
          });
        },
        transformIndexHtml(html) {
          // Resolve at build time: messaging crawlers do not execute React.
          const escaped = socialImageUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
          return html.replaceAll("__EMS_SOCIAL_IMAGE_URL__", escaped);
        },
      },
    ],
    server: {
      port,
      strictPort: false,
    },
    preview: {
      port,
    },
  };
});
