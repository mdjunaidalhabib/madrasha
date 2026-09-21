import crypto from "crypto";

type StoredPdf = { buffer: Buffer; fileName: string; expiresAt: number; downloaded?: boolean };

// Set once a real GET has finished sending the whole file (see
// downloadReportPdf) - lets the admin page show "download complete", since a
// plain link click gives the page no completion event of its own.
export const markDownloaded = (id: string): void => {
  const entry = store.get(id);
  if (entry) entry.downloaded = true;
};

export const isDownloaded = (id: string): boolean | undefined => {
  const entry = store.get(id);
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  return Boolean(entry.downloaded);
};

// A generated PDF briefly waits here between the POST that renders it and
// the GET that downloads it (see report-export.controller.ts) - the POST
// can no longer hand back the PDF bytes directly since Internet Download
// Manager (and similar browser-integrated download managers) intercepts
// every download click but can't refetch a client-side `blob:` URL, so the
// old blob+XHR flow silently failed for any user with IDM installed. A real,
// re-fetchable GET URL is what those download managers actually need.
// Deliberately in-memory (not disk/DB): this only has to survive the few
// seconds between those two requests, and both must land on the same Node
// process - true for this app's single-instance deployment.
const store = new Map<string, StoredPdf>();
const TTL_MS = 2 * 60 * 1000;
const MAX_STORED_PDFS = 30;

const evictExpired = () => {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
};

export const storePdf = (buffer: Buffer, fileName: string): string => {
  evictExpired();
  // Hard cap on held PDFs (a few MB each) so a burst of exports whose
  // downloads never happen (dropped network, closed tab) can't grow memory
  // without bound within the TTL - oldest goes first (Map keeps insertion order).
  while (store.size >= MAX_STORED_PDFS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  const id = crypto.randomBytes(24).toString("hex");
  store.set(id, { buffer, fileName, expiresAt: Date.now() + TTL_MS });
  return id;
};

// Deliberately NOT single-use/delete-on-read: a download manager (IDM and
// friends) probes the URL first - a HEAD request (which Express routes to
// this same GET handler by default) and/or a small ranged GET - before
// issuing the real download request. Deleting on that first hit made the
// real request 404 right after a successful-looking generatePdf(), which is
// exactly the bug this whole download-id scheme was written to fix. Expiry
// alone (evictExpired, checked here too) bounds how long a leaked/guessed id
// would work, without breaking that probe-then-fetch pattern.
export const takePdf = (id: string): StoredPdf | undefined => {
  const entry = store.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(id);
    return undefined;
  }
  return entry;
};
