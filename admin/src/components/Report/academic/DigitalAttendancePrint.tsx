import { printCell } from "../printFormat";
import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../report.text";

type DigitalAttendancePrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
};

const DigitalAttendancePrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
  isFirstPage = true,
}: DigitalAttendancePrintProps) => {
  const t = usePrintText(reportText);
  return (
  <div className="mx-auto w-full bg-white text-black">
    {isFirstPage && (
      <div className="report-block-heading mb-4 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-black">{t.title.digitalAttendance}</h1>
        <p className="mt-1 text-base font-bold text-black">
          {t.divisionLabel} {selectedDivisionName || t.allDivisions}
        </p>
        <p className="text-base font-bold text-black">
          {t.classLabel} {selectedClassName || t.allClasses}
        </p>
      </div>
    )}

    <table className={`w-full border-collapse text-center ${isFirstPage ? "" : "mt-6"}`}>
      {isFirstPage && (
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-600 px-2 py-2 text-base font-bold">{t.col.roll}</th>
            <th className="border border-slate-600 px-2 py-2 text-base font-bold">{t.col.regNoFull}</th>
            <th className="border border-slate-600 px-2 py-2 text-base font-bold">{t.col.studentName}</th>
            <th className="border border-slate-600 px-2 py-2 text-base font-bold">{t.col.class}</th>
            <th className="border border-slate-600 px-2 py-2 text-base font-bold">{t.col.date}</th>
            <th className="border border-slate-600 px-2 py-2 text-base font-bold">{t.col.inTime}</th>
            <th className="border border-slate-600 px-2 py-2 text-base font-bold">{t.col.outTime}</th>
            <th className="border border-slate-600 px-2 py-2 text-base font-bold">{t.col.status}</th>
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, index) => (
          <tr key={`digital-${row.id || row.student_id || index}`}>
            <td className="border border-slate-600 px-2 py-2 text-base font-semibold">
              {printCell(row, "roll")}
            </td>
            <td className="border border-slate-600 px-2 py-2 text-base font-semibold">
              {printCell(row, "registration_no")}
            </td>
            <td className="border border-slate-600 py-2 ps-3 pe-2 text-start text-base font-semibold">
              {printCell(row, "student_name")}
            </td>
            <td className="border border-slate-600 px-2 py-2 text-base font-semibold">
              {printCell(row, "class_name")}
            </td>
            <td className="border border-slate-600 px-2 py-2 text-base">{printCell(row, "date")}</td>
            <td className="border border-slate-600 px-2 py-2 text-base">{printCell(row, "check_in")}</td>
            <td className="border border-slate-600 px-2 py-2 text-base">{printCell(row, "check_out")}</td>
            <td className="border border-slate-600 px-2 py-2 text-base">{printCell(row, "status")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
};

export default DigitalAttendancePrint;
