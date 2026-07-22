import { cellValue, formatReportValue, toBanglaDigits } from "../../../utils/reportUtils";

type ClassRoutinePrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
};

const rawValue = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return formatReportValue(value, key);
  }
  return "";
};

const ClassRoutinePrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
}: ClassRoutinePrintProps) => {
  const firstRow = rows[0] || {};
  const divisionName =
    selectedDivisionName ||
    rawValue(firstRow, ["division_name", "division_name_bn"]) ||
    "সকল বিভাগ";
  const className =
    selectedClassName || rawValue(firstRow, ["class_name", "class_name_bn"]) || "সকল শ্রেণি";

  return (
    <div className="mx-auto w-full bg-white text-black">
      <h1 className="mb-3 text-center text-xl font-bold">ক্লাস রুটিন</h1>

      <div className="mb-3 grid grid-cols-2 text-[13px]">
        <div className="flex min-h-9 items-center border border-black px-2">
          <b className="mr-1">বিভাগ:</b> {divisionName}
        </div>
        <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
          <b className="mr-1">শ্রেণি:</b> {className}
        </div>
      </div>

      <table className="w-full table-fixed border-collapse border border-black text-center">
        <thead>
          <tr>
            <th className="w-12 border border-black px-1 py-2 text-base font-bold">ক্রমিক</th>
            <th className="w-24 border border-black px-1 py-2 text-base font-bold">দিন</th>
            <th className="w-24 border border-black px-1 py-2 text-base font-bold">শুরুর সময়</th>
            <th className="w-24 border border-black px-1 py-2 text-base font-bold">শেষ সময়</th>
            <th className="border border-black px-1 py-2 text-base font-bold">বিষয়</th>
            <th className="border border-black px-1 py-2 text-base font-bold">শিক্ষক</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`class-routine-${row.id || index}`}>
              <td className="h-9 border border-black px-1 text-base">{toBanglaDigits(startIndex + index + 1)}</td>
              <td className="h-9 border border-black px-1 font-semibold text-base">
                {cellValue(row, "day")}
              </td>
              <td className="h-9 border border-black px-1 text-base">{cellValue(row, "start_time")}</td>
              <td className="h-9 border border-black px-1 text-base">{cellValue(row, "end_time")}</td>
              <td className="h-9 border border-black px-1 text-left font-semibold text-base">
                {cellValue(row, "subject_name")}
              </td>
              <td className="h-9 border border-black px-1 text-left text-base">
                {cellValue(row, "teacher_name")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ClassRoutinePrint;
