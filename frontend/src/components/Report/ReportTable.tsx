import { ReportMenuItem } from "../../../src/features/reports/types";
import { cellValue } from "../../utils/reportUtils";

type ReportTableProps = {
  report: ReportMenuItem;
  rows: Record<string, any>[];
  startIndex?: number;
};

const ReportTable = ({ report, rows, startIndex = 0 }: ReportTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-slate-300 text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="w-20 min-w-20 max-w-20 border border-slate-300 px-3 py-3 text-center text-xs font-bold text-slate-700">
              ক্রমিক
            </th>

            {report.columns.map((column) => (
              <th
                key={column.key}
                className={`border border-slate-300 px-4 py-3 text-left text-xs font-bold text-slate-700 whitespace-normal break-words ${
                  column.className || "min-w-32"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={report.columns.length + 1}
                className="border border-slate-300 px-4 py-8 text-center text-sm font-medium text-slate-500"
              >
                কোনো ডাটা পাওয়া যায়নি
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={`${report.key}-${row.id || row.student_id || row.teacher_id || rowIndex}`}
                className="transition hover:bg-slate-50"
              >
                <td className="w-20 min-w-20 max-w-20 border border-slate-300 px-3 py-3 text-center font-medium text-slate-700">
                  {startIndex + rowIndex + 1}
                </td>

                {report.columns.map((column) => (
                  <td
                    key={column.key}
                    className={`border border-slate-300 px-4 py-3 text-slate-700 whitespace-normal break-words ${
                      column.className || "min-w-32"
                    }`}
                  >
                    {cellValue(row, column.key) || "-"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ReportTable;
