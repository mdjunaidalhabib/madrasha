import { cellValue } from "../../utils/reportUtils";

type ExamSignatureSheetProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
};

const value = (row: Record<string, any>, keys: string[], fallback = "") => {
  for (const key of keys) {
    const current = row?.[key];
    if (current !== null && current !== undefined && current !== "") return String(current);
  }
  return fallback;
};

const ExamSignatureSheet = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
}: ExamSignatureSheetProps) => {
  const firstRow = rows[0] || {};
  const examName = value(firstRow, ["exam_name"], "........................");
  const examYear = value(firstRow, ["exam_year", "academic_year"], "........................");
  const divisionName =
    selectedDivisionName || value(firstRow, ["division_name", "division_name_bn"], "সকল বিভাগ");
  const className =
    selectedClassName || value(firstRow, ["class_name", "class_name_bn"], "সকল শ্রেণি");

  return (
    <div className="mx-auto w-full bg-white text-black">
      <h1 className="mb-3 text-center text-xl font-bold">পরীক্ষার স্বাক্ষরপত্র</h1>

      <div className="mb-2 grid grid-cols-4 text-[12px]">
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

      <div className="mb-3 grid grid-cols-3 text-[12px]">
        <div className="flex min-h-9 items-center border border-black px-2">
          <b className="mr-1">বিষয়:</b> ........................................
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">তারিখ:</b> ................................
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">সময়:</b> ................................
        </div>
      </div>

      <table className="w-full table-fixed border-collapse border border-black text-center text-[12px]">
        <thead>
          <tr>
            <th className="w-11 border border-black px-1 py-2">ক্রমিক</th>
            <th className="w-14 border border-black px-1 py-2">রোল</th>
            <th className="w-24 border border-black px-1 py-2">রেজিঃ নম্বর</th>
            <th className="border border-black px-1 py-2">শিক্ষার্থীর নাম</th>
            <th className="w-40 border border-black px-1 py-2">স্বাক্ষর</th>
            <th className="w-24 border border-black px-1 py-2">মন্তব্য</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`exam-sign-${row.id || row.student_id || index}`}>
              <td className="h-9 border border-black px-1">{startIndex + index + 1}</td>
              <td className="h-9 border border-black px-1">{cellValue(row, "roll")}</td>
              <td className="h-9 border border-black px-1">{cellValue(row, "registration_no")}</td>
              <td className="h-9 border border-black px-2 text-left font-semibold">
                {cellValue(row, "student_name")}
              </td>
              <td className="h-9 border border-black px-1" />
              <td className="h-9 border border-black px-1" />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-10 grid grid-cols-3 gap-10 text-center text-[12px]">
        <div className="border-t border-black pt-1">কক্ষ পরিদর্শকের স্বাক্ষর</div>
        <div className="border-t border-black pt-1">সহকারী কক্ষ পরিদর্শকের স্বাক্ষর</div>
        <div className="border-t border-black pt-1">পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</div>
      </div>
    </div>
  );
};

export default ExamSignatureSheet;
