import { printCell } from "../printFormat";
import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../report.text";

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
  const t = usePrintText(reportText);
  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
      <div className="student-report-heading report-block-heading mb-3 text-center">
        <h1 className="student-report-title text-xl font-bold">{t.title.teacherPhoneList}</h1>
        <p className="student-report-subtitle mt-1 text-base font-bold text-black">
          {selectedDivisionName || t.allDivisions}
        </p>
      </div>
      )}

      <table
        className={`w-full table-fixed border-collapse border border-black text-center ${isFirstPage ? "" : "mt-6"}`}
      >
        {isFirstPage && (
        <thead>
          <tr>
            <th className="w-24 border border-black px-1 py-2 text-base font-bold">{t.col.regNo}</th>
            <th className="border border-black px-1 py-2 text-base font-bold">{t.col.teacherName}</th>
            <th className="w-28 border border-black px-1 py-2 text-base font-bold">{t.col.designation}</th>
            <th className="w-32 border border-black px-1 py-2 text-base font-bold">{t.col.mobileNo}</th>
            <th className="w-32 border border-black px-1 py-2 text-base font-bold">{t.col.emergencyMobile}</th>
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`teacher-phone-${startIndex + index}-${row.id || row.teacher_id || index}`}>
              <td className="h-9 border border-black px-1 text-base">{printCell(row, "registration_no")}</td>
              <td className="h-9 border border-black px-1 text-start font-semibold text-base">
                {printCell(row, "teacher_name")}
              </td>
              <td className="h-9 border border-black px-1 text-base">{printCell(row, "designation")}</td>
              <td className="h-9 border border-black px-1 font-semibold text-base">
                {printCell(row, "phone")}
              </td>
              <td className="h-9 border border-black px-1 text-base">{printCell(row, "parent_phone")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TeacherPhoneListPrint;
