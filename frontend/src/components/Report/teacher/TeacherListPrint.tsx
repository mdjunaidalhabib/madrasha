import { cellValue, toBanglaDigits } from "../../../utils/reportUtils";

type TeacherListPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  startIndex?: number;
};

const TeacherListPrint = ({
  rows,
  selectedDivisionName = "",
  startIndex = 0,
}: TeacherListPrintProps) => {
  return (
    <div className="mx-auto w-full bg-white text-black">
      <h1 className="mb-3 text-center text-xl font-bold">শিক্ষক তালিকা</h1>

      <div className="mb-3 grid grid-cols-2 text-[13px]">
        <div className="flex min-h-9 items-center border border-black px-2">
          <b className="mr-1">বিভাগ:</b> {selectedDivisionName || "সকল বিভাগ"}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">এই পৃষ্ঠায় শিক্ষক:</b> {toBanglaDigits(rows.length)}
        </div>
      </div>

      <table className="w-full table-fixed border-collapse border border-black text-center">
        <thead>
          <tr>
            <th className="w-8 border border-black px-1 py-2 text-base font-bold">ক্রমিক</th>
            <th className="w-16 border border-black px-1 py-2 text-base font-bold">রেজিঃ নম্বর</th>
            <th className="border border-black px-1 py-2 text-base font-bold">শিক্ষকের নাম</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">পদবি</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">বিভাগ</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">ডিপার্টমেন্ট</th>
            <th className="border border-black px-1 py-2 text-base font-bold">যোগ্যতা</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">মোবাইল</th>
            <th className="border border-black px-1 py-2 text-base font-bold">ইমেইল</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">যোগদানের তারিখ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`teacher-list-${row.id || row.teacher_id || index}`}>
              <td className="h-8 border border-black px-1 text-base">{toBanglaDigits(startIndex + index + 1)}</td>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "registration_no")}</td>
              <td className="h-8 border border-black px-1 text-left font-semibold text-base">
                {cellValue(row, "teacher_name")}
              </td>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "designation")}</td>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "division_name")}</td>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "department")}</td>
              <td className="h-8 border border-black px-1 text-left text-base">
                {cellValue(row, "qualification")}
              </td>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "phone")}</td>
              <td className="h-8 border border-black px-1 text-left text-base">{cellValue(row, "email")}</td>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "joining_date")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TeacherListPrint;
