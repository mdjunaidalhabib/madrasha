import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // .env, .env.local ইত্যাদি ফাইল থেকে ভ্যারিয়েবল লোড করা হচ্ছে (এমনকি VITE_ প্রিফিক্স ছাড়াও)
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT) || 5173;

  return {
    plugins: [react()],
    server: {
      port,
      strictPort: false, // পোর্ট বিজি থাকলে ভাইট অটোমেটিক পরের ফ্রি পোর্ট ব্যবহার করবে
    },
    preview: {
      port,
    },
    build: {
      // Keep framework code in stable browser-cacheable chunks. Heavy Excel
      // libraries are imported only when the user clicks upload/export.
      chunkSizeWarningLimit: 750,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Keep the very large spreadsheet parsers outside all page chunks.
            // They are downloaded only after an upload/export action.
            if (id.includes("node_modules") && id.includes("xlsx")) return "vendor-excel";
            return undefined;
          },
        },
      },
    },
  };
});
