Add server-side PDF export for [invoice / order receipt] using a real headless
browser (Playwright + Chromium), not client-side canvas rasterization
(html2canvas etc.) and not a blob-URL download. Here's the full architecture,
learned from building the same system for another project - implement it the
same way.

## Why not client-side (html2canvas + jsPDF)
Canvas-based rendering mangles complex text (non-Latin scripts, ligatures,
synthetic bold) and is generally lower fidelity than what the browser itself
renders. Render through a real browser engine instead.

## Why not a blob: URL download
The obvious approach - fetch the PDF via XHR/fetch with `responseType: blob`,
then trigger a save via a synthetic `<a download>` click on
`URL.createObjectURL(blob)` - silently fails for any user running a
browser-integrated download manager (Internet Download Manager and similar,
common on Windows). These managers intercept every download click but can't
refetch a `blob:` URL over the network, so they grab the download, fail, and
the file never saves - with no error visible to your own code. Avoid this
entirely: never use blob + XHR for a file download the user will click a
button to get.

## Architecture (4 pieces)

**1. A dedicated "print" route, no chrome around it.**
A route like `/print/invoices/:id` (or via query param) that renders ONLY the
invoice content - no nav/sidebar/header, nothing interactive. It must:
- Read whatever data it needs from the URL (id, or query params) rather than
  from client-only state, since a headless browser navigates directly to it
  with no prior user interaction.
- Set a `data-ready="true"` attribute on a root element only once all data
  has loaded AND is actually rendered - this is what the server waits for.
- If your CSS uses a `@page` size rule or any print/page-size-specific CSS
  gated behind an attribute/class (e.g. `html[data-print-size="a4"]`), that
  route must set that attribute ITSELF. Don't assume it's set by some other
  component (like an export toolbar) that isn't mounted on this route - if
  it's set elsewhere, only the interactive preview gets it right and the
  print route silently renders with unconstrained/wrong page height. This
  exact bug caused a page-number footer (`position: absolute; bottom: 2mm`)
  to render right after the content instead of pinned to the real page
  bottom, on every server-generated PDF, invisible in the live preview.

**2. A Playwright-based PDF service - ONE shared browser instance, reused.**
```
class InvoiceExportService {
  private browserPromise: Promise<Browser> | null = null;
  private async getBrowser(): Promise<Browser> {
    if (this.browserPromise) {
      const existing = await this.browserPromise;
      if (existing.isConnected()) return existing;
      this.browserPromise = null;
    }
    this.browserPromise = chromium.launch({ headless: true });
    return this.browserPromise;
  }
  async generatePdf(params) {
    const browser = await this.getBrowser();
    const context = await browser.newContext();
    try {
      // if auth is needed: inject a short-lived token via
      // context.addInitScript(() => localStorage.setItem(...))
      const page = await context.newPage();
      await page.goto(printUrl, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForSelector('[data-ready="true"]', { timeout: 60_000 });
      return await page.pdf({ width: "210mm", height: "297mm", printBackground: true, margin: 0 });
    } finally {
      await context.close(); // only the context - never close the shared browser
    }
  }
}
```
Never `chromium.launch()` per request - a cold launch is the single biggest
chunk of latency and does not scale. Launch once, open/close a `context` per
request (contexts are cheap and isolated).

**3. A concurrency limit (semaphore) around generation.**
Each generation drives a real browser tab - real CPU/memory. With no cap, a
burst of simultaneous exports (e.g. many customers downloading invoices at
once) can OOM the whole server process, not just the export feature. Wrap
`generatePdf` with a small semaphore capping concurrent renders (e.g. 3), so
extra requests queue for a few seconds instead of crashing the server.

**4. Two-step download: POST generates, GET downloads a real URL.**
- `POST /invoices/:id/export-pdf` → runs `generatePdf()`, stores the
  resulting buffer in a short-lived in-memory store keyed by a random id
  (crypto-random, ~24 bytes), returns `{ downloadId }` as JSON. Do NOT return
  the PDF bytes directly here.
- `GET /invoices/export-pdf/:downloadId` → looks up the buffer, sets
  `Content-Type: application/pdf` and `Content-Disposition: attachment;
  filename="..."`, sends it. This route must NOT require the normal
  Authorization header (a plain browser download can't attach one) - protect
  it with the id's own unguessability + a short TTL (~2 minutes) instead. If
  this app has route-level auth middleware applied broadly (e.g. mounted at
  "/"), make sure this specific GET route is registered/matched BEFORE that
  middleware, or it'll get rejected before reaching the handler.
- **Do NOT delete the entry on first read** (no "single-use, delete-on-GET").
  Download managers probe a URL first (a HEAD request, which frameworks
  often route to the same GET handler; or a small ranged GET) before issuing
  the real download - deleting on that first hit makes the REAL download
  404 right after. Let expiry (TTL) alone be security; a probe-then-fetch
  pattern is normal and must both succeed.
- Frontend: `POST` for the `downloadId`, then create a real `<a>` with
  `href = "/invoices/export-pdf/" + downloadId` and `download` attribute,
  append to DOM, `.click()`, remove. No `URL.createObjectURL`, no blob.

## Auth note
This project's invoices/orders are likely accessible by order id (guest
checkout) rather than only a logged-in session - adapt step 1's data-loading
and step 2's headless-browser auth to however this app actually authorizes
viewing a given invoice (e.g. no token needed if the print route is itself
gated by a signed order id / short-lived link, rather than a full user
session).
