import { printCell, printValue } from "../printFormat";
import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../report.text";

type ClassRoutinePrintProps = {
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

const ClassRoutinePrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
  isFirstPage = true,
}: ClassRoutinePrintProps) => {
  const t = usePrintText(reportText);
  const firstRow = rows[0] || {};
  const divisionName =
    selectedDivisionName ||
    rawValue(firstRow, ["division_name", "division_name_bn"]) ||
    t.allDivisions;
  const className =
    selectedClassName || rawValue(firstRow, ["class_name", "class_name_bn"]) || t.allClasses;

  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
        <div className="report-block-heading">
          <h1 className="mb-3 text-center text-xl font-bold">{t.title.classRoutine}</h1>

          <div className="mb-3 grid grid-cols-2 text-[13px]">
            <div className="flex min-h-9 items-center border border-black px-2">
              <b className="me-1">{t.divisionLabel}</b> {divisionName}
            </div>
            <div className="flex min-h-9 items-center border border-s-0 border-black px-2">
              <b className="me-1">{t.classLabel}</b> {className}
            </div>
          </div>
        </div>
      )}

      <table
        className={`w-full table-fixed border-collapse border border-black text-center ${isFirstPage ? "" : "mt-6"}`}
      >
        {isFirstPage && (
        <thead>
          <tr>
            <th className="w-24 border border-black px-1 py-2 text-base font-bold">{t.col.day}</th>
            <th className="w-24 border border-black px-1 py-2 text-base font-bold">{t.col.startTime}</th>
            <th className="w-24 border border-black px-1 py-2 text-base font-bold">{t.col.endTime}</th>
            <th className="border border-black px-1 py-2 text-base font-bold">{t.col.subject}</th>
            <th className="border border-black px-1 py-2 text-base font-bold">{t.col.teacher}</th>
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`class-routine-${startIndex + index}-${row.id || index}`}>
              <td className="h-9 border border-black px-1 font-semibold text-base">
                {printCell(row, "day")}
              </td>
              <td className="h-9 border border-black px-1 text-base">{printCell(row, "start_time")}</td>
              <td className="h-9 border border-black px-1 text-base">{printCell(row, "end_time")}</td>
              <td className="h-9 border border-black px-1 text-start font-semibold text-base">
                {printCell(row, "subject_name")}
              </td>
              <td className="h-9 border border-black px-1 text-start text-base">
                {printCell(row, "teacher_name")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ClassRoutinePrint;
