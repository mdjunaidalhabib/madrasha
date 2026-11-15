/* Generated for each release. No API responses, user data, or uploads are stored. */
const PREFIX = __CACHE_PREFIX__;
const VERSION = __VERSION__;
const SHELL_CACHE = `${PREFIX}${VERSION}-shell`;
const ASSET_CACHE = `${PREFIX}${VERSION}-assets`;
const SHELL = __SHELL_FILES__;
const ASSETS = new Set(__ASSET_FILES__);
const MAX_RUNTIME_ASSETS = 100;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(
        SHELL.map(
          (url) =>
            new Request(url, {
              cache: url === "/" ? "reload" : "force-cache",
              credentials: "omit",
            }),
        ),
      );
      // An update waits for old tabs to close; never replace a running release.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith(PREFIX) &&
              name !== SHELL_CACHE &&
              name !== ASSET_CACHE,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Print/export and API routes always keep their existing network behavior.
  if (url.pathname.startsWith("/api/") || url.pathname.includes("/print/"))
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const shell = await (await caches.open(SHELL_CACHE)).match("/");
          if (shell) {
            // A device can still report onLine=true when its router has lost
            // internet access. Tell the restored shell why it was served.
            const html = (await shell.text()).replace(
              "<head>",
              "<head><script>window.__EMS_OFFLINE_SHELL__=true;</script>",
            );
            return new Response(html, {
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
              },
            });
          }
          return new Response(
            "ইন্টারনেট সংযোগ নেই। সংযোগ ফিরে এলে আবার চেষ্টা করুন।",
            {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            },
          );
        }
      })(),
    );
    return;
  }
  // Exact build allowlist prevents caching APIs, stable URLs, or error HTML.
  if (!ASSETS.has(url.pathname) || url.search) return;
  event.respondWith(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      const runtime = await caches.open(ASSET_CACHE);
      const cached =
        (await shell.match(request)) || (await runtime.match(request));
      if (cached) return cached;
      const response = await fetch(request);
      if (
        response.ok &&
        response.type === "basic" &&
        !response.headers.get("Content-Type")?.includes("text/html")
      ) {
        const copy = response.clone();
        event.waitUntil(
          (async () => {
            try {
              await runtime.put(request, copy);
              const keys = await runtime.keys();
              await Promise.all(
                keys
                  .slice(0, Math.max(0, keys.length - MAX_RUNTIME_ASSETS))
                  .map((key) => runtime.delete(key)),
              );
            } catch {
              /* Storage full/disabled must not prevent normal navigation. */
            }
          })(),
        );
      }
      return response;
    })(),
  );
});
