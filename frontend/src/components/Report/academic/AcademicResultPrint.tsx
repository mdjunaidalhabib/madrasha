import type { ReportColumn } from "../../../features/reports/types";
import { cellValue, formatMeritRank, formatReportValue, toBanglaDigits } from "../../../utils/reportUtils";

// eslint-disable-next-line react-refresh/only-export-components
export const ACADEMIC_RESULT_COLUMNS: ReportColumn[] = [
  { header: "রোল নম্বর", key: "roll", className: "min-w-24 text-center" },
  { header: "রেজিঃ নম্বর", key: "registration_no", className: "min-w-28 text-center" },
  { header: "শিক্ষার্থী", key: "student_name", className: "min-w-48" },
  { header: "মোট", key: "total", className: "min-w-20 text-center" },
  { header: "গড়", key: "average", className: "min-w-20 text-center" },
  { header: "গ্রেড", key: "madrasa_grade", className: "min-w-28 text-center" },
  { header: "মেধাক্রম", key: "rank_no", className: "min-w-20 text-center" },
];

type AcademicResultPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  columns?: ReportColumn[];
  showSignature?: boolean;
};

type SubjectMark = {
  book_id?: number | string;
  subject_name?: string;
  is_miyari?: boolean;
  mark?: number | string | null;
};

type PrintableColumn = ReportColumn & {
  subjectKey?: string;
};

const formatAverage = (row: Record<string, any>) => {
  const value = row?.average;
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  return Number.isFinite(num) ? toBanglaDigits(num.toFixed(2)) : formatReportValue(value);
};

const rawValue = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return formatReportValue(value, key);
  }
  return "";
};

