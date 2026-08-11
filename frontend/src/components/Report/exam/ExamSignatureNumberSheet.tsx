import { cellValue, formatReportValue } from "../../../utils/reportUtils";

type ExamSignatureNumberSheetProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
  isLastPage?: boolean;
  // exam-signature-number-sheet-2col only: dropped there to leave more room
  // in the already-narrow column.
  hideRegistrationColumn?: boolean;
};

const value = (row: Record<string, any>, keys: string[], fallback = "") => {
  for (const key of keys) {
    const current = row?.[key];
    if (current !== null && current !== undefined && current !== "") return formatReportValue(current, key);
  }
  return fallback;
};

// Percentage (not fixed px) widths so this table degrades gracefully at any
// container width - the plain single-column report AND the narrower
// exam-signature-number-sheet-2col column both render off the same
// component, and a fixed-px column set that fits the full page width would
// overflow a half-width column.
const COLUMN_WIDTH_PERCENT = {
  roll: 9,
  registration_no: 15,
  student_name: 39,
  signature: 24,
  mark: 13,
};

// Same four columns' weights re-normalized to 100% once registration_no is
// dropped (hideRegistrationColumn), rather than just leaving that width
// unused. "mark" is wider than its even share - it's hand-written during
// grading and needs real room, not just a number-sized sliver.
const COLUMN_WIDTH_PERCENT_NO_REG = {
  roll: 13,
  student_name: 39,
  signature: 26,
  mark: 22,
};

const ExamSignatureNumberSheet = ({
  rows,
  selectedClassName = "",
  startIndex = 0,
  isFirstPage = true,
  isLastPage = true,
  hideRegistrationColumn = false,
}: ExamSignatureNumberSheetProps) => {
  const firstRow = rows[0] || {};
  const examName = value(firstRow, ["exam_name"], "........................");
  const examYear = value(firstRow, ["exam_year", "academic_year"], "........................");
  const className =
    selectedClassName || value(firstRow, ["class_name", "class_name_bn"], "সকল শ্রেণি");
  const subjectName = firstRow.__subject_name || "................";

  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
      <div className="student-report-heading report-block-heading mb-3 text-center">
        <h1 className="student-report-title text-xl font-bold">স্বাক্ষর ও নম্বরপত্র</h1>
        <p className="student-report-subtitle mt-1 text-base font-bold text-black">
          {examName} - {examYear}
        </p>
        <p className="student-report-subtitle mt-1 text-base font-bold text-black">
          জামাতঃ {className} | বিষয়: {subjectName}
        </p>
      </div>
      )}

      <table
        className={`exam-report-table w-full table-fixed border-collapse border border-black text-center ${isFirstPage ? "" : "mt-6"}`}
      >
        <colgroup>
          <col
            style={{
              width: `${hideRegistrationColumn ? COLUMN_WIDTH_PERCENT_NO_REG.roll : COLUMN_WIDTH_PERCENT.roll}%`,
            }}
          />
          {!hideRegistrationColumn && <col style={{ width: `${COLUMN_WIDTH_PERCENT.registration_no}%` }} />}
          <col
            style={{
              width: `${hideRegistrationColumn ? COLUMN_WIDTH_PERCENT_NO_REG.student_name : COLUMN_WIDTH_PERCENT.student_name}%`,
            }}
          />
          <col
            style={{
              width: `${hideRegistrationColumn ? COLUMN_WIDTH_PERCENT_NO_REG.signature : COLUMN_WIDTH_PERCENT.signature}%`,
            }}
          />
          <col
            style={{
              width: `${hideRegistrationColumn ? COLUMN_WIDTH_PERCENT_NO_REG.mark : COLUMN_WIDTH_PERCENT.mark}%`,
            }}
          />
        </colgroup>
        {isFirstPage && (
        <thead>
          <tr>
            <th className="whitespace-nowrap border border-black px-1 py-2 text-base">রোল</th>
            {!hideRegistrationColumn && (
              <th className="border border-black px-1 py-2 text-base">রেজিঃ নম্বর</th>
            )}
            <th className="border border-black px-1 py-2 text-base">শিক্ষার্থীর নাম</th>
            <th className="border border-black px-1 py-2 text-base">স্বাক্ষর</th>
            <th className="border border-black px-1 py-2 text-base">নম্বর</th>
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`exam-sign-num-${startIndex + index}-${row.id || row.student_id || index}`}>
              <td className="h-9 whitespace-nowrap border border-black px-1 text-base">{cellValue(row, "roll")}</td>
              {!hideRegistrationColumn && (
                <td className="h-9 border border-black px-1 text-base">{cellValue(row, "registration_no")}</td>
              )}
              <td className="h-9 border border-black px-2 text-left text-base font-semibold">
                {cellValue(row, "student_name")}
              </td>
              <td className="h-9 border border-black px-1" />
              <td className="h-9 border border-black px-1" />
            </tr>
          ))}
        </tbody>
      </table>

      {isLastPage && (
      <div className="exam-report-signature report-block-signature mt-8 flex justify-end">
        <div className="w-fit border-t border-black px-4 pt-0.5 text-center text-base font-medium text-black">
          পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর
        </div>
      </div>
      )}
    </div>
  );
};

export default ExamSignatureNumberSheet;
