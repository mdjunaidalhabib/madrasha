import { cellValue } from "../../../utils/reportUtils";

type StudentAdmissionListPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
};

const rawValue = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "";
};

const StudentAdmissionListPrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
}: StudentAdmissionListPrintProps) => {
  const firstRow = rows[0] || {};
  const divisionName =
    selectedDivisionName ||
    rawValue(firstRow, ["division_name", "division_name_bn"]) ||
    "সকল বিভাগ";
  const className =
    selectedClassName || rawValue(firstRow, ["class_name", "class_name_bn"]) || "সকল শ্রেণি";
  const academicYear = rawValue(firstRow, ["academic_year", "exam_year"]) || "................";

  return (
    <div className="mx-auto w-full bg-white text-black">
      <h1 className="mb-3 text-center text-xl font-bold">ভর্তি তালিকা</h1>

      <div className="mb-3 grid grid-cols-3 text-[13px]">
        <div className="flex min-h-9 items-center border border-black px-2">
          <b className="mr-1">বিভাগ:</b> {divisionName}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">শ্রেণি:</b> {className}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">শিক্ষাবর্ষ:</b> {academicYear}
        </div>
      </div>

      <table className="w-full table-fixed border-collapse border border-black text-center text-[10px]">
        <thead>
          <tr>
            <th className="w-9 border border-black px-1 py-2">ক্রমিক</th>
            <th className="w-11 border border-black px-1 py-2">রোল</th>
            <th className="w-20 border border-black px-1 py-2">রেজিঃ নম্বর</th>
            <th className="border border-black px-1 py-2">শিক্ষার্থীর নাম</th>
            <th className="border border-black px-1 py-2">পিতার নাম</th>
            <th className="border border-black px-1 py-2">মাতার নাম</th>
            <th className="w-24 border border-black px-1 py-2">মোবাইল নম্বর</th>
            <th className="w-20 border border-black px-1 py-2">ভর্তির তারিখ</th>
            <th className="border border-black px-1 py-2">ঠিকানা</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const address = [
              rawValue(row, ["village"]),
              rawValue(row, ["thana"]),
              rawValue(row, ["district"]),
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <tr key={`student-admission-${row.id || row.student_id || index}`}>
                <td className="h-8 border border-black px-1">{startIndex + index + 1}</td>
                <td className="h-8 border border-black px-1">{cellValue(row, "roll")}</td>
                <td className="h-8 border border-black px-1">
                  {cellValue(row, "registration_no")}
                </td>
                <td className="h-8 border border-black px-1 text-left font-semibold">
                  {cellValue(row, "student_name")}
                </td>
                <td className="h-8 border border-black px-1 text-left">
                  {cellValue(row, "father_name")}
                </td>
                <td className="h-8 border border-black px-1 text-left">
                  {cellValue(row, "mother_name")}
                </td>
                <td className="h-8 border border-black px-1">{cellValue(row, "guardian_phone")}</td>
                <td className="h-8 border border-black px-1">{cellValue(row, "admission_date")}</td>
                <td className="h-8 border border-black px-1 text-left">{address || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default StudentAdmissionListPrint;
