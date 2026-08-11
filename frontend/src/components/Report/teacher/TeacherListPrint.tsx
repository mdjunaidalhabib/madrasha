import { cellValue, toBanglaDigits } from "../../../utils/reportUtils";

type TeacherListPrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
};

// Raw joining_date is often an ISO timestamp ("2023-05-01T00:00:00.000Z") -
// strip the time portion and use Bangla digits so it reads like the rest of
// the report instead of a machine-formatted string.
const formatJoiningDate = (row: Record<string, any>) => {
  const raw = row?.joining_date;
  if (!raw) return "—";
  return toBanglaDigits(String(raw).slice(0, 10));
};

const TeacherListPrint = ({
  rows,
  selectedDivisionName = "",
  startIndex = 0,
  isFirstPage = true,
}: TeacherListPrintProps) => {
  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
      <div className="student-report-heading report-block-heading mb-3 text-center">
        <h1 className="student-report-title text-xl font-bold">শিক্ষক তালিকা</h1>
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
            <th className="w-16 border border-black px-1 py-2 text-base font-bold">রেজিঃ নম্বর</th>
            <th className="border border-black px-1 py-2 text-base font-bold">শিক্ষকের নাম</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">পদবি</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">ডিপার্টমেন্ট</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">যোগ্যতা</th>
            <th className="w-28 border border-black px-1 py-2 text-base font-bold">মোবাইল</th>
            <th className="w-24 border border-black px-1 py-2 text-base font-bold">যোগদানের তারিখ</th>
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`teacher-list-${startIndex + index}-${row.id || row.teacher_id || index}`}>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "registration_no")}</td>
              <td className="h-8 border border-black px-1 text-left font-semibold text-base">
                {cellValue(row, "teacher_name")}
              </td>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "designation")}</td>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "department")}</td>
              <td className="h-8 border border-black px-1 text-left text-base">
                {cellValue(row, "qualification")}
              </td>
              <td className="h-8 border border-black px-1 text-base">{cellValue(row, "phone")}</td>
              <td className="h-8 border border-black px-1 text-base">{formatJoiningDate(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TeacherListPrint;
