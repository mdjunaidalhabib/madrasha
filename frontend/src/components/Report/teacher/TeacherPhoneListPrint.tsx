import { cellValue } from "../../../utils/reportUtils";

type TeacherPhoneListPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
};

const TeacherPhoneListPrint = ({
  rows,
  selectedDivisionName = "",
  startIndex = 0,
  isFirstPage = true,
}: TeacherPhoneListPrintProps) => {
  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
      <div className="student-report-heading report-block-heading mb-3 text-center">
        <h1 className="student-report-title text-xl font-bold">শিক্ষকদের মোবাইল নম্বর তালিকা</h1>
        <p className="student-report-subtitle mt-1 text-base font-bold text-black">
          {selectedDivisionName || "সকল বিভাগ"}
        </p>
      </div>
      )}

      <table
        className={`w-full table-fixed border-collapse border border-black text-center ${isFirstPage ? "" : "mt-6"}`}
      >
        {isFirstPage && (
        <thead>
          <tr>
            <th className="w-24 border border-black px-1 py-2 text-base font-bold">রেজিঃ নম্বর</th>
            <th className="border border-black px-1 py-2 text-base font-bold">শিক্ষকের নাম</th>
            <th className="w-28 border border-black px-1 py-2 text-base font-bold">পদবি</th>
            <th className="w-32 border border-black px-1 py-2 text-base font-bold">মোবাইল নম্বর</th>
            <th className="w-32 border border-black px-1 py-2 text-base font-bold">জরুরি মোবাইল</th>
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`teacher-phone-${startIndex + index}-${row.id || row.teacher_id || index}`}>
              <td className="h-9 border border-black px-1 text-base">{cellValue(row, "registration_no")}</td>
              <td className="h-9 border border-black px-1 text-left font-semibold text-base">
                {cellValue(row, "teacher_name")}
              </td>
              <td className="h-9 border border-black px-1 text-base">{cellValue(row, "designation")}</td>
              <td className="h-9 border border-black px-1 font-semibold text-base">
                {cellValue(row, "phone")}
              </td>
              <td className="h-9 border border-black px-1 text-base">{cellValue(row, "parent_phone")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TeacherPhoneListPrint;
