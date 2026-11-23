import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import type { ReportMenuItem } from "../../../features/reports/types";
import { printCell } from "../printFormat";
import { reportText } from "../report.text";
import "./exam-fee-collection.css";

type Props = {
  report: ReportMenuItem;
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
};

// This is a paper collection register. These cells stay blank so a collector
// can fill them by hand; they do not represent stored payments or balances.
const collectionFields = new Set([
  "collection_amount", "collection_signature",
]);

export default function ExamFeeCollectionSheet({
  report, rows, selectedDivisionName, selectedClassName, startIndex = 0, isFirstPage = true,
}: Props) {
  const t = usePrintText(reportText);
  const first = rows[0] || {};
  const exam = [first.exam_name, first.exam_year].filter(Boolean).join(" - ");
  const division = selectedDivisionName || first.division_name;
  const className = selectedClassName || first.class_name;

  return (
    <div className="w-full bg-white text-black">
      {isFirstPage && (
        <div className="report-block-heading mb-3 text-center">
          <h1 className="text-xl font-bold">{report.title}</h1>
          {exam && <p className="mt-1 text-base font-bold">{printCell({ exam }, "exam")}</p>}
          <p className="mt-1 text-base font-bold">
            {division && <span>{t.divisionLabel} {division} </span>}
            {className && <span>{t.classLabel} {className}</span>}
          </p>
        </div>
      )}
      <table className="exam-report-table w-full table-fixed border-collapse border border-black text-center">
        <thead>
          <tr>
            {report.columns.map((column) => (
              <th key={column.key} className={`border border-black px-1 py-2 text-base break-words ${column.className || ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`exam-fee-${row.student_id || row.id || startIndex + index}`}>
              {report.columns.map((column) => (
                <td
                  key={column.key}
                  className={`h-10 border border-black px-1 py-1 text-base break-words ${column.key === "student_name" ? "text-start font-semibold" : ""}`}
                >
                  {collectionFields.has(column.key) ? null : (
                    <span className={`block ${column.key === "student_name" ? "px-2 py-1" : column.key === "roll" ? "whitespace-nowrap" : ""}`}>
                      {printCell(row, column.key)}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
