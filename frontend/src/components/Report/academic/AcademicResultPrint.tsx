import { useMemo, type CSSProperties } from "react";
import type { ReportColumn } from "../../../features/reports/types";
import {
  cellValue,
  formatMeritRank,
  formatReportValue,
  toBanglaDigits,
} from "../../../utils/reportUtils";

// eslint-disable-next-line react-refresh/only-export-components
export const ACADEMIC_RESULT_COLUMNS: ReportColumn[] = [
  { header: "রোল নম্বর", key: "roll", className: "min-w-24 text-center" },
  { header: "রেজিঃ নম্বর", key: "registration_no", className: "min-w-28 text-center" },
  { header: "শিক্ষার্থীর নাম", key: "student_name", className: "min-w-48" },
  { header: "মোট", key: "total", className: "min-w-20 text-center" },
  { header: "গড়", key: "average", className: "min-w-20 text-center" },
  { header: "গ্রেড", key: "madrasa_grade", className: "min-w-28 text-center" },
  // Zero-width space between মেধা and ক্রম gives the browser a clean wrap
  // point (matching রোল/নম্বর's natural space-driven wrap) instead of
  // letting overflow-wrap: anywhere pick an arbitrary mid-syllable break
  // when the column is too narrow for one line.
  { header: "মেধা​ক্রম", key: "rank_no", className: "min-w-24 text-center" },
];

type AcademicResultPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  columns?: ReportColumn[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
};

type SubjectMark = {
  book_id?: number | string;
  subject_name?: string;
  is_miyari?: boolean;
  mark?: number | string | null;
  is_absent?: boolean;
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
  madrasa_grade: 1.55,
  rank_no: 1.35,
  status: 0.9,
};

const NUMERIC_COLUMN_KEYS = new Set(["roll", "registration_no", "total", "average", "rank_no"]);

const getColumnWeight = (column: PrintableColumn) =>
  column.subjectKey ? 0.66 : COLUMN_WEIGHTS[column.key] || 1;

const isNumericColumn = (column: PrintableColumn) =>
  Boolean(column.subjectKey) || NUMERIC_COLUMN_KEYS.has(column.key);

// Matches the font/weight/size the rotated subject-name span renders with
// (see .academic-result-subject-name in index.css) so the measured width
// reflects what actually gets painted, not a generic system font guess.
const SUBJECT_NAME_FONT = '800 16px Kalpurush, "Hind Siliguri", "Noto Sans Bengali", sans-serif';
const SUBJECT_NAME_MIN_WIDTH = 60;
const SUBJECT_NAME_MAX_WIDTH = 200;

let measureContext: CanvasRenderingContext2D | null | undefined;
const getMeasureContext = () => {
  if (measureContext === undefined) {
    measureContext =
      typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  }
  return measureContext;
};

// The subject-name header box is sized to the longest subject name actually
// present in THIS report (clamped), not a fixed guess - so a report with only
// short names stays compact and one with a long kitab name grows to fit it
// instead of clipping.
const getSubjectNameBoxWidth = (headers: string[]) => {
  const ctx = getMeasureContext();
  if (!ctx) return SUBJECT_NAME_MIN_WIDTH;
  ctx.font = SUBJECT_NAME_FONT;
  const longest = headers.reduce((max, header) => Math.max(max, ctx.measureText(header).width), 0);
  const withPadding = Math.ceil(longest) + 6;
  return Math.min(SUBJECT_NAME_MAX_WIDTH, Math.max(SUBJECT_NAME_MIN_WIDTH, withPadding));
};

const AcademicResultPrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  columns = ACADEMIC_RESULT_COLUMNS,
  isFirstPage = true,
  isLastPage = true,
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
  const examNameWithYear = `${examName} - ${examYear}`;
  const contextLine = `জামাতঃ ${className}`;
  const madrasaName = rawValue(firstRow, [
    "madrasa_name",
    "institute_name",
    "institution_name",
    "madrasah_name",
  ]);
  const madrasaAddress = rawValue(firstRow, [
    "madrasa_address",
    "institute_address",
    "institution_address",
    "madrasah_address",
    "address",
  ]);

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

  const subjectHeaderKey = subjectColumns.map((column) => column.header).join("|");
  const subjectNameBoxWidth = useMemo(
    () => getSubjectNameBoxWidth(subjectColumns.map((column) => column.header)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjectHeaderKey],
  );

  const getMark = (row: Record<string, any>, subjectKey: string) => {
    const subject = getSubjects(row).find(
      (item, index) => getSubjectKey(item, index) === subjectKey,
    );
    if (!subject) return "—";
    if (subject.is_absent) return "অনু";
    const mark = subject.mark;
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
      <div>
        {isFirstPage && (
          <div className="academic-result-heading report-block-heading my-6 text-center">
            {madrasaName && (
              <h1 className="academic-result-madrasa-name text-2xl font-extrabold tracking-tight text-black">
                {madrasaName}
              </h1>
            )}
            {madrasaAddress && (
              <p className="academic-result-madrasa-address mt-1 text-base font-medium text-black">
                {madrasaAddress}
              </p>
            )}
            <h2
              className={`academic-result-title font-extrabold tracking-tight text-black ${
                madrasaName ? "mt-2 text-xl" : "text-2xl"
              }`}
            >
              ফলাফল পত্র
            </h2>
            <p className="academic-result-exam-name mt-1 text-base font-bold text-black">
              {examNameWithYear}
            </p>
            <p className="academic-result-subtitle text-base font-bold text-black">{contextLine}</p>
          </div>
        )}

        <table
          className={`academic-result-table report-responsive-table w-full table-fixed border-collapse border border-black text-center text-black ${
            isFirstPage ? "" : "mt-6"
          }`}
          style={{ "--subject-name-max-width": `${subjectNameBoxWidth}px` } as CSSProperties}
        >
          <colgroup>
            {printableColumns.map((column) => (
              <col
                key={`academic-col-${column.key}`}
                style={{ width: `${(getColumnWeight(column) / totalWeight) * 100}%` }}
              />
            ))}
          </colgroup>
          {isFirstPage && (
            <thead>
              <tr className="academic-result-header-main-row">
                {printableColumns.map((column) =>
                  column.subjectKey ? (
                    <th
                      key={`academic-subject-serial-${column.key}`}
                      className="academic-result-subject-serial border border-black text-base text-black"
                      title={`বিষয় ${subjectSerialMap.get(column.key) || ""}`}
                    >
                      {subjectSerialMap.get(column.key)}
                    </th>
                  ) : (
                    <th
                      key={`academic-header-${column.key}`}
                      rowSpan={subjectColumns.length ? 2 : 1}
                      className={`academic-result-standard-header border border-black px-0.5 py-1 text-base font-bold leading-tight text-center text-black ${
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
                      className="academic-result-subject-name-cell border border-black p-0 align-middle text-black"
                      title={column.header}
                    >
                      <div className="flex h-full items-center justify-center overflow-hidden">
                        <span className="academic-result-subject-name inline-block origin-center -rotate-90 whitespace-nowrap text-base leading-none text-black">
                          {column.header}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              )}
            </thead>
          )}
          <tbody>
            {rows.map((row, index) => {
              const rowStatus = String(row?.status || "").toUpperCase();
              const failed = rowStatus === "FAIL";
              const isAbsentRow = rowStatus === "ABSENT";
              const rankValue = Number(row?.rank_no);
              const isTopRankRow = Number.isInteger(rankValue) && rankValue >= 1 && rankValue <= 3;
              const rowClass = [
                failed ? "academic-result-fail-row" : "",
                isAbsentRow ? "academic-result-absent-row" : "",
                isTopRankRow ? "academic-result-top-rank-row" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr
                  key={`academic-result-${row.result_master_id || "result"}-${row.student_id || row.id || index}`}
                  className={rowClass}
                >
                  {printableColumns.map((column) => {
                    const numericColumn = isNumericColumn(column);
                    const columnClass = [
                      column.key === "student_name"
                        ? "academic-result-student-name text-left font-semibold"
                        : "",
                      column.key === "rank_no" ? "academic-result-rank-cell font-bold" : "",
                      column.key === "total"
                        ? "academic-result-total-cell text-base font-semibold"
                        : "",
                      column.key === "average"
                        ? "academic-result-average-cell text-base font-semibold"
                        : "",
                      numericColumn ? "academic-result-number-cell" : "",
                      column.subjectKey ? "font-semibold" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <td
                        key={`academic-value-${row.student_id || row.id || index}-${column.key}`}
                        className={`border border-black text-base text-center text-black ${columnClass}`}
                      >
                        {column.key === "rank_no" ? (
                          <span className="academic-result-rank-value text-base font-semibold text-black">
                            {getValue(row, column)}
                          </span>
                        ) : numericColumn ? (
                          <span className="academic-result-number-value text-base font-semibold text-black">
                            {getValue(row, column)}
                          </span>
                        ) : column.key === "madrasa_grade" ? (
                          <span className="academic-result-grade-value whitespace-nowrap text-base font-semibold text-black">
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
      </div>

      {isLastPage && (
        <div className="academic-result-signature report-block-signature flex justify-end">
          <div className="w-fit border-t border-black px-4 pt-0.5 text-center text-base font-medium text-black">
            মুহতামিমের স্বাক্ষর
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicResultPrint;
