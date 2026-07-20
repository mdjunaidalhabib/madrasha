import type { ReportColumn } from "../../../features/reports/types";
import { cellValue } from "../../../utils/reportUtils";

/**
 * Single source of truth for the academic-result table headers.
 * Change a `header` here and the on-screen table, print preview and exports
 * will all use the same text.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const ACADEMIC_RESULT_COLUMNS: ReportColumn[] = [
  { header: "রোল নম্বর", key: "roll", className: "min-w-22 text-center" },
  { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: "min-w-28 text-center" },
  { header: "শিক্ষার্থী", key: "student_name", className: "min-w-48" },
  { header: "মোট", key: "total", className: "min-w-20 text-center" },
  { header: "গড়", key: "average", className: "min-w-20 text-center" },
  { header: "গ্রেড", key: "general_grade", className: "min-w-20 text-center" },
  { header: "মাদরাসা গ্রেড", key: "madrasa_grade", className: "min-w-28 text-center" },
  { header: "মেধাক্রম", key: "rank_no", className: "min-w-20 text-center" },
  { header: "স্ট্যাটাস", key: "status", className: "min-w-24 text-center" },
];

type AcademicResultPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  columns?: ReportColumn[];
};

type SubjectMark = {
  book_id?: number | string;
  subject_name?: string;
  mark?: number | string | null;
};

type PrintableColumn = ReportColumn & {
  subjectKey?: string;
};

const formatAverage = (row: Record<string, any>) => {
  const value = row?.average;
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : String(value);
};

const rawValue = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
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
  roll: 0.75,
  registration_no: 1.25,
  student_name: 1.8,
  class_name: 1.05,
  total: 0.75,
  average: 0.72,
  general_grade: 0.75,
  madrasa_grade: 1.05,
  rank_no: 0.82,
  status: 0.9,
};

const getColumnWeight = (column: PrintableColumn) =>
  column.subjectKey ? 0.82 : COLUMN_WEIGHTS[column.key] || 1;

const AcademicResultPrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  columns = ACADEMIC_RESULT_COLUMNS,
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

  const subjectMap = new Map<string, { key: string; name: string }>();
  rows.forEach((row) => {
    getSubjects(row).forEach((subject, index) => {
      const key = getSubjectKey(subject, index);
      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          key,
          name: subject.subject_name || `বিষয় ${index + 1}`,
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

  const getMark = (row: Record<string, any>, subjectKey: string) => {
    const subject = getSubjects(row).find(
      (item, index) => getSubjectKey(item, index) === subjectKey,
    );
    const mark = subject?.mark;
    return mark === null || mark === undefined || mark === "" ? "—" : String(mark);
  };

  const getValue = (row: Record<string, any>, column: PrintableColumn) => {
    if (column.subjectKey) return getMark(row, column.subjectKey);
    if (column.key === "average") return formatAverage(row);
    if (column.key === "class_name") {
      return cellValue(row, "class_name") || cellValue(row, "class_name_bn");
    }
    return cellValue(row, column.key);
  };

  return (
    <div className="academic-result-report mx-auto w-full bg-white text-black">
      <h1 className="academic-result-title mb-3 text-center text-xl font-bold">একাডেমিক ফলাফল</h1>

      <div className="academic-result-meta mb-3 grid grid-cols-4 border-l border-t border-black text-[12px]">
        <div className="flex min-h-9 items-center border-b border-r border-black px-2">
          <b className="mr-1">বিভাগ:</b> {divisionName}
        </div>
        <div className="flex min-h-9 items-center border-b border-r border-black px-2">
          <b className="mr-1">শ্রেণি:</b> {className}
        </div>
        <div className="flex min-h-9 items-center border-b border-r border-black px-2">
          <b className="mr-1">পরীক্ষা:</b> {examName}
        </div>
        <div className="flex min-h-9 items-center border-b border-r border-black px-2">
          <b className="mr-1">শিক্ষাবর্ষ:</b> {examYear}
        </div>
      </div>

      <table
        className="academic-result-table report-responsive-table w-full table-fixed border-collapse border border-black text-center"
        style={{
          fontSize: `${Math.max(14, Math.min(18, 20 - printableColumns.length * 0.35))}px`,
        }}
      >
        <colgroup>
          {printableColumns.map((column) => (
            <col
              key={`academic-col-${column.key}`}
              style={{ width: `${(getColumnWeight(column) / totalWeight) * 100}%` }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {printableColumns.map((column) => (
              <th
                key={`academic-header-${column.key}`}
                className="border border-black px-1 py-2 leading-tight"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`academic-result-${row.result_master_id || "result"}-${row.student_id || row.id || index}`}
            >
              {printableColumns.map((column) => (
                <td
                  key={`academic-value-${row.student_id || row.id || index}-${column.key}`}
                  className={`h-9 border border-black px-1 ${
                    column.key === "student_name" ? "text-left font-semibold" : "text-center"
                  } ${column.subjectKey ? "font-semibold" : ""}`}
                >
                  {getValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AcademicResultPrint;
