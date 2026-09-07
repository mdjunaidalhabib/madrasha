declare global {
  interface Window {
    // Set via addInitScript by the backend's headless PDF export browser
    // (see report-export.service.ts) - lets that page reach the API over
    // loopback instead of the build-time public API URL baked into
    // VITE_API_URL, which would otherwise hairpin back through the reverse
    // proxy to the same server the page is already rendering inside of.
    __INTERNAL_API_BASE__?: string;
  }
}

export const API_BASE_URL =
  (typeof window !== "undefined" && window.__INTERNAL_API_BASE__) ||
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000/api";
