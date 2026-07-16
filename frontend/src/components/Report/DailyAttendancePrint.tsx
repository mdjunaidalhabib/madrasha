import { cellValue } from "../../utils/reportUtils";

type DigitalAttendancePrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
};

const DigitalAttendancePrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
}: DigitalAttendancePrintProps) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="attendance-a4 mx-auto w-full bg-white text-slate-900">
      <div className="mb-4 text-center">
        <h1 className="mb-4 text-xl font-bold">ডিজিটাল হাজিরা খাতা</h1>

        <div className="grid grid-cols-4 gap-1 text-[14px]">
          <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
            বিভাগ: {selectedDivisionName || "সকল বিভাগ"}
          </div>

          <div className="flex h-8 items-center border border-slate-900 px-1 text-left">
            শ্রেণি: {selectedClassName || "সকল শ্রেণি"}
          </div>

          <div className="flex h-8  items-center border border-slate-900 px-1 text-left">
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
            <th className="h-14 w-6 border border-slate-900 p-0 align-middle">
              <span className="inline-block whitespace-nowrap -rotate-90 text-[12px] font-normal leading-none">
                ক্রমিক
              </span>
            </th>

            <th className="w-32 border border-slate-900 p-0.5 text-[14px] font-bold">
              শিক্ষার্থীর নাম
            </th>

            {days.map((day) => (
              <th key={day} className="h-14 w-[10px] border border-slate-900 p-0 align-middle">
                <span className="inline-block whitespace-nowrap -rotate-90 text-[9px] leading-none">
                  {day.toLocaleString("bn-BD")}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={`digital-attendance-${row.id || index}`}>
              <td className="h-7 border border-slate-900 p-0 text-[14px]">
                {(index + 1).toLocaleString("bn-BD")}
              </td>

              <td className="h-7 border border-slate-900 px-3 text-left text-[14px] font-semibold">
                {cellValue(row, "student_name")}
              </td>

              {days.map((day) => (
                <td
                  key={`digital-attendance-${row.id || index}-${day}`}
                  className="h-7 border border-slate-900 p-0"
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DigitalAttendancePrint;
