import { cellValue, toBanglaDigits } from "../../../utils/reportUtils";

type ResidentialAttendancePrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
};

const getRowValue = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key] || cellValue(row, key);
    if (value) return value;
  }

  return "";
};

const ResidentialAttendancePrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
  isFirstPage = true,
}: ResidentialAttendancePrintProps) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const firstRow = rows[0] || {};
  const divisionName =
    getRowValue(firstRow, ["division_name", "division_name_bn", "divisionName", "division"]) ||
    selectedDivisionName ||
    "সকল বিভাগ";
  const className =
    getRowValue(firstRow, ["class_name", "class_name_bn", "className", "class"]) ||
    selectedClassName ||
    "সকল শ্রেণি";

  return (
    <div className="attendance-a4 mx-auto w-full bg-white text-slate-900">
      <div className={isFirstPage ? "" : "mt-5"}>
        <div className="report-block-heading mb-2 text-center">
          {isFirstPage && <h1 className="mb-4 text-xl font-bold">আবাসিক শিক্ষার্থী হাজিরা খাতা</h1>}

          <div
            className={
              isFirstPage ? "grid grid-cols-4 gap-1 text-[14px]" : "flex items-center gap-2 text-[14px]"
            }
          >
            <div
              className={
                isFirstPage
                  ? "flex h-8 items-center border border-slate-900 px-1 text-left"
                  : "inline-flex h-7 items-center border border-slate-900 px-2 text-left whitespace-nowrap"
              }
            >
              বিভাগ: {divisionName}
            </div>

            <div
              className={
                isFirstPage
                  ? "flex h-8 items-center border border-slate-900 px-1 text-left"
                  : "inline-flex h-7 items-center border border-slate-900 px-2 text-left whitespace-nowrap"
              }
            >
              শ্রেণি: {className}
            </div>

            {isFirstPage && (
              <>
                <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                  বছর: ........................
                </div>

                <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                  মাস: ........................
                </div>
              </>
            )}
          </div>
        </div>

        <table className="w-full table-fixed border-collapse text-center">
          {isFirstPage && (
            <thead>
              <tr>
                <th className="w-12 border border-slate-900 p-0.5 text-base font-bold">রোল</th>

                <th className="w-16 border border-slate-900 p-0.5 text-base font-bold">
                  রেজিঃ নম্বর
                </th>

                <th className="w-32 border border-slate-900 p-0.5 text-base font-bold">
                  শিক্ষার্থীর নাম
                </th>

                {days.map((day) => (
                  <th key={day} className="h-28 w-[10px] border border-slate-900 p-0 align-middle">
                    <span className="inline-block -rotate-90 whitespace-nowrap text-[8px] leading-none">
                      {toBanglaDigits(day)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody>
            {rows.map((row, index) => (
              <tr key={`attendance-${startIndex + index}-${row.id || index}`}>
                <td className="h-7 w-12 border border-slate-900 p-0 text-base">
                  {cellValue(row, "roll")}
                </td>

                <td className="h-7 w-16 border border-slate-900 p-0 text-base">
                  {cellValue(row, "registration_no")}
                </td>

                <td className="h-7 w-32 border border-slate-900 pl-3 pr-2 text-left text-base font-semibold">
                  {cellValue(row, "student_name")}
                </td>

                {days.map((day) => (
                  <td
                    key={`attendance-${startIndex + index}-${row.id || index}-${day}`}
                    className="h-7 w-[10px] border border-slate-900 p-0"
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResidentialAttendancePrint;
