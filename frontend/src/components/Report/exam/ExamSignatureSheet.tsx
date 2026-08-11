import { cellValue, formatReportValue } from "../../../utils/reportUtils";

type ExamSignatureSheetProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
  isLastPage?: boolean;
};

const value = (row: Record<string, any>, keys: string[], fallback = "") => {
  for (const key of keys) {
    const current = row?.[key];
    if (current !== null && current !== undefined && current !== "") return formatReportValue(current, key);
  }
  return fallback;
};

const ExamSignatureSheet = ({
  rows,
  selectedClassName = "",
  startIndex = 0,
  isFirstPage = true,
  isLastPage = true,
}: ExamSignatureSheetProps) => {
  const firstRow = rows[0] || {};
  const examName = value(firstRow, ["exam_name"], "........................");
  const examYear = value(firstRow, ["exam_year", "academic_year"], "........................");
  const className =
    selectedClassName || value(firstRow, ["class_name", "class_name_bn"], "সকল শ্রেণি");

  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
      <div className="student-report-heading report-block-heading mb-3 text-center">
        <h1 className="student-report-title text-xl font-bold">পরীক্ষার স্বাক্ষরপত্র</h1>
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
            <th className="w-14 border border-black px-1 py-2 text-base">রোল</th>
            <th className="w-24 border border-black px-1 py-2 text-base">রেজিঃ নম্বর</th>
            <th className="border border-black px-1 py-2 text-base">শিক্ষার্থীর নাম</th>
            <th className="w-40 border border-black px-1 py-2 text-base">স্বাক্ষর</th>
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`exam-sign-${startIndex + index}-${row.id || row.student_id || index}`}>
              <td className="h-9 border border-black px-1 text-base">{cellValue(row, "roll")}</td>
              <td className="h-9 border border-black px-1 text-base">{cellValue(row, "registration_no")}</td>
              <td className="h-9 border border-black px-2 text-left text-base font-semibold">
                {cellValue(row, "student_name")}
              </td>
              <td className="h-9 border border-black px-1" />
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

export default ExamSignatureSheet;
