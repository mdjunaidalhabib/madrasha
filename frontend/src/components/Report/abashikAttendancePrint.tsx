import { cellValue } from "../../utils/reportUtils";

type AbashikAttendancePrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
};

const getRowValue = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key] || cellValue(row, key);
    if (value) return value;
  }

  return "";
};

const AbashikAttendancePrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
}: AbashikAttendancePrintProps) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const isAllDivision =
    !selectedDivisionName ||
    selectedDivisionName === "সকল বিভাগ" ||
    selectedDivisionName === "All Division";

  const isAllClass =
    !selectedClassName || selectedClassName === "সকল শ্রেণি" || selectedClassName === "All Class";

  const shouldGroup = isAllDivision || isAllClass;

  const groupedData = shouldGroup
    ? Object.values(
        rows.reduce<
          Record<
            string,
            {
              divisionName: string;
              className: string;
              students: Record<string, any>[];
            }
          >
        >((acc, row) => {
          const divisionName =
            getRowValue(row, ["division_name", "division_name_bn", "divisionName", "division"]) ||
            selectedDivisionName ||
            "সকল বিভাগ";

          const className =
            getRowValue(row, ["class_name", "class_name_bn", "className", "class"]) ||
            selectedClassName ||
            "সকল শ্রেণি";

          const groupKey = `${divisionName}-${className}`;

          if (!acc[groupKey]) {
            acc[groupKey] = {
              divisionName,
              className,
              students: [],
            };
          }

          acc[groupKey].students.push(row);

          return acc;
        }, {}),
      )
    : [
        {
          divisionName: selectedDivisionName || "সকল বিভাগ",
          className: selectedClassName || "সকল শ্রেণি",
          students: rows,
        },
      ];

  return (
    <div className="attendance-a4 mx-auto w-full bg-white text-slate-900">
      {groupedData.map((group, groupIndex) => (
        <div
          key={`${group.divisionName}-${group.className}-${groupIndex}`}
          className={groupIndex > 0 ? "mt-5" : ""}
        >
          <div className="mb-2 text-center">
            {groupIndex === 0 && (
              <h1 className="mb-4 text-xl font-bold">আবাসিক শিক্ষার্থী হাজিরা খাতা</h1>
            )}

            <div
              className={
                groupIndex === 0
                  ? "grid grid-cols-4 gap-1 text-[14px]"
                  : "flex items-center gap-2 text-[14px]"
              }
            >
              <div
                className={
                  groupIndex === 0
                    ? "flex h-8 items-center border border-slate-900 px-1 text-left"
                    : "inline-flex h-7 items-center border border-slate-900 px-2 text-left whitespace-nowrap"
                }
              >
                বিভাগ: {group.divisionName}
              </div>

              <div
                className={
                  groupIndex === 0
                    ? "flex h-8 items-center border border-slate-900 px-1 text-left"
                    : "inline-flex h-7 items-center border border-slate-900 px-2 text-left whitespace-nowrap"
                }
              >
                শ্রেণি: {group.className}
              </div>

              {groupIndex === 0 && (
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
            {groupIndex === 0 && (
              <thead>
                <tr>
                  <th className="h-14 w-6 border border-slate-900 p-0 align-middle">
                    <span className="inline-block whitespace-nowrap -rotate-90 text-[12px] font-normal leading-none">
                      ক্রমিক
                    </span>
                  </th>

                  <th className="w-32 border border-slate-900 p-0.5 text-[14px] font-bold">
                    শিক্ষার্থীর নাম
                  </th>

                  {days.map((day) => (
                    <th
                      key={day}
                      className="h-28 w-[10px] border border-slate-900 p-0 align-middle"
                    ></th>
                  ))}
                </tr>
              </thead>
            )}

            <tbody>
              {group.students.map((row, index) => (
                <tr key={`attendance-${groupIndex}-${row.id || index}`}>
                  <td className="h-7 w-6 border border-slate-900 p-0 text-[14px]">
                    {(startIndex + index + 1).toLocaleString("bn-BD")}
                  </td>

                  <td className="h-7 w-32 border border-slate-900 px-3 text-left text-[14px] font-semibold">
                    {cellValue(row, "student_name")}
                  </td>

                  {days.map((day) => (
                    <td
                      key={`attendance-${groupIndex}-${row.id || index}-${day}`}
                      className="h-7 w-[10px] border border-slate-900 p-0"
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default AbashikAttendancePrint;
