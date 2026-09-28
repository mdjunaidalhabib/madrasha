import { printCell, printValue } from "../printFormat";
import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../report.text";

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
    if (value !== null && value !== undefined && value !== "") return printValue(value, key);
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
  const t = usePrintText(reportText);
  const firstRow = rows[0] || {};
  const divisionName =
    selectedDivisionName ||
    rawValue(firstRow, ["division_name", "division_name_bn"]) ||
    t.allDivisions;
  const className =
    selectedClassName || rawValue(firstRow, ["class_name", "class_name_bn"]) || t.allClasses;
  const academicYear = rawValue(firstRow, ["academic_year", "exam_year"]) || "................";
  const contextLine = `${className} | ${divisionName} | ${academicYear}`;

  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
      <>
      <div className="student-report-heading report-block-heading mb-3 text-center">
        <h1 className="student-report-title text-xl font-bold">{t.title.admissionList}</h1>
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
            <th className="w-11 border border-black px-1 py-2 text-base font-bold">{t.col.roll}</th>
            <th className="w-20 border border-black px-1 py-2 text-base font-bold">{t.col.regNo}</th>
            <th className="border border-black px-1 py-2 text-base font-bold">{t.col.studentName}</th>
            <th className="border border-black px-1 py-2 text-base font-bold">{t.col.fatherName}</th>
            <th className="border border-black px-1 py-2 text-base font-bold">{t.col.currentClass}</th>
            <th className="border border-black px-1 py-2 text-base font-bold">{t.col.district}</th>
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`student-admission-${startIndex + index}-${row.id || row.student_id || index}`}>
              <td className="h-8 border border-black px-1 text-base">{printCell(row, "roll")}</td>
              <td className="h-8 border border-black px-1 text-base">
                {printCell(row, "registration_no")}
              </td>
              <td className="h-8 border border-black px-1 text-start font-semibold text-base">
                {printCell(row, "student_name")}
              </td>
              <td className="h-8 border border-black px-1 text-start text-base">
                {printCell(row, "father_name")}
              </td>
              <td className="h-8 border border-black px-1 text-start text-base">
                {rawValue(row, ["class_name", "class_name_bn"]) || "—"}
              </td>
              <td className="h-8 border border-black px-1 text-start text-base">
                {printCell(row, "district")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentAdmissionListPrint;
