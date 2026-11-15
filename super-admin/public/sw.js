/* Minimal service worker - makes the app installable (PWA) and shows a friendly
 * page when offline. It deliberately caches NOTHING from the app itself:
 * index.html is no-cache and assets are content-hashed, so every deploy is
 * picked up immediately exactly as before (see chunkReload.ts). */
const OFFLINE_HTML = `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>অফলাইন</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
font-family:system-ui,sans-serif;background:#f0fdf4;color:#064e3b;text-align:center;padding:24px}
button{margin-top:16px;border:0;border-radius:10px;background:#059669;color:#fff;padding:10px 20px;font-size:15px}</style>
</head><body><div><h1 style="font-size:22px">ইন্টারনেট সংযোগ নেই</h1>
<p>সংযোগ ফিরে এলে আবার চেষ্টা করুন।</p><button onclick="location.reload()">আবার চেষ্টা করুন</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
