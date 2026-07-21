import type { ReportColumn } from "../../../features/reports/types";
import { cellValue, formatMeritRank, toBanglaDigits } from "../../../utils/reportUtils";

/**
 * Single source of truth for result-notice table headers.
 * Editing a `header` here updates the preview, print and exported file.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const RESULT_NOTICE_COLUMNS: ReportColumn[] = [
  { header: "রোল নম্বর", key: "roll", className: "min-w-24 text-center" },
  { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: "min-w-28 text-center" },
  { header: "শিক্ষার্থী", key: "student_name", className: "min-w-48" },
  { header: "শ্রেণি", key: "class_name", className: "min-w-28" },
  { header: "মোট", key: "total", className: "min-w-20 text-center" },
  { header: "গড়", key: "average", className: "min-w-20 text-center" },
  { header: "গ্রেড", key: "general_grade", className: "min-w-20 text-center" },
  { header: "মেধাক্রম", key: "rank_no", className: "min-w-20 text-center" },
  { header: "স্ট্যাটাস", key: "status", className: "min-w-24 text-center" },
];

type ResultNoticeListProps = {
  rows: Record<string, any>[];
  startIndex?: number;
  columns?: ReportColumn[];
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
    return cellValue(row, "class_name") || cellValue(row, "class_name_bn");
  }

  if (key === "rank_no") return formatMeritRank(row?.rank_no);

  return cellValue(row, key);
};

const ResultNoticeList = ({
  rows,
  startIndex = 0,
  columns = RESULT_NOTICE_COLUMNS,
}: ResultNoticeListProps) => {
  const configuredColumns = columns.length ? columns : RESULT_NOTICE_COLUMNS;
  const totalWeight = configuredColumns.reduce(
    (sum, column) => sum + getColumnWeight(column.key),
    0,
  );

  const groups = Object.values(
    rows.reduce<Record<string, { title: string; rows: Record<string, any>[] }>>((acc, row) => {
      const title = `${cellValue(row, "exam_name")} | ${cellValue(row, "class_name")} | ${cellValue(row, "exam_year")}`;
      if (!acc[title]) acc[title] = { title, rows: [] };
      acc[title].rows.push(row);
      return acc;
    }, {}),
  );

  return (
    <div className="result-notice-report space-y-6">
      {groups.map((group, groupIndex) => (
        <section key={group.title} className={groupIndex ? "print-page-break pt-4" : ""}>
          <div className="result-notice-heading mb-4 text-center">
            <h2 className="result-notice-title text-2xl font-bold">রেজাল্ট নোটিশ</h2>
            <p className="result-notice-subtitle mt-1 text-sm font-semibold text-slate-600">
              {group.title}
            </p>
          </div>

          <table className="result-notice-table report-responsive-table w-full table-fixed border-collapse text-center text-sm">
            <colgroup>
              {configuredColumns.map((column) => (
                <col
                  key={`result-notice-col-${column.key}`}
                  style={{ width: `${(getColumnWeight(column.key) / totalWeight) * 100}%` }}
                />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-100">
                {configuredColumns.map((column) => (
                  <th
                    key={`result-notice-header-${column.key}`}
                    className="border border-slate-500 px-2 py-2 leading-tight"
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, index) => (
                <tr
                  key={`${row.student_id || row.id}-${startIndex + index}`}
                  className={String(row?.status || "").toUpperCase() === "FAIL" ? "result-notice-fail-row" : ""}
                >
                  {configuredColumns.map((column) => (
                    <td
                      key={`result-notice-value-${row.student_id || row.id || index}-${column.key}`}
                      className={`border border-slate-500 px-2 py-2 ${
                        column.key === "student_name"
                          ? "result-notice-student-name text-left font-semibold"
                          : "text-center"
                      } ${column.key === "rank_no" ? "result-notice-rank-cell font-bold" : ""}`}
                    >
                      {formatCellValue(row, column.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="result-notice-signature mt-10 text-right text-sm font-semibold">
            প্রধান শিক্ষকের স্বাক্ষর ও সীল
          </div>
        </section>
      ))}
    </div>
  );
};

export default ResultNoticeList;
