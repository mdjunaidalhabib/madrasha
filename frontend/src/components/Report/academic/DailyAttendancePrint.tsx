import { cellValue, formatReportValue } from "../../../utils/reportUtils";

type DailyAttendancePrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
};

const rowText = (row: Record<string, any>, key: string) => {
  const value = row[key];
  return value === null || value === undefined || value === "" ? "" : formatReportValue(value, key);
};

const DailyAttendancePrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
  isFirstPage = true,
}: DailyAttendancePrintProps) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const firstRow = rows[0] || {};
  const divisionName = rowText(firstRow, "division_name") || selectedDivisionName || "সকল বিভাগ";
  const className = rowText(firstRow, "class_name") || selectedClassName || "সকল শ্রেণি";

  return (
    <div className="attendance-a4 mx-auto w-full bg-white text-slate-900">
      <section className={isFirstPage ? "" : "pt-5"}>
        {isFirstPage && (
          <div className="report-block-heading mb-3 text-center">
            <h1 className="mb-3 text-xl font-bold">দৈনন্দিন হাজিরা খাতা</h1>
            <div className="grid grid-cols-4 gap-1 text-[13px]">
              <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                বিভাগ: {divisionName}
              </div>
              <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                শ্রেণি: {className}
              </div>
              <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                বছর: ........................
              </div>
              <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
                মাস: ........................
              </div>
            </div>
          </div>
        )}

        <table className="w-full table-fixed border-collapse text-center">
          {isFirstPage && (
            <thead>
              <tr>
                <th className="w-14 border border-slate-900 p-1 text-base">রোল</th>
                <th className="w-16 border border-slate-900 p-1 text-base">রেজিঃ নম্বর</th>
                <th className="w-36 border border-slate-900 p-1 text-base">শিক্ষার্থীর নাম</th>
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
          )}
          <tbody>
            {rows.map((row, index) => (
              <tr key={`daily-${startIndex + index}-${row.student_id || row.id || index}`}>
                <td className="h-7 border border-slate-900 p-0 text-base">
                  {cellValue(row, "roll")}
                </td>
                <td className="h-7 border border-slate-900 p-0 text-base">
                  {cellValue(row, "registration_no")}
                </td>
                <td className="h-7 border border-slate-900 pl-3 pr-2 text-left text-base font-semibold">
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
    </div>
  );
};

export default DailyAttendancePrint;
