import { chromium, Browser } from "playwright";
import { generateToken } from "../../../shared/utils/jwt.util";
import { config } from "../../../shared/config";
import { logger } from "../../../shared/logger/logger";
import { ApiError } from "../../../shared/errors";

type PaperSize = "a4" | "a5";
type Orientation = "portrait" | "landscape";

// Caps how many PDF exports render at once. Each one drives a real Chromium
// tab (context) through a full page load + render, which is real CPU/memory
// - with no cap, a burst of exports (e.g. many admins pulling result sheets
// right after a result gets published) could spin up dozens of these
// simultaneously and take the whole server down with them, not just PDF
// export. Anything beyond the cap simply waits its turn (see acquire()
// below) instead of starting immediately - a few extra seconds of queueing
// is a far better failure mode than an OOM crash.
const MAX_CONCURRENT_EXPORTS = 3;

class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(limit: number) {
    this.available = limit;
  }

  acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.available += 1;
  }
}

// Matches PAPER_SIZE_MM in frontend/src/components/common/DataExportPrintActions.tsx -
// keep the two in sync if either changes.
const PAPER_SIZE_MM: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
};

export type ExportReportPdfParams = {
  userId: number;
  madrasaId: number;
  roleId: number;
  role: string;
  madrasaSlug: string;
  reportsPage: string;
  reportKey: string;
  filters: Record<string, string | undefined>;
  paperSize: PaperSize;
  orientation: Orientation;
};

// Renders the report through a real (headless) browser instead of
// rasterizing it client-side (see the old html2canvas path this replaces in
// DataExportPrintActions.tsx) - complex Bangla script (matra reordering,
// conjunct shaping, synthetic bold) only renders correctly through the
// browser's own text engine, which is exactly what this uses: it navigates
// a headless Chromium to the same report preview, and asks Chromium itself
// (via page.pdf()) to print it, rather than approximating the render in a
// <canvas>.
export class ReportExportService {
  // Reused across requests instead of a fresh `chromium.launch()` each time
  // - a cold Chromium launch was consistently the single largest chunk of
  // "PDF export timing"'s launchMs (often 1-2s, sometimes more under load),
  // and every request needs its own isolated `context`/`page` anyway (that's
  // what actually carries the per-user auth state below), not its own
  // browser process. `getBrowser()` launches once, lazily, and every
  // request afterward just opens/closes a context on the shared instance.
  private browserPromise: Promise<Browser> | null = null;
  private readonly slots = new Semaphore(MAX_CONCURRENT_EXPORTS);

  private async getBrowser(): Promise<Browser> {
    if (this.browserPromise) {
      const existing = await this.browserPromise;
      if (existing.isConnected()) return existing;
      this.browserPromise = null; // crashed/closed - relaunch below
    }
    this.browserPromise = chromium.launch({ headless: true });
    return this.browserPromise;
  }

