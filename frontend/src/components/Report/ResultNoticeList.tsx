import { cellValue } from "../../utils/reportUtils";

type ResultNoticeListProps = {
  rows: Record<string, any>[];
  startIndex?: number;
};

const ResultNoticeList = ({ rows, startIndex = 0 }: ResultNoticeListProps) => {
  const groups = Object.values(
    rows.reduce<Record<string, { title: string; rows: Record<string, any>[] }>>((acc, row) => {
      const title = `${cellValue(row, "exam_name")} | ${cellValue(row, "class_name")} | ${cellValue(row, "exam_year")}`;
      if (!acc[title]) acc[title] = { title, rows: [] };
      acc[title].rows.push(row);
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-6">
      {groups.map((group, groupIndex) => (
        <section key={group.title} className={groupIndex ? "print-page-break pt-4" : ""}>
          <div className="mb-4 text-center">
            <h2 className="text-2xl font-bold">রেজাল্ট নোটিশ</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">{group.title}</p>
          </div>

          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-500 px-2 py-2">ক্রমিক</th>
                <th className="border border-slate-500 px-2 py-2">রোল</th>
                <th className="border border-slate-500 px-2 py-2 text-left">শিক্ষার্থী</th>
                <th className="border border-slate-500 px-2 py-2">মোট</th>
                <th className="border border-slate-500 px-2 py-2">গড়</th>
                <th className="border border-slate-500 px-2 py-2">গ্রেড</th>
                <th className="border border-slate-500 px-2 py-2">মেধাক্রম</th>
                <th className="border border-slate-500 px-2 py-2">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, index) => (
                <tr key={`${row.student_id || row.id}-${index}`}>
                  <td className="border border-slate-500 px-2 py-2">{startIndex + index + 1}</td>
                  <td className="border border-slate-500 px-2 py-2">{cellValue(row, "roll")}</td>
                  <td className="border border-slate-500 px-2 py-2 text-left font-semibold">
                    {cellValue(row, "student_name")}
                  </td>
                  <td className="border border-slate-500 px-2 py-2">{cellValue(row, "total")}</td>
                  <td className="border border-slate-500 px-2 py-2">{cellValue(row, "average")}</td>
                  <td className="border border-slate-500 px-2 py-2">
                    {cellValue(row, "general_grade")}
                  </td>
                  <td className="border border-slate-500 px-2 py-2">{cellValue(row, "rank_no")}</td>
                  <td className="border border-slate-500 px-2 py-2">{cellValue(row, "status")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-10 text-right text-sm font-semibold">
            প্রধান শিক্ষকের স্বাক্ষর ও সীল
          </div>
        </section>
      ))}
    </div>
  );
};

export default ResultNoticeList;
