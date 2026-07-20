import { cellValue } from "../../../utils/reportUtils";
import { ReportColumn } from "../../../features/reports/types";

type AcademicResultPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  /** Column config from the report's menu definition (AcademicReportPage.tsx).
   * Used to look up header labels so a rename there is reflected here too —
   * previously this component had its own hardcoded header text and ignored
   * the configured columns entirely, so renaming a column only affected the
   * Excel/CSV export, never the on-screen/print preview. */
  columns?: ReportColumn[];
};

type SubjectMark = {
  book_id?: number | string;
  subject_name?: string;
  mark?: number | string | null;
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

const AcademicResultPrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  columns = [],
}: AcademicResultPrintProps) => {
  const headerMap = new Map(columns.map((c) => [c.key, c.header]));
  const label = (key: string, fallback: string) => headerMap.get(key) || fallback;

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

  const subjects = Array.from(subjectMap.values());
  const subjectWidth = subjects.length > 12 ? 30 : subjects.length > 8 ? 38 : 48;

  const getMark = (row: Record<string, any>, subjectKey: string) => {
    const subject = getSubjects(row).find(
      (item, index) => getSubjectKey(item, index) === subjectKey,
    );
    const mark = subject?.mark;
    return mark === null || mark === undefined || mark === "" ? "—" : String(mark);
  };

  return (
    <div className="mx-auto w-full bg-white text-black">
      <h1 className="mb-3 text-center text-xl font-bold">একাডেমিক ফলাফল</h1>

      <div className="mb-3 grid grid-cols-4 text-[12px]">
        <div className="flex min-h-9 items-center border border-black px-2">
          <b className="mr-1">বিভাগ:</b> {divisionName}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">শ্রেণি:</b> {className}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">পরীক্ষা:</b> {examName}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">শিক্ষাবর্ষ:</b> {examYear}
        </div>
      </div>

      <table className="w-full table-fixed border-collapse border border-black text-center text-[11px]">
        <thead>
          <tr>
            <th className="w-10 border border-black px-1 py-2.5">{label("roll", "রোল")}</th>
            <th className="w-[68px] border border-black px-1 py-2.5">
              {label("registration_no", "রেজিঃ নম্বর")}
            </th>
            <th className="w-[110px] border border-black px-1 py-2.5">
              {label("student_name", "শিক্ষার্থীর নাম")}
            </th>
            {subjects.map((subject) => (
              <th
                key={`subject-header-${subject.key}`}
                className="border border-black px-0.5 py-1.5 leading-tight"
                style={{ width: `${subjectWidth}px` }}
              >
                <span className="block break-words">{subject.name}</span>
              </th>
            ))}
            <th className="w-11 border border-black px-1 py-2.5">{label("total", "মোট")}</th>
            <th className="w-10 border border-black px-1 py-2.5">{label("average", "গড়")}</th>
            <th className="w-11 border border-black px-1 py-2.5">
              {label("general_grade", "গ্রেড ")}
            </th>
            <th className="w-[58px] border border-black px-1 py-2.5">
              {label("madrasa_grade", "মাদরাসা গ্রেড")}
            </th>
            <th className="w-11 border border-black px-1 py-2.5">
              {label("rank_no", "মেধাক্রম")}
            </th>
            <th className="w-[62px] border border-black px-1 py-2.5">
              {label("status", "স্ট্যাটাস")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`academic-result-${row.result_master_id || "result"}-${row.student_id || row.id || index}`}
            >
              <td className="h-9 border border-black px-1">{cellValue(row, "roll")}</td>
              <td className="h-9 border border-black px-1">{cellValue(row, "registration_no")}</td>
              <td className="h-9 border border-black px-1 text-left font-semibold">
                {cellValue(row, "student_name")}
              </td>
              {subjects.map((subject) => (
                <td
                  key={`subject-mark-${row.student_id || row.id || index}-${subject.key}`}
                  className="h-9 border border-black px-0.5 font-semibold"
                >
                  {getMark(row, subject.key)}
                </td>
              ))}
              <td className="h-9 border border-black px-1">{cellValue(row, "total")}</td>
              <td className="h-9 border border-black px-1">{formatAverage(row)}</td>
              <td className="h-9 border border-black px-1">{cellValue(row, "general_grade")}</td>
              <td className="h-9 border border-black px-1">{cellValue(row, "madrasa_grade")}</td>
              <td className="h-9 border border-black px-1">{cellValue(row, "rank_no")}</td>
              <td className="h-9 border border-black px-1">{cellValue(row, "status")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AcademicResultPrint;
