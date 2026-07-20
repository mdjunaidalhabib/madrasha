import { useMemo } from "react";
import { ReportMenuItem } from "../../features/reports/types";
import { PaperSize, Orientation } from "../common/DataExportPrintActions";
import { ReportBrandHeader, ReportWatermark } from "./ReportBranding";
import ReportContent from "./ReportContent";
import { cellValue } from "../../utils/reportUtils";

type PageChunk = {
  key: string;
  rows: Record<string, any>[];
  startIndex: number;
};

type PaginatedReportPreviewProps = {
  loading: boolean;
  report: ReportMenuItem;
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  hideBrandHeader?: boolean;
  paperSize: PaperSize;
  orientation: Orientation;
};

const chunkRows = (
  rows: Record<string, any>[],
  capacity: number,
  keyPrefix: string,
): PageChunk[] => {
  if (!rows.length) return [{ key: `${keyPrefix}-empty`, rows: [], startIndex: 0 }];

  const pages: PageChunk[] = [];
  for (let index = 0; index < rows.length; index += capacity) {
    pages.push({
      key: `${keyPrefix}-${index}`,
      rows: rows.slice(index, index + capacity),
      startIndex: index,
    });
  }
  return pages;
};

const getCapacity = (report: ReportMenuItem, paperSize: PaperSize, orientation: Orientation) => {
  const mode = `${paperSize}-${orientation}`;
  const printable = report.printable || "table";

  if (["marksheet", "certificate", "testimonial", "transfer-letter"].includes(printable)) {
    return 1;
  }

  if (printable === "id-card") {
    return { "a4-portrait": 6, "a4-landscape": 6, "a5-portrait": 2, "a5-landscape": 4 }[mode] || 6;
  }

  if (printable === "admit-card") {
    return { "a4-portrait": 4, "a4-landscape": 2, "a5-portrait": 1, "a5-landscape": 2 }[mode] || 4;
  }

  if (["attendance-register", "daily-attendance-register"].includes(printable)) {
    return (
      { "a4-portrait": 24, "a4-landscape": 13, "a5-portrait": 13, "a5-landscape": 7 }[mode] || 24
    );
  }

  if (["student-admission-list", "guardian-phone-list"].includes(printable)) {
    return (
      { "a4-portrait": 18, "a4-landscape": 12, "a5-portrait": 9, "a5-landscape": 6 }[mode] || 18
    );
  }

  if (printable === "exam-signature-sheet") {
    return (
      { "a4-portrait": 19, "a4-landscape": 12, "a5-portrait": 9, "a5-landscape": 6 }[mode] || 19
    );
  }

  if (printable === "exam-number-sheet") {
    return (
      { "a4-portrait": 18, "a4-landscape": 14, "a5-portrait": 8, "a5-landscape": 7 }[mode] || 14
    );
  }

  if (printable === "academic-result") {
    return (
      { "a4-portrait": 15, "a4-landscape": 10, "a5-portrait": 7, "a5-landscape": 5 }[mode] || 15
    );
  }

  if (
    [
      "result-notice",
      "digital-attendance",
      "class-routine",
      "teacher-list",
      "teacher-phone-list",
    ].includes(printable)
  ) {
    return (
      { "a4-portrait": 18, "a4-landscape": 11, "a5-portrait": 9, "a5-landscape": 6 }[mode] || 18
    );
  }

  return { "a4-portrait": 15, "a4-landscape": 9, "a5-portrait": 8, "a5-landscape": 5 }[mode] || 15;
};

const groupRowsForPagination = (report: ReportMenuItem, rows: Record<string, any>[]) => {
  if (report.printable === "result-notice") {
    return Object.values(
      rows.reduce<Record<string, Record<string, any>[]>>((acc, row) => {
        const key = [
          cellValue(row, "exam_name"),
          cellValue(row, "class_name"),
          cellValue(row, "exam_year"),
        ].join("|");
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {}),
    );
  }

  if (
    report.printable === "attendance-register" ||
    report.printable === "daily-attendance-register" ||
    report.printable === "student-admission-list" ||
    report.printable === "guardian-phone-list" ||
    report.printable === "academic-result" ||
    report.printable === "class-routine" ||
    report.printable === "exam-signature-sheet" ||
    report.printable === "exam-number-sheet"
  ) {
    return Object.values(
      rows.reduce<Record<string, Record<string, any>[]>>((acc, row) => {
        const division =
          cellValue(row, "division_name") || cellValue(row, "division_name_bn") || "সকল বিভাগ";
        const className =
          cellValue(row, "class_name") || cellValue(row, "class_name_bn") || "সকল শ্রেণি";
        const academicYear =
          cellValue(row, "academic_year") || cellValue(row, "exam_year") || "সকল শিক্ষাবর্ষ";
        const examName =
          report.printable === "exam-signature-sheet" ||
          report.printable === "exam-number-sheet" ||
          report.printable === "academic-result"
            ? cellValue(row, "exam_name") || "পরীক্ষা"
            : "";
        const key = `${division}|${className}|${academicYear}|${examName}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {}),
    );
  }

  return [rows];
};

const PaginatedReportPreview = ({
  loading,
  report,
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  hideBrandHeader = false,
  paperSize,
  orientation,
}: PaginatedReportPreviewProps) => {
  const pages = useMemo(() => {
    if (loading || !rows.length) {
      return [{ key: `${report.key}-status`, rows: [], startIndex: 0 }];
    }

    const capacity = getCapacity(report, paperSize, orientation);
    const groups = groupRowsForPagination(report, rows);
    const output: PageChunk[] = [];
    let globalStartIndex = 0;

    groups.forEach((group, groupIndex) => {
      const groupPages = chunkRows(group, capacity, `${report.key}-group-${groupIndex}`);
      groupPages.forEach((page) => {
        output.push({
          ...page,
          startIndex: globalStartIndex + page.startIndex,
        });
      });
      globalStartIndex += group.length;
    });

    return output.length ? output : [{ key: `${report.key}-empty`, rows: [], startIndex: 0 }];
  }, [loading, orientation, paperSize, report, rows]);

  return (
    <div className="print-area print-pages">
      {pages.map((page, pageIndex) => (
        <section
          key={page.key}
          className="print-page-preview report-print-page bg-white"
          data-page-number={pageIndex + 1}
          data-total-pages={pages.length}
        >
          <ReportWatermark />
          {!hideBrandHeader && <ReportBrandHeader />}
          <div className="report-content-body">
            <ReportContent
              loading={loading}
              report={report}
              rows={page.rows}
              selectedDivisionName={selectedDivisionName}
              selectedClassName={selectedClassName}
              startIndex={page.startIndex}
            />
          </div>
        </section>
      ))}
    </div>
  );
};

export default PaginatedReportPreview;
