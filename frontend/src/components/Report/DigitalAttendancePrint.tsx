import { cellValue } from "../../utils/reportUtils";

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
  <div className="mx-auto w-full bg-white text-slate-900">
    <div className="mb-4 text-center">
      <h1 className="text-xl font-bold">ডিজিটাল হাজিরা রিপোর্ট</h1>
      <p className="mt-1 text-sm text-slate-600">
        বিভাগ: {selectedDivisionName || "সকল বিভাগ"} | শ্রেণি: {selectedClassName || "সকল শ্রেণি"}
      </p>
    </div>

    <table className="w-full border-collapse text-center text-sm">
      <thead>
        <tr className="bg-slate-100">
          <th className="border border-slate-600 px-2 py-2">রোল</th>
          <th className="border border-slate-600 px-2 py-2">রেজিস্ট্রেশন নম্বর</th>
          <th className="border border-slate-600 px-2 py-2">শিক্ষার্থী</th>
          <th className="border border-slate-600 px-2 py-2">শ্রেণি</th>
          <th className="border border-slate-600 px-2 py-2">তারিখ</th>
          <th className="border border-slate-600 px-2 py-2">ইন টাইম</th>
          <th className="border border-slate-600 px-2 py-2">আউট টাইম</th>
          <th className="border border-slate-600 px-2 py-2">স্ট্যাটাস</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`digital-${row.id || row.student_id || index}`}>
            <td className="border border-slate-600 px-2 py-2">{cellValue(row, "roll")}</td>
            <td className="border border-slate-600 px-2 py-2">
              {cellValue(row, "registration_no")}
            </td>
            <td className="border border-slate-600 px-2 py-2 font-semibold">
              {cellValue(row, "student_name")}
            </td>
            <td className="border border-slate-600 px-2 py-2">{cellValue(row, "class_name")}</td>
            <td className="border border-slate-600 px-2 py-2">{cellValue(row, "date")}</td>
            <td className="border border-slate-600 px-2 py-2">{cellValue(row, "check_in")}</td>
            <td className="border border-slate-600 px-2 py-2">{cellValue(row, "check_out")}</td>
            <td className="border border-slate-600 px-2 py-2">{cellValue(row, "status")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default DigitalAttendancePrint;
