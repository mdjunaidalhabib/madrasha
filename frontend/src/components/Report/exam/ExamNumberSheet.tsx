import { cellValue, formatReportValue, toBanglaDigits } from "../../../utils/reportUtils";
import { ReportColumn } from "../../../features/reports/types";

type ExamNumberSheetProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  /** Column config from the report's menu definition (ExamReportPage.tsx),
   * so a header rename there is reflected in this print preview too. */
  columns?: ReportColumn[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
};

type SubjectMark = {
  book_id?: number;
  subject_name?: string;
  mark?: number | string | null;
};

const value = (row: Record<string, any>, keys: string[], fallback = "") => {
  for (const key of keys) {
    const current = row?.[key];
    if (current !== null && current !== undefined && current !== "") return formatReportValue(current, key);
  }
  return fallback;
};

const parseSubjects = (row: Record<string, any>): SubjectMark[] => {
  const subjects = row?.subjects;
  if (Array.isArray(subjects)) return subjects;
  if (typeof subjects === "string") {
    try {
      const parsed = JSON.parse(subjects);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const ExamNumberSheet = ({
  rows,
  selectedClassName = "",
  startIndex = 0,
  columns = [],
  isFirstPage = true,
  isLastPage = true,
}: ExamNumberSheetProps) => {
  const headerMap = new Map(columns.map((c) => [c.key, c.header]));
  const label = (key: string, fallback: string) => headerMap.get(key) || fallback;

  const firstRow = rows[0] || {};
  const examName = value(firstRow, ["exam_name"], "........................");
  const examYear = value(firstRow, ["exam_year", "academic_year"], "........................");
  const className =
    selectedClassName || value(firstRow, ["class_name", "class_name_bn"], "সকল শ্রেণি");

  const subjectMap = new Map<string, string>();
  rows.forEach((row) => {
    parseSubjects(row).forEach((subject, index) => {
      const key = String(subject.book_id ?? subject.subject_name ?? index);
      if (!subjectMap.has(key)) subjectMap.set(key, subject.subject_name || `বিষয় ${toBanglaDigits(index + 1)}`);
    });
  });
  const subjects = Array.from(subjectMap.entries());

  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
      <div className="student-report-heading report-block-heading mb-3 text-center">
        <h1 className="student-report-title text-xl font-bold">পরীক্ষার নম্বরপত্র</h1>
        <p className="student-report-subtitle mt-1 text-base font-bold text-black">
          {examName} - {examYear}
        </p>
        <p className="student-report-subtitle mt-1 text-base font-bold text-black">
          জামাতঃ {className}
        </p>
      </div>
      )}

      <table
        className={`exam-report-table w-full table-fixed border-collapse border border-black text-center ${isFirstPage ? "" : "mt-6"}`}
      >
        {isFirstPage && (
        <thead>
          <tr>
            <th className="w-10 border border-black px-0.5 py-2 text-base">{label("roll", "রোল")}</th>
            <th className="w-24 border border-black px-0.5 py-2 text-base">{label("registration_no", "রেজিঃ")}</th>
            <th className="w-28 border border-black px-1 py-2 text-base">{label("student_name", "শিক্ষার্থীর নাম")}</th>
            {subjects.map(([key, subjectLabel]) => (
              <th key={key} className="border border-black px-0.5 py-2 text-base leading-tight">
                {subjectLabel}
              </th>
            ))}
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`exam-number-${startIndex + index}-${row.id || row.student_id || index}`}>
              <td className="h-8 border border-black px-0.5 text-base">{cellValue(row, "roll")}</td>
              <td className="h-8 border border-black px-0.5 text-base">
                {cellValue(row, "registration_no")}
              </td>
              <td className="h-8 border border-black px-1 text-left text-base font-semibold">
                {cellValue(row, "student_name")}
              </td>
              {subjects.map(([key]) => (
                // Blank on purpose - the examiner writes the mark by hand
                // during grading, this sheet never pre-fills a stored mark.
                <td key={`${row.id || index}-${key}`} className="h-8 border border-black px-0.5" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {isLastPage && (
      <div className="exam-report-signature report-block-signature flex justify-end">
        <div className="w-fit border-t border-black px-4 pt-0.5 text-center text-base font-medium text-black">
          পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর
        </div>
      </div>
      )}
    </div>
  );
};

export default ExamNumberSheet;