  async generatePdf(params: ExportReportPdfParams): Promise<Buffer> {
    if (!config.app.internalFrontendUrl) {
      throw new ApiError(
        "PDF export is not configured (FRONTEND_BASE_URL is unset on the server)",
        500,
      );
    }

    // Short-lived - this token only exists to let the headless browser load
    // data as the requesting user for the few seconds it takes to render,
    // never leaves the server process, and is never placed in a URL.
    const token = generateToken(
      { id: params.userId, madrasa_id: params.madrasaId, role_id: params.roleId, role: params.role },
      "2m",
    );

    // Stage timings, logged once at the end - rendering+paginating a large
    // multi-page report can add up past what seems reasonable at a glance,
    // and without this the only symptom visible from the frontend is "it
    // timed out somewhere in there" (see the 120s client-side timeout in
    // DataExportPrintActions.tsx). Findable in the logs the next time a
    // report is slow enough to matter.
    const startedAt = Date.now();
    await this.slots.acquire();
    const acquiredAt = Date.now();

    // Tracked separately from the try/catch so a failure's log line and
    // thrown message can say exactly which step never finished, instead of
    // a single generic "Failed to generate PDF" no matter where it broke -
    // "navigate" timing out means the headless browser couldn't reach
    // internalFrontendUrl at all (an infra/network problem), while
    // "render-wait" timing out means the page loaded fine but the report's
    // own data never became ready (an app/API problem) - very different
    // fixes, and previously indistinguishable from the client's 500 alone.
    let stage: "launch" | "navigate" | "render-wait" | "pdf" = "launch";
    let context: Awaited<ReturnType<Browser["newContext"]>> | undefined;
    try {
      const browser = await this.getBrowser();
      const launchedAt = Date.now();
      context = await browser.newContext();

      const authState = {
        state: {
          token,
          user: { id: params.userId, madrasa_id: params.madrasaId, role: params.role, role_key: params.role },
          permissions: [],
          modules: [],
        },
        version: 0,
      };
      // The print page's own API calls are baked at build time to the
      // public API domain (Vite env vars are compile-time), which would
      // otherwise make this headless page call back out to the internet and
      // through the reverse proxy to reach a server it's already running
      // inside of - the same hairpin-NAT problem internalFrontendUrl exists
      // to avoid, just in the other direction. Since this Chromium instance
      // is launched by the backend process itself (see getBrowser() above),
      // its page can always reach the API via plain loopback, regardless of
      // Docker network/proxy setup - apiConfig.ts checks for this global
      // before falling back to the build-time public API URL.
      const internalApiBaseUrl = `http://127.0.0.1:${config.app.port}/api`;
      await context.addInitScript(
        ({ authState, internalApiBaseUrl }) => {
          localStorage.setItem("auth-storage", JSON.stringify(authState));
          (window as any).__INTERNAL_API_BASE__ = internalApiBaseUrl;
        },
        { authState, internalApiBaseUrl },
      );

      const page = await context.newPage();

      // internalFrontendUrl, not frontendBaseUrl - see env.ts's doc comment
      // on why this navigation must avoid the public domain when frontend
      // and backend are sibling containers on the same host.
      const url = new URL(
        `/${params.madrasaSlug}/print/reports/${params.reportsPage}`,
        config.app.internalFrontendUrl,
      );
      url.searchParams.set("key", params.reportKey);
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
      url.searchParams.set("paper_size", params.paperSize);
      url.searchParams.set("orientation", params.orientation);

      // "networkidle" (no in-flight requests for 500ms) is what was set here
      // originally, but it waits on ALL network activity, not just the
      // report's own data - it can never resolve if literally anything on
      // the page (an analytics beacon, a background poll, even a slow/stuck
      // request unrelated to the report itself) keeps a connection open,
      // which is exactly what timed out in production even once
      // internalFrontendUrl was reachable. "domcontentloaded" only needs the
      // initial HTML parsed, which is enough to move on to the explicit
      // `data-report-ready` wait below - that's what actually gates PDF
      // generation on the report's data being loaded, so networkidle was
      // never doing useful work here, only adding a way to hang.
      stage = "navigate";
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      const navigatedAt = Date.now();

      stage = "render-wait";
      await page.waitForSelector('[data-report-ready="true"]', { timeout: 60_000 });
      const readyAt = Date.now();

      stage = "pdf";
      const size = PAPER_SIZE_MM[params.paperSize];
      const pdfBuffer = await page.pdf({
        width: `${params.orientation === "landscape" ? size.height : size.width}mm`,
        height: `${params.orientation === "landscape" ? size.width : size.height}mm`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      const pdfAt = Date.now();

      logger.info("PDF export timing", {
        reportsPage: params.reportsPage,
        reportKey: params.reportKey,
        // Time spent waiting for a free slot under MAX_CONCURRENT_EXPORTS -
        // 0 outside of a concurrent burst, rising under load instead of the
        // request just piling more CPU/memory onto an already-busy server.
        queueMs: acquiredAt - startedAt,
        launchMs: launchedAt - acquiredAt,
        navigateMs: navigatedAt - launchedAt,
        renderWaitMs: readyAt - navigatedAt,
        pdfMs: pdfAt - readyAt,
        totalMs: pdfAt - startedAt,
      });

      return pdfBuffer;
    } catch (error) {
      logger.error("PDF export failed", {
        stage,
        reportsPage: params.reportsPage,
        reportKey: params.reportKey,
        internalFrontendUrl: config.app.internalFrontendUrl,
        error,
      });
      const stageMessage: Record<typeof stage, string> = {
        launch: "PDF export failed: could not start the headless browser",
        navigate:
          "PDF export failed: could not reach the report page (internalFrontendUrl unreachable - check its value and that the frontend container is up)",
        "render-wait":
          "PDF export failed: the report page loaded but never finished loading its data (check the API base the print page is calling)",
        pdf: "PDF export failed: could not render the loaded page to PDF",
      };
      throw new ApiError(stageMessage[stage], 500);
    } finally {
      // Only the context - the browser itself is shared, see getBrowser().
      await context?.close();
      this.slots.release();
    }
  }
}

export const reportExportService = new ReportExportService();
