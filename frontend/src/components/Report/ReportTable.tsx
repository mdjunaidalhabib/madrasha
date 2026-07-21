import { ReportMenuItem } from "../../../src/features/reports/types";
import { cellValue } from "../../utils/reportUtils";

type ReportTableProps = {
  report: ReportMenuItem;
  rows: Record<string, any>[];
  startIndex?: number;
};

const ReportTable = ({ report, rows, startIndex = 0 }: ReportTableProps) => {
  return (
    <div className="w-full min-w-0">
      <table className="report-responsive-table w-full border-collapse border border-black text-center">
        <thead>
          <tr className="bg-slate-100">
            {report.columns.map((column) => (
              <th
                key={column.key}
                className={`border border-black px-2 py-2 text-center font-normal text-slate-800 whitespace-normal break-words ${
                  column.className || ""
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
                colSpan={report.columns.length}
                className="border border-black px-4 py-8 text-center text-sm font-medium text-slate-500"
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
                {report.columns.map((column) => (
                  <td
                    key={column.key}
                    className={`border border-black px-2 py-2 text-center text-slate-800 whitespace-normal break-words ${
                      column.className || ""
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
