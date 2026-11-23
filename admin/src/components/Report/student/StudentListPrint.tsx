import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import type { ReportMenuItem } from "../../../features/reports/types";
import { printCell, printValue } from "../printFormat";
import { reportText } from "../report.text";

type Props = {
  report: ReportMenuItem;
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  isFirstPage?: boolean;
};

export default function StudentListPrint({
  report,
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  isFirstPage = true,
}: Props) {
  const t = usePrintText(reportText);
  const first = rows[0] || {};
  const division = first.division_name || first.division_name_bn || selectedDivisionName;
  const className = first.class_name || first.class_name_bn || selectedClassName;

  return (
    <div className="w-full min-w-0 bg-white text-black">
      {isFirstPage && (
        <div className="report-block-heading mb-3 text-center">
          <h1 className="text-xl font-bold">{report.title}</h1>
          <div className="mt-2 text-xl font-bold leading-relaxed">
            {division && (
              <p>
                {t.col.division}: {printValue(division)}
              </p>
            )}
            {className && (
              <p>
                {t.col.class}: {printValue(className)}
              </p>
            )}
          </div>
        </div>
      )}
      <table className="w-full table-fixed border-collapse border border-black text-center">
        <thead>
          <tr>
            {report.columns.map((column) => (
              <th
                key={column.key}
                className={`border border-black px-1 py-2 text-sm font-bold ${column.key === "roll" ? "w-10" : column.key === "registration_no" ? "w-20" : ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.id || row.student_id || index}-${index}`}>
              {report.columns.map((column) => (
                <td
                  key={column.key}
                  className={`border border-black px-1 py-1 text-base break-words ${column.key === "student_name" ? "text-start font-semibold" : ""}`}
                >
                  {printCell(row, column.key) || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
