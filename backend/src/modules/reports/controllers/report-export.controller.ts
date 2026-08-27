import { Request, Response } from "express";
import { requireTenant } from "../reports.response";
import { reportExportService } from "./report-export.service";
import { BadRequestError } from "../../../shared/errors";

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

  // `inline`, not `attachment` - this response is fetched via XHR/fetch
  // (responseType: "blob" in DataExportPrintActions.tsx) and turned into a
  // download client-side through an `<a download>` click on an object URL.
  // Chromium treats any response carrying `Content-Disposition: attachment`
  // as a browser-level download regardless of how it was requested, which
  // hijacks the bytes into the download manager before they ever reach the
  // page's fetch/XHR promise - the promise then never resolves or rejects,
  // even though the server finished successfully. `inline` keeps the file
  // name hint (harmless, ignored for XHR) without triggering that behavior.
  const fileName = String(req.body?.file_name || "report").replace(/[^a-zA-Z0-9_-]/g, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}.pdf"`);
  res.send(pdfBuffer);
};
