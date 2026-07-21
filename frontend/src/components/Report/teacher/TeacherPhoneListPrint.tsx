import { cellValue, toBanglaDigits } from "../../../utils/reportUtils";

type TeacherPhoneListPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  startIndex?: number;
};

const TeacherPhoneListPrint = ({
  rows,
  selectedDivisionName = "",
  startIndex = 0,
}: TeacherPhoneListPrintProps) => {
  return (
    <div className="mx-auto w-full bg-white text-black">
      <h1 className="mb-3 text-center text-xl font-bold">শিক্ষকদের মোবাইল নম্বর তালিকা</h1>

      <div className="mb-3 grid grid-cols-2 text-[13px]">
        <div className="flex min-h-9 items-center border border-black px-2">
          <b className="mr-1">বিভাগ:</b> {selectedDivisionName || "সকল বিভাগ"}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">এই পৃষ্ঠায় শিক্ষক:</b> {toBanglaDigits(rows.length)}
        </div>
      </div>

      <table className="w-full table-fixed border-collapse border border-black text-center text-[11px]">
        <thead>
          <tr>
            <th className="w-12 border border-black px-1 py-2">ক্রমিক</th>
            <th className="w-24 border border-black px-1 py-2">রেজিঃ নম্বর</th>
            <th className="border border-black px-1 py-2">শিক্ষকের নাম</th>
            <th className="w-28 border border-black px-1 py-2">পদবি</th>
            <th className="w-28 border border-black px-1 py-2">বিভাগ</th>
            <th className="w-32 border border-black px-1 py-2">মোবাইল নম্বর</th>
            <th className="w-32 border border-black px-1 py-2">জরুরি মোবাইল</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`teacher-phone-${row.id || row.teacher_id || index}`}>
              <td className="h-9 border border-black px-1">{toBanglaDigits(startIndex + index + 1)}</td>
              <td className="h-9 border border-black px-1">{cellValue(row, "registration_no")}</td>
              <td className="h-9 border border-black px-1 text-left font-semibold">
                {cellValue(row, "teacher_name")}
              </td>
              <td className="h-9 border border-black px-1">{cellValue(row, "designation")}</td>
              <td className="h-9 border border-black px-1">{cellValue(row, "division_name")}</td>
              <td className="h-9 border border-black px-1 font-semibold">
                {cellValue(row, "phone")}
              </td>
              <td className="h-9 border border-black px-1">{cellValue(row, "parent_phone")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TeacherPhoneListPrint;
