import { chromium } from "playwright";
import { generateToken } from "../../../shared/utils/jwt.util";
import { config } from "../../../shared/config";
import { logger } from "../../../shared/logger/logger";
import { ApiError } from "../../../shared/errors";

type PaperSize = "a4" | "a5";
type Orientation = "portrait" | "landscape";

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
  async generatePdf(params: ExportReportPdfParams): Promise<Buffer> {
    if (!config.app.frontendBaseUrl) {
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

    // Stage timings, logged once at the end - a cold Chromium launch plus
    // rendering+paginating a large multi-page report can add up past what
    // seems reasonable at a glance, and without this the only symptom
    // visible from the frontend is "it timed out somewhere in there" (see
    // the 120s client-side timeout in DataExportPrintActions.tsx). Findable
    // in the logs the next time a report is slow enough to matter.
    const startedAt = Date.now();
    const browser = await chromium.launch({ headless: true });
    const launchedAt = Date.now();

    try {
      const context = await browser.newContext();

      const authState = {
        state: {
          token,
          user: { id: params.userId, madrasa_id: params.madrasaId, role: params.role, role_key: params.role },
          permissions: [],
          modules: [],
        },
        version: 0,
      };
      await context.addInitScript((state) => {
        localStorage.setItem("auth-storage", JSON.stringify(state));
      }, authState);

      const page = await context.newPage();

      const url = new URL(
        `/${params.madrasaSlug}/print/reports/${params.reportsPage}`,
        config.app.frontendBaseUrl,
      );
      url.searchParams.set("key", params.reportKey);
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
      url.searchParams.set("paper_size", params.paperSize);
      url.searchParams.set("orientation", params.orientation);

      await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30_000 });
      const navigatedAt = Date.now();

      await page.waitForSelector('[data-report-ready="true"]', { timeout: 60_000 });
      const readyAt = Date.now();

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
        launchMs: launchedAt - startedAt,
        navigateMs: navigatedAt - launchedAt,
        renderWaitMs: readyAt - navigatedAt,
        pdfMs: pdfAt - readyAt,
        totalMs: pdfAt - startedAt,
      });

      return pdfBuffer;
    } catch (error) {
      logger.error("PDF export failed:", error);
      throw new ApiError("Failed to generate PDF", 500);
    } finally {
      await browser.close();
    }
  }
}

export const reportExportService = new ReportExportService();
