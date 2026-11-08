import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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
