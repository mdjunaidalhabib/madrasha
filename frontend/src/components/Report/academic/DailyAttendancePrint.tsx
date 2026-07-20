import { cellValue } from "../../../utils/reportUtils";

type DailyAttendancePrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
};

const rowText = (row: Record<string, any>, key: string) => {
  const value = row[key];
  return value === null || value === undefined || value === "" ? "" : String(value);
};

const DailyAttendancePrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
}: DailyAttendancePrintProps) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const groupedRows = Object.values(
    rows.reduce<
      Record<string, { divisionName: string; className: string; students: Record<string, any>[] }>
    >((acc, row) => {
      const divisionName = rowText(row, "division_name") || selectedDivisionName || "সকল বিভাগ";
      const className = rowText(row, "class_name") || selectedClassName || "সকল শ্রেণি";
      const key = `${divisionName}-${className}`;
      if (!acc[key]) acc[key] = { divisionName, className, students: [] };
      acc[key].students.push(row);
      return acc;
    }, {}),
  );

  return (
    <div className="attendance-a4 mx-auto w-full bg-white text-slate-900">
      {groupedRows.map((group, groupIndex) => (
        <section
          key={`${group.divisionName}-${group.className}`}
          className={groupIndex > 0 ? "print-page-break pt-5" : ""}
        >
          <div className="mb-3 text-center">
            <h1 className="mb-3 text-xl font-bold">দৈনন্দিন হাজিরা খাতা</h1>
            <div className="grid grid-cols-4 gap-1 text-[13px]">
              <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                বিভাগ: {group.divisionName}
              </div>
              <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                শ্রেণি: {group.className}
              </div>
              <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                বছর: ........................
              </div>
              <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                মাস: ........................
              </div>
            </div>
          </div>

          <table className="w-full table-fixed border-collapse text-center">
            <thead>
              <tr>
                <th className="w-14 border border-slate-900 p-1 text-[12px]">রোল</th>
                <th className="w-16 border border-slate-900 p-1 text-[11px]">রেজিঃ নম্বর</th>
                <th className="w-36 border border-slate-900 p-1 text-[13px]">শিক্ষার্থীর নাম</th>
                {days.map((day) => (
                  <th key={day} className="h-16 w-[12px] border border-slate-900 p-0 align-middle">
                    <span className="inline-block -rotate-90 whitespace-nowrap text-[9px] leading-none">
                      {day.toLocaleString("bn-BD")}
                    </span>
                  </th>
                ))}
                <th className="h-16 w-8 border border-slate-900 p-0 align-middle">
                  <span className="inline-block -rotate-90 whitespace-nowrap text-[9px]">
                    মোট উপস্থিত
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {group.students.map((row, index) => (
                <tr key={`daily-${row.student_id || row.id || index}`}>
                  <td className="h-7 border border-slate-900 p-0 text-[12px]">
                    {cellValue(row, "roll")}
                  </td>
                  <td className="h-7 border border-slate-900 p-0 text-[12px]">
                    {cellValue(row, "registration_no")}
                  </td>
                  <td className="h-7 border border-slate-900 px-2 text-[12px] font-semibold">
                    {cellValue(row, "student_name")}
                  </td>
                  {days.map((day) => (
                    <td
                      key={`${row.student_id || row.id}-${day}`}
                      className="h-7 border border-slate-900 p-0"
                    />
                  ))}
                  <td className="h-7 border border-slate-900 p-0" />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
};

export default DailyAttendancePrint;
