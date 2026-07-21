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
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
  columns = [],
}: ExamNumberSheetProps) => {
  const headerMap = new Map(columns.map((c) => [c.key, c.header]));
  const label = (key: string, fallback: string) => headerMap.get(key) || fallback;

  const firstRow = rows[0] || {};
  const examName = value(firstRow, ["exam_name"], "........................");
  const examYear = value(firstRow, ["exam_year", "academic_year"], "........................");
  const divisionName =
    selectedDivisionName || value(firstRow, ["division_name", "division_name_bn"], "সকল বিভাগ");
  const className =
    selectedClassName || value(firstRow, ["class_name", "class_name_bn"], "সকল শ্রেণি");

  const subjectMap = new Map<string, string>();
  rows.forEach((row) => {
    parseSubjects(row).forEach((subject, index) => {
      const key = String(subject.book_id ?? subject.subject_name ?? index);
      if (!subjectMap.has(key)) subjectMap.set(key, subject.subject_name || `বিষয় ${toBanglaDigits(index + 1)}`);
    });
  });
  const subjects = Array.from(subjectMap.entries());

  return (
    <div className="mx-auto w-full bg-white text-black">
      <h1 className="mb-3 text-center text-xl font-bold">পরীক্ষার নম্বরপত্র</h1>

      <div className="mb-3 grid grid-cols-4 text-[12px]">
        <div className="flex min-h-9 items-center border border-black px-2">
          <b className="mr-1">পরীক্ষা:</b> {examName}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">বিভাগ:</b> {divisionName}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">শ্রেণি:</b> {className}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">শিক্ষাবর্ষ:</b> {examYear}
        </div>
      </div>

      <table className="w-full table-fixed border-collapse border border-black text-center text-[9px]">
        <thead>
          <tr>
            <th className="w-9 border border-black px-0.5 py-2">{label("sl", "ক্রমিক")}</th>
            <th className="w-10 border border-black px-0.5 py-2">{label("roll", "রোল")}</th>
            <th className="w-16 border border-black px-0.5 py-2">{label("registration_no", "রেজিঃ")}</th>
            <th className="w-28 border border-black px-1 py-2">{label("student_name", "শিক্ষার্থীর নাম")}</th>
            {subjects.map(([key, subjectLabel]) => (
              <th key={key} className="border border-black px-0.5 py-2 leading-tight">
                {subjectLabel}
              </th>
            ))}
            <th className="w-12 border border-black px-0.5 py-2">{label("total", "মোট")}</th>
            <th className="w-12 border border-black px-0.5 py-2">{label("average", "গড়")}</th>
            <th className="w-16 border border-black px-0.5 py-2">{label("remarks", "মন্তব্য")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rowSubjects = parseSubjects(row);
            const rowSubjectMap = new Map(
              rowSubjects.map((subject, subjectIndex) => [
                String(subject.book_id ?? subject.subject_name ?? subjectIndex),
                subject.mark,
              ]),
            );

            return (
              <tr key={`exam-number-${row.id || row.student_id || index}`}>
                <td className="h-8 border border-black px-0.5">{toBanglaDigits(startIndex + index + 1)}</td>
                <td className="h-8 border border-black px-0.5">{cellValue(row, "roll")}</td>
                <td className="h-8 border border-black px-0.5">
                  {cellValue(row, "registration_no")}
                </td>
                <td className="h-8 border border-black px-1 text-left font-semibold">
                  {cellValue(row, "student_name")}
                </td>
                {subjects.map(([key]) => {
                  const mark = rowSubjectMap.get(key);
                  return (
                    <td
                      key={`${row.id || index}-${key}`}
                      className="h-8 border border-black px-0.5"
                    >
                      {mark === null || mark === undefined || mark === "" ? "" : formatReportValue(mark)}
                    </td>
                  );
                })}
                <td className="h-8 border border-black px-0.5">
                  {row.total === null || row.total === undefined ? "" : formatReportValue(row.total)}
                </td>
                <td className="h-8 border border-black px-0.5">
                  {row.average === null || row.average === undefined ? "" : formatReportValue(row.average)}
                </td>
                <td className="h-8 border border-black px-0.5" />
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-10 grid grid-cols-3 gap-12 text-center text-[12px]">
        <div className="border-t border-black pt-1">বিষয় শিক্ষকের স্বাক্ষর</div>
        <div className="border-t border-black pt-1">শ্রেণি শিক্ষকের স্বাক্ষর</div>
        <div className="border-t border-black pt-1">পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</div>
      </div>
    </div>
  );
};

export default ExamNumberSheet;
