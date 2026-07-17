import { cellValue } from "../../utils/reportUtils";

type MarksheetListProps = {
  rows: Record<string, any>[];
};

const MarksheetList = ({ rows }: MarksheetListProps) => (
  <div className="space-y-6">
    {rows.map((row, index) => (
      <section
        key={`marksheet-${row.student_id || row.id || index}`}
        className="print-page-break border-2 border-slate-800 bg-white p-6"
      >
        <div className="text-center">
          <p className="text-xs text-slate-500">بسم الله الرحمن الرحيم</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">ফলাফল ও মার্কশিট</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {cellValue(row, "exam_name")} — {cellValue(row, "exam_year")}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border border-slate-400 p-4 text-sm md:grid-cols-3">
          <p>
            <b>শিক্ষার্থী:</b> {cellValue(row, "student_name")}
          </p>
          <p>
            <b>রেজিস্ট্রেশন:</b> {cellValue(row, "student_id")}
          </p>
          <p>
            <b>রোল:</b> {cellValue(row, "roll")}
          </p>
          <p>
            <b>বিভাগ:</b> {cellValue(row, "division_name")}
          </p>
          <p>
            <b>শ্রেণি:</b> {cellValue(row, "class_name")}
          </p>
          <p>
            <b>সেশন:</b> {cellValue(row, "academic_year")}
          </p>
        </div>

        <table className="mt-5 w-full border-collapse text-center text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-500 px-3 py-3">মোট নম্বর</th>
              <th className="border border-slate-500 px-3 py-3">গড়</th>
              <th className="border border-slate-500 px-3 py-3">সাধারণ গ্রেড</th>
              <th className="border border-slate-500 px-3 py-3">মাদরাসা গ্রেড</th>
              <th className="border border-slate-500 px-3 py-3">মেধাক্রম</th>
              <th className="border border-slate-500 px-3 py-3">ফলাফল</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-500 px-3 py-4 font-semibold">
                {cellValue(row, "total")}
              </td>
              <td className="border border-slate-500 px-3 py-4 font-semibold">
                {cellValue(row, "average")}
              </td>
              <td className="border border-slate-500 px-3 py-4 font-semibold">
                {cellValue(row, "general_grade")}
              </td>
              <td className="border border-slate-500 px-3 py-4 font-semibold">
                {cellValue(row, "madrasa_grade")}
              </td>
              <td className="border border-slate-500 px-3 py-4 font-semibold">
                {cellValue(row, "rank_no")}
              </td>
              <td className="border border-slate-500 px-3 py-4 font-semibold">
                {cellValue(row, "status")}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-12 flex justify-between text-xs font-semibold text-slate-700">
          <span>শ্রেণি শিক্ষকের স্বাক্ষর</span>
          <span>পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</span>
          <span>প্রধান শিক্ষকের স্বাক্ষর ও সীল</span>
        </div>
      </section>
    ))}
  </div>
);

export default MarksheetList;
