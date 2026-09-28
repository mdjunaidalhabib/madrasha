import type { ReportColumn } from "../../../features/reports/types";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { printCell, printMeritRank } from "../printFormat";
import { useIsMadrasa, usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText, type ReportText } from "../report.text";

/**
 * Single source of truth for result-notice table headers.
 * Editing a `header` here updates the preview, print and exported file.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const buildResultNoticeColumns = (t: Pick<ReportText, "col">): ReportColumn[] => [
  { header: t.col.rollNo, key: "roll", className: "min-w-24 text-center" },
  { header: t.col.regNo, key: "registration_no", className: "min-w-28 text-center" },
  { header: t.col.studentName, key: "student_name", className: "min-w-48" },
  { header: t.col.total, key: "total", className: "min-w-20 text-center" },
  { header: t.col.average, key: "average", className: "min-w-20 text-center" },
  { header: t.col.grade, key: "madrasa_grade", className: "min-w-28 text-center" },
  { header: " Grade", key: "general_grade", className: "min-w-20 text-center" },
  { header: t.col.rank, key: "rank_no", className: "min-w-20 text-center" },
  { header: t.col.status, key: "status", className: "min-w-24 text-center" },
];

type ResultNoticeListProps = {
  rows: Record<string, any>[];
  startIndex?: number;
  columns?: ReportColumn[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
};

const COLUMN_WEIGHTS: Record<string, number> = {
  roll: 0.72,
  registration_no: 1.25,
  student_name: 1.85,
  class_name: 1.05,
  total: 0.72,
  average: 0.72,
  general_grade: 0.75,
  rank_no: 1.0,
  status: 0.9,
};

const getColumnWeight = (key: string) => COLUMN_WEIGHTS[key] || 1;

const formatCellValue = (row: Record<string, any>, key: string) => {
  if (key === "average") {
    const value = row?.average;
    if (value === null || value === undefined || value === "") return "—";
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? toBanglaDigits(numberValue.toFixed(2)) : toBanglaDigits(String(value));
  }

  if (key === "class_name") {
    return printCell(row, "class_name") || printCell(row, "class_name_bn");
  }

  if (key === "rank_no") return printMeritRank(row?.rank_no);

  return printCell(row, key);
};

const ResultNoticeList = ({
  rows,
  startIndex = 0,
  columns = [],
  isFirstPage = true,
  isLastPage = true,
}: ResultNoticeListProps) => {
  const t = usePrintText(reportText);
  const isMadrasa = useIsMadrasa();
  // মাদরাসা গ্রেড (মুমতাজ...) কলাম শুধু মাদরাসায় - অন্য প্রতিষ্ঠানে শুধু প্রদর্শন থেকে বাদ।
  const configuredColumns = (columns.length ? columns : buildResultNoticeColumns(t)).filter(
    (column) => isMadrasa || column.key !== "madrasa_grade",
  );
  const totalWeight = configuredColumns.reduce(
    (sum, column) => sum + getColumnWeight(column.key),
    0,
  );

  const firstRow = rows[0] || {};
  const examName = printCell(firstRow, "exam_name");
  const examYear = printCell(firstRow, "exam_year");
  const className = formatCellValue(firstRow, "class_name");

  return (
    <div className="result-notice-report">
      {isFirstPage && (
        <div className="result-notice-heading report-block-heading mb-4 text-center">
          <h2 className="result-notice-title text-2xl font-bold">{t.title.resultSummary}</h2>
          <p className="result-notice-exam-name mt-1 text-base font-bold text-black">
            {examName} - {examYear}
          </p>
          <p className="result-notice-subtitle text-base font-bold text-black">
            {isMadrasa ? t.jamat : t.classTerm}{t.colon} {className}
          </p>
        </div>
      )}

      <table
        className={`result-notice-table report-responsive-table w-full table-fixed border-collapse text-center ${
          isFirstPage ? "" : "mt-6"
        }`}
      >
        <colgroup>
          {configuredColumns.map((column) => (
            <col
              key={`result-notice-col-${column.key}`}
              style={{ width: `${(getColumnWeight(column.key) / totalWeight) * 100}%` }}
            />
          ))}
        </colgroup>
        {isFirstPage && (
          <thead>
            <tr className="bg-slate-100">
              {configuredColumns.map((column) => (
                <th
                  key={`result-notice-header-${column.key}`}
                  className="border border-slate-500 px-2 py-2 leading-tight text-base font-bold"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, index) => {
            const rowStatus = String(row?.status || "").toUpperCase();
            const rowClass =
              rowStatus === "FAIL"
                ? "result-notice-fail-row"
                : rowStatus === "ABSENT"
                  ? "result-notice-absent-row"
                  : "";
            return (
            <tr
              key={`${row.student_id || row.id}-${startIndex + index}`}
              className={rowClass}
            >
              {configuredColumns.map((column) => (
                <td
                  key={`result-notice-value-${row.student_id || row.id || index}-${column.key}`}
                  className={`border border-slate-500 px-2 py-2 text-base ${
                    column.key === "student_name"
                      ? "result-notice-student-name text-start font-semibold"
                      : "text-center"
                  } ${column.key === "rank_no" ? "result-notice-rank-cell font-bold" : ""}`}
                >
                  {formatCellValue(row, column.key)}
                </td>
              ))}
            </tr>
            );
          })}
        </tbody>
      </table>

      {isLastPage && (
        <div className="result-notice-signature report-block-signature flex justify-end">
          <div className="w-fit border-t border-black px-4 pt-0.5 text-center text-base font-medium text-black">
            {t.sign.head}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultNoticeList;