const getSubjects = (row: Record<string, any>): SubjectMark[] => {
  const value = row?.subjects;

  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const getSubjectKey = (subject: SubjectMark, index: number) =>
  String(subject.book_id ?? subject.subject_name ?? index);

const COLUMN_WEIGHTS: Record<string, number> = {
  roll: 0.9,
  registration_no: 1.35,
  student_name: 2.1,
  class_name: 1.05,
  total: 1.05,
  average: 1.12,
  madrasa_grade: 1.05,
  rank_no: 1.05,
  status: 0.9,
};

const NUMERIC_COLUMN_KEYS = new Set([
  "roll",
  "registration_no",
  "total",
  "average",
  "rank_no",
]);

const getColumnWeight = (column: PrintableColumn) =>
  column.subjectKey ? 0.66 : COLUMN_WEIGHTS[column.key] || 1;

const isNumericColumn = (column: PrintableColumn) =>
  Boolean(column.subjectKey) || NUMERIC_COLUMN_KEYS.has(column.key);

const AcademicResultPrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  columns = ACADEMIC_RESULT_COLUMNS,
  showSignature = true,
}: AcademicResultPrintProps) => {
  const configuredColumns = columns.length ? columns : ACADEMIC_RESULT_COLUMNS;
  const firstRow = rows[0] || {};
  const divisionName =
    selectedDivisionName ||
    rawValue(firstRow, ["division_name", "division_name_bn"]) ||
    "সকল বিভাগ";
  const className =
    selectedClassName || rawValue(firstRow, ["class_name", "class_name_bn"]) || "সকল শ্রেণি";
  const examName = rawValue(firstRow, ["exam_name"]) || "সকল পরীক্ষা";
  const examYear = rawValue(firstRow, ["exam_year", "academic_year"]) || "................";
  const contextLine = `${examName} | ${className} | ${examYear}`;

  const subjectMap = new Map<string, { key: string; name: string; isMiyari: boolean }>();
  rows.forEach((row) => {
    getSubjects(row).forEach((subject, index) => {
      const key = getSubjectKey(subject, index);
      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          key,
          name: subject.subject_name || `বিষয় ${toBanglaDigits(index + 1)}`,
          isMiyari: Boolean(subject.is_miyari),
        });
      }
    });
  });

  const subjectColumns: PrintableColumn[] = Array.from(subjectMap.values()).map((subject) => ({
    key: `subject_${subject.key}`,
    header: subject.name,
    subjectKey: subject.key,
  }));

  const totalIndex = configuredColumns.findIndex((column) => column.key === "total");
  const printableColumns: PrintableColumn[] =
    totalIndex >= 0
      ? [
          ...configuredColumns.slice(0, totalIndex),
          ...subjectColumns,
          ...configuredColumns.slice(totalIndex),
        ]
      : [...configuredColumns, ...subjectColumns];

  const totalWeight = printableColumns.reduce((sum, column) => sum + getColumnWeight(column), 0);
  const subjectSerialMap = new Map(
    subjectColumns.map((column, index) => [column.key, toBanglaDigits(index + 1)]),
  );

  const getMark = (row: Record<string, any>, subjectKey: string) => {
    const subject = getSubjects(row).find(
      (item, index) => getSubjectKey(item, index) === subjectKey,
    );
    const mark = subject?.mark;
    return mark === null || mark === undefined || mark === "" ? "—" : formatReportValue(mark);
  };

  const getValue = (row: Record<string, any>, column: PrintableColumn) => {
    if (column.subjectKey) return getMark(row, column.subjectKey);
    if (column.key === "average") return formatAverage(row);
    if (column.key === "class_name") {
      return cellValue(row, "class_name") || cellValue(row, "class_name_bn");
    }
    if (column.key === "rank_no") return formatMeritRank(row?.rank_no);
    return cellValue(row, column.key);
  };

  return (
    <div className="academic-result-report mx-auto w-full bg-white text-black">
      <div className="academic-result-heading my-6 text-center">
        <h1 className="academic-result-title text-2xl font-extrabold tracking-tight">
          একাডেমিক ফলাফল
        </h1>
        <p className="academic-result-subtitle mt-1 text-sm font-semibold text-slate-600">
          {contextLine}
        </p>
      </div>


      <table className="academic-result-table report-responsive-table w-full table-fixed border-collapse border border-black text-center">
        <colgroup>
          {printableColumns.map((column) => (
            <col
              key={`academic-col-${column.key}`}
              style={{ width: `${(getColumnWeight(column) / totalWeight) * 100}%` }}
            />
          ))}
        </colgroup>
        <thead>
          <tr className="academic-result-header-main-row">
            {printableColumns.map((column) =>
              column.subjectKey ? (
                <th
                  key={`academic-subject-serial-${column.key}`}
                  className="academic-result-subject-serial border border-black"
                  title={`বিষয় ${subjectSerialMap.get(column.key) || ""}`}
                >
                  {subjectSerialMap.get(column.key)}
                </th>
              ) : (
                <th
                  key={`academic-header-${column.key}`}
                  rowSpan={subjectColumns.length ? 2 : 1}
                  className={`academic-result-standard-header border border-black px-1.5 py-2 leading-tight text-center ${
                    column.key === "rank_no" ? "academic-result-rank-header" : ""
                  } ${column.key === "student_name" ? "academic-result-student-name-header" : ""}`}
                >
                  {column.header}
                </th>
              ),
            )}
          </tr>
          {subjectColumns.length > 0 && (
            <tr className="academic-result-subject-name-row">
              {subjectColumns.map((column) => (
                <th
                  key={`academic-subject-name-${column.key}`}
                  className="academic-result-subject-name-cell h-32 border border-black p-0 align-middle"
                  title={column.header}
                >
                  <div className="flex h-full items-center justify-center overflow-hidden">
                    <span className="academic-result-subject-name inline-block origin-center -rotate-90 whitespace-nowrap leading-none">
                      {column.header}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const failed = String(row?.status || "").toUpperCase() === "FAIL";
            return (
            <tr
              key={`academic-result-${row.result_master_id || "result"}-${row.student_id || row.id || index}`}
              className={failed ? "academic-result-fail-row" : ""}
            >
              {printableColumns.map((column) => {
                const numericColumn = isNumericColumn(column);
                const columnClass = [
                  column.key === "student_name"
                    ? "academic-result-student-name text-left font-semibold"
                    : "",
                  column.key === "rank_no" ? "academic-result-rank-cell font-bold" : "",
                  column.key === "total" ? "academic-result-total-cell" : "",
                  column.key === "average" ? "academic-result-average-cell" : "",
                  numericColumn ? "academic-result-number-cell" : "",
                  column.subjectKey ? "font-semibold" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <td
                    key={`academic-value-${row.student_id || row.id || index}-${column.key}`}
                    className={`h-9 border border-black text-center ${columnClass}`}
                  >
                    {column.key === "rank_no" ? (
                      <span className="academic-result-rank-value">
                        {getValue(row, column)}
                      </span>
                    ) : numericColumn ? (
                      <span className="academic-result-number-value">
                        {getValue(row, column)}
                      </span>
                    ) : (
                      getValue(row, column)
                    )}
                  </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>

      {showSignature && (
        <div className="academic-result-signature mt-10 flex justify-end">
          <div className="min-w-44 border-t border-black pt-2 text-center text-sm font-medium">
            মুহতামিমের স্বাক্ষর ও সীল
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicResultPrint;
