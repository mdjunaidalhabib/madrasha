import { cellValue, formatMeritRank, formatReportValue, toBanglaDigits } from "../../../utils/reportUtils";

type SubjectMark = {
  book_id?: number | string;
  subject_name?: string;
  full_marks?: number | string;
  mark?: number | string | null;
  is_absent?: boolean;
};

type MarksheetListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
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

// DOB is stored as a DATE column (no time-of-day meaning), so the UTC
// getters are used deliberately - a local-timezone read (toLocaleDateString)
// can roll the calendar day backward/forward depending on the viewer's
// timezone offset from the midnight-UTC timestamp the API returns.
const formatDob = (value: unknown) => {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return toBanglaDigits(`${day}/${month}/${year}`);
};

// Order matters: roll, registration number, then DOB lead the grid; merit
// rank sits last. Total/average stay in the subject table's own trailing
// rows since (unlike rank) they read naturally right under the marks.
const INFO_FIELDS = (row: Record<string, any>) => [
  { label: "রোল নম্বর", value: cellValue(row, "roll") },
  { label: "রেজিস্ট্রেশন নম্বর", value: cellValue(row, "registration_no") },
  { label: "জন্ম তারিখ", value: formatDob(row?.date_of_birth) },
  { label: "শিক্ষার্থীর নাম", value: cellValue(row, "student_name") },
  { label: "পিতার নাম", value: cellValue(row, "father_name") },
  { label: "ফলাফল বিভাগ", value: cellValue(row, "madrasa_grade") },
  { label: "গ্রেড", value: cellValue(row, "general_grade") },
  { label: "মেধাস্থান", value: formatMeritRank(row?.rank_no) },
];

const formatMark = (subject: SubjectMark) => {
  if (subject.is_absent) return "অনু";
  const mark = subject.mark;
  return mark === null || mark === undefined || mark === "" ? "—" : formatReportValue(mark);
};

const MarksheetList = ({ rows, isFirstPage = true }: MarksheetListProps) => {
  const row = rows[0] || {};
  const rowStatus = String(row?.status || "").toUpperCase();
  const failed = rowStatus === "FAIL";
  const isAbsent = rowStatus === "ABSENT";
  const subjects = getSubjects(row);

  // Total/average have no per-subject serial or full-marks concept of their
  // own, so their row merges the (ক্রম + বিষয়ের নাম) and (প্রাপ্ত নম্বর +
  // পূর্ণমান) column pairs into two wide cells instead of leaving two of the
  // four columns empty.
  const summaryRows = [
    { label: "মোট নম্বর", value: cellValue(row, "total") },
    { label: "গড় নম্বর", value: cellValue(row, "average") },
  ];

  return (
    <section
      className={`marksheet-card p-6 sm:p-8 ${
        failed ? "bg-red-50" : isAbsent ? "bg-amber-50" : "bg-white"
      }`}
    >
      {isFirstPage && (
        <div className="report-block-heading">
          <div className="border-b-2 border-black pb-3 text-center text-black">
            <h2 className="text-2xl font-bold tracking-wide text-black">মার্কশিট</h2>
            <p className="mt-1 text-sm font-semibold text-black">
              {cellValue(row, "exam_name")} - {cellValue(row, "exam_year")} ইং
            </p>
          </div>

          <div className="mt-4 flex justify-center">
            <span className="rounded-full bg-black px-6 py-1.5 text-sm font-bold tracking-wide text-white">
              শ্রেণিঃ {cellValue(row, "class_name")}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-y border-black py-3 text-sm text-black md:grid-cols-3">
            {INFO_FIELDS(row).map((field) => (
              <p key={field.label}>
                <b>{field.label}:</b> {field.value}
              </p>
            ))}
          </div>

          {subjects.length > 0 && (
            <table className="mt-4 w-full border-collapse text-sm text-black">
              <thead>
                <tr className="bg-slate-100">
                  <th className="w-12 border border-black px-2 py-2 text-center">ক্রম</th>
                  <th className="border border-black px-3 py-2 text-left">বিষয়ের নাম</th>
                  <th className="w-24 border border-black px-3 py-2 text-center">প্রাপ্ত নম্বর</th>
                  <th className="w-24 border border-black px-3 py-2 text-center">পূর্ণমান</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject, index) => (
                  <tr key={subject.book_id ?? index}>
                    <td className="border border-black px-2 py-1.5 text-center">
                      {toBanglaDigits(index + 1)}
                    </td>
                    <td className="border border-black px-3 py-1.5">{subject.subject_name || "—"}</td>
                    <td className="border border-black px-3 py-1.5 text-center font-semibold">
                      {formatMark(subject)}
                    </td>
                    <td className="border border-black px-3 py-1.5 text-center">
                      {subject.full_marks === undefined || subject.full_marks === null
                        ? "—"
                        : formatReportValue(subject.full_marks)}
                    </td>
                  </tr>
                ))}
                {summaryRows.map((summary) => (
                  <tr key={summary.label} className="bg-slate-50">
                    <td colSpan={2} className="border border-black px-3 py-1.5 font-semibold">
                      {summary.label}
                    </td>
                    <td colSpan={2} className="border border-black px-3 py-1.5 text-center font-bold">
                      {summary.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
};

export default MarksheetList;
