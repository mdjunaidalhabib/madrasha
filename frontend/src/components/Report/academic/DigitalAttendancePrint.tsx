import { cellValue } from "../../../utils/reportUtils";

type DigitalAttendancePrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
};

const DigitalAttendancePrint = ({
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
}: DigitalAttendancePrintProps) => (
  <div className="mx-auto w-full bg-white text-black">
    <div className="mb-4 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight text-black">ডিজিটাল হাজিরা রিপোর্ট</h1>
      <p className="mt-1 text-base font-bold text-black">
        বিভাগ: {selectedDivisionName || "সকল বিভাগ"}
      </p>
      <p className="text-base font-bold text-black">
        শ্রেণি: {selectedClassName || "সকল শ্রেণি"}
      </p>
    </div>

    <table className="w-full border-collapse text-center">
      <thead>
        <tr className="bg-slate-100">
          <th className="border border-slate-600 px-2 py-2 text-base font-bold">রোল</th>
          <th className="border border-slate-600 px-2 py-2 text-base font-bold">রেজিস্ট্রেশন নম্বর</th>
          <th className="border border-slate-600 px-2 py-2 text-base font-bold">শিক্ষার্থীর নাম</th>
          <th className="border border-slate-600 px-2 py-2 text-base font-bold">শ্রেণি</th>
          <th className="border border-slate-600 px-2 py-2 text-base font-bold">তারিখ</th>
          <th className="border border-slate-600 px-2 py-2 text-base font-bold">ইন টাইম</th>
          <th className="border border-slate-600 px-2 py-2 text-base font-bold">আউট টাইম</th>
          <th className="border border-slate-600 px-2 py-2 text-base font-bold">স্ট্যাটাস</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`digital-${row.id || row.student_id || index}`}>
            <td className="border border-slate-600 px-2 py-2 text-base font-semibold">
              {cellValue(row, "roll")}
            </td>
            <td className="border border-slate-600 px-2 py-2 text-base font-semibold">
              {cellValue(row, "registration_no")}
            </td>
            <td className="border border-slate-600 py-2 pl-3 pr-2 text-left text-base font-semibold">
              {cellValue(row, "student_name")}
            </td>
            <td className="border border-slate-600 px-2 py-2 text-base font-semibold">
              {cellValue(row, "class_name")}
            </td>
            <td className="border border-slate-600 px-2 py-2 text-base">{cellValue(row, "date")}</td>
            <td className="border border-slate-600 px-2 py-2 text-base">{cellValue(row, "check_in")}</td>
            <td className="border border-slate-600 px-2 py-2 text-base">{cellValue(row, "check_out")}</td>
            <td className="border border-slate-600 px-2 py-2 text-base">{cellValue(row, "status")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default DigitalAttendancePrint;
