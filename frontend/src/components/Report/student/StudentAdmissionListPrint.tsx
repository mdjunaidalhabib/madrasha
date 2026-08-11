import { cellValue, formatReportValue } from "../../../utils/reportUtils";

type StudentAdmissionListPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
};

const rawValue = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return formatReportValue(value, key);
  }
  return "";
};

const StudentAdmissionListPrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
  isFirstPage = true,
}: StudentAdmissionListPrintProps) => {
  const firstRow = rows[0] || {};
  const divisionName =
    selectedDivisionName ||
    rawValue(firstRow, ["division_name", "division_name_bn"]) ||
    "সকল বিভাগ";
  const className =
    selectedClassName || rawValue(firstRow, ["class_name", "class_name_bn"]) || "সকল শ্রেণি";
  const academicYear = rawValue(firstRow, ["academic_year", "exam_year"]) || "................";
  const contextLine = `${className} | ${divisionName} | ${academicYear}`;

  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
      <>
      <div className="student-report-heading report-block-heading mb-3 text-center">
        <h1 className="student-report-title text-xl font-bold">ভর্তি তালিকা</h1>
        <p className="student-report-subtitle mt-1 text-base font-bold text-black">
          {contextLine}
        </p>
      </div>
      </>
      )}

      <table
        className={`w-full table-fixed border-collapse border border-black text-center ${isFirstPage ? "" : "mt-6"}`}
      >
        {isFirstPage && (
        <thead>
          <tr>
            <th className="w-11 border border-black px-1 py-2 text-base font-bold">রোল</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">রেজিঃ নম্বর</th>
            <th className="border border-black px-1 py-2 text-base font-bold">শিক্ষার্থীর নাম</th>
            <th className="border border-black px-1 py-2 text-base font-bold">পিতার নাম</th>
            <th className="border border-black px-1 py-2 text-base font-bold">বর্তমান ক্লাস</th>
            <th className="border border-black px-1 py-2 text-base font-bold">জেলা</th>
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`student-admission-${startIndex + index}-${row.id || row.student_id || index}`}>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "roll")}</td>
              <td className="h-8 border border-black px-1 text-base">
                {cellValue(row, "registration_no")}
              </td>
              <td className="h-8 border border-black px-1 text-left font-semibold text-base">
                {cellValue(row, "student_name")}
              </td>
              <td className="h-8 border border-black px-1 text-left text-base">
                {cellValue(row, "father_name")}
              </td>
              <td className="h-8 border border-black px-1 text-left text-base">
                {rawValue(row, ["class_name", "class_name_bn"]) || "—"}
              </td>
              <td className="h-8 border border-black px-1 text-left text-base">
                {cellValue(row, "district")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentAdmissionListPrint;
