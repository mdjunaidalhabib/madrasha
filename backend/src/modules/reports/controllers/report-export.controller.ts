import { Request, Response } from "express";
import { requireTenant } from "../reports.response";
import { reportExportService } from "./report-export.service";
import { storePdf, takePdf } from "./report-export.store";
import { BadRequestError, NotFoundError } from "../../../shared/errors";

const ALLOWED_REPORTS_PAGES = ["academic", "student", "exam", "teacher", "documents"];
const ALLOWED_PAPER_SIZES = ["a4", "a5"];
const ALLOWED_ORIENTATIONS = ["portrait", "landscape"];

// Whatever extra filter keys a report might carry (exam_id, division_id,
// class_id, subject, template_id, ...) - passed straight through as query
// params to the print route, which already knows how to read each of them
// (see ReportShell's printMode hydration). Kept as a flat string map instead
// of individually validating each field so new filter types don't need a
// change here too.
const getFilters = (body: Record<string, unknown>): Record<string, string | undefined> => {
  const { reports_page, report_key, paper_size, orientation, file_name, ...rest } = body;
  const filters: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null || value === "") continue;
    filters[key] = String(value);
  }
  return filters;
};

export const exportReportPdf = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  const user = req.user;
  const slug = req.tenant?.slug;
  if (!user || !slug) {
    throw new BadRequestError("Missing user or tenant context");
  }

  const reportsPage = String(req.body?.reports_page || "");
  const reportKey = String(req.body?.report_key || "");
  const paperSize = String(req.body?.paper_size || "a4");
  const orientation = String(req.body?.orientation || "portrait");

  if (!ALLOWED_REPORTS_PAGES.includes(reportsPage)) {
    throw new BadRequestError("Invalid reports_page");
  }
  if (!reportKey) {
    throw new BadRequestError("report_key is required");
  }
  if (!ALLOWED_PAPER_SIZES.includes(paperSize)) {
    throw new BadRequestError("Invalid paper_size");
  }
  if (!ALLOWED_ORIENTATIONS.includes(orientation)) {
    throw new BadRequestError("Invalid orientation");
  }

  const pdfBuffer = await reportExportService.generatePdf({
    userId: user.id,
    madrasaId,
    roleId: user.role_id,
    role: user.role || "",
    madrasaSlug: slug,
    reportsPage,
    reportKey,
    filters: getFilters(req.body || {}),
    paperSize: paperSize as "a4" | "a5",
    orientation: orientation as "portrait" | "landscape",
  });

  // Handed back as a short-lived download id, not the PDF bytes directly -
  // see report-export.store.ts for why: a download manager like IDM can't
  // follow up on a `blob:` URL, so the actual bytes are fetched next via a
  // real, re-fetchable GET (downloadReportPdf below) that both the browser's
  // native download handling and third-party download managers understand.
  const fileName = String(req.body?.file_name || "report").replace(/[^a-zA-Z0-9_-]/g, "_");
  const downloadId = storePdf(pdfBuffer, fileName);
  res.json({ downloadId });
};

// No auth middleware runs ahead of this route (see core/router.ts) - a
// plain browser-triggered download can't carry an Authorization header.
// Security instead comes from the id itself: a 24-byte random token,
// expiring after 2 minutes (report-export.store.ts).
export const downloadReportPdf = (req: Request, res: Response) => {
  const entry = takePdf(String(req.params.downloadId || ""));
  if (!entry) {
    throw new NotFoundError("This download link has expired - please generate the PDF again");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${entry.fileName}.pdf"`);
  res.send(entry.buffer);
};
