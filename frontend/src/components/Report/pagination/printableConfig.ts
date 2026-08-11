import { ReportMenuItem } from "../../../features/reports/types";
import { cellValue } from "../../../utils/reportUtils";

export type PrintableKind = "table" | "grid" | "blocks";

export type PrintableConfig = {
  kind: PrintableKind;
  // Whether the group's heading/thead repeat-on-page-1-only block exists at
  // all - types with no heading (e.g. the default ReportTable) skip the
  // isFirstPage/heading-height measurement entirely.
  hasHeading: boolean;
  // Whether a footer/signature block should render on the last page only.
  hasFooter: boolean;
  // Group key builder: rows sharing the same key paginate together and
  // start a fresh first page. Returning a constant means "one flat group".
  getGroupKey: (row: Record<string, any>) => string;
  // exam-signature-number-sheet-2col only: physical pages render this many
  // logical column-pages side by side. Each column is still paginated
  // exactly like a normal single page with its own height budget, so a new
  // group (class/subject) always starts a fresh column - it never shares a
  // column with the previous group's leftover space.
  columnsPerPage?: 2;
};

const noGrouping = () => "__all__";

const examContextGroupKey = (extraExamName: boolean) => (row: Record<string, any>) => {
  const division = cellValue(row, "division_name") || cellValue(row, "division_name_bn") || "সকল বিভাগ";
  const className = cellValue(row, "class_name") || cellValue(row, "class_name_bn") || "সকল শ্রেণি";
  const academicYear = cellValue(row, "academic_year") || cellValue(row, "exam_year") || "সকল শিক্ষাবর্ষ";
  const examName = extraExamName ? cellValue(row, "exam_name") || "পরীক্ষা" : "";
  return `${division}|${className}|${academicYear}|${examName}`;
};

export const getPrintableConfig = (report: ReportMenuItem): PrintableConfig => {
  const printable = report.printable || "table";

  if (printable === "result-notice") {
    return {
      kind: "table",
      hasHeading: true,
      hasFooter: true,
      getGroupKey: (row) =>
        [cellValue(row, "exam_name"), cellValue(row, "class_name"), cellValue(row, "exam_year")].join("|"),
    };
  }

  if (printable === "attendance-register" || printable === "daily-attendance-register") {
    return { kind: "table", hasHeading: true, hasFooter: false, getGroupKey: examContextGroupKey(false) };
  }

  if (printable === "student-admission-list" || printable === "guardian-phone-list") {
    return { kind: "table", hasHeading: true, hasFooter: false, getGroupKey: examContextGroupKey(false) };
  }

  if (printable === "academic-result") {
    return { kind: "table", hasHeading: true, hasFooter: true, getGroupKey: examContextGroupKey(true) };
  }

  if (printable === "class-routine") {
    return { kind: "table", hasHeading: true, hasFooter: false, getGroupKey: examContextGroupKey(false) };
  }

  if (printable === "exam-signature-sheet" || printable === "exam-number-sheet") {
    return { kind: "table", hasHeading: true, hasFooter: true, getGroupKey: examContextGroupKey(true) };
  }

  if (printable === "exam-signature-number-sheet" || printable === "exam-signature-number-sheet-2col") {
    // One extra grouping level on top of the usual exam context: rows are
    // pre-expanded to one-row-per-student-per-subject (see
    // expandRowsBySubject in PaginatedReportPreview), so folding the subject
    // name into the group key gives each subject its own heading + table +
    // pagination, exactly like a fresh exam context would.
    return {
      kind: "table",
      hasHeading: true,
      hasFooter: true,
      getGroupKey: (row) => `${examContextGroupKey(true)(row)}|${row.__subject_name || ""}`,
      columnsPerPage: printable === "exam-signature-number-sheet-2col" ? 2 : undefined,
    };
  }

  if (printable === "digital-attendance") {
    return { kind: "table", hasHeading: true, hasFooter: false, getGroupKey: noGrouping };
  }

  if (printable === "teacher-list" || printable === "teacher-phone-list") {
    return { kind: "table", hasHeading: true, hasFooter: false, getGroupKey: noGrouping };
  }

  if (printable === "id-card" || printable === "admit-card" || printable === "book-label") {
    return { kind: "grid", hasHeading: false, hasFooter: false, getGroupKey: noGrouping };
  }

  if (
    printable === "marksheet" ||
    printable === "certificate" ||
    printable === "testimonial" ||
    printable === "transfer-letter"
  ) {
    return { kind: "blocks", hasHeading: true, hasFooter: true, getGroupKey: noGrouping };
  }

  // Default fallback ("table" / anything unrecognized): plain flat table,
  // no heading/footer block to gate.
  return { kind: "table", hasHeading: false, hasFooter: false, getGroupKey: noGrouping };
};
