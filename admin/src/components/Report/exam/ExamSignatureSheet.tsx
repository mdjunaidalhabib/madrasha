import { printCell, printValue } from "../printFormat";
import { useIsMadrasa, usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../report.text";

type ExamSignatureSheetProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  isFirstPage?: boolean;
  isLastPage?: boolean;
};

const value = (row: Record<string, any>, keys: string[], fallback = "") => {
  for (const key of keys) {
    const current = row?.[key];
    if (current !== null && current !== undefined && current !== "") return printValue(current, key);
  }
  return fallback;
};

// ReportShell narrows `row.subjects` down to just the ReportFilterBar-selected
// subject (see ReportShell's displayRows) - since every student in a class
// shares the same subject list, the first row's (single, once narrowed)
// entry is enough to know which subject this whole sheet is for. "সকল বিষয়"
// leaves `subjects` at its full multi-entry list, so no single name applies.
const getSelectedSubjectName = (row: Record<string, any>): string => {
  const subjects = row?.subjects;
  const list = Array.isArray(subjects)
    ? subjects
    : typeof subjects === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(subjects);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];
  return list.length === 1 ? list[0]?.subject_name || "" : "";
};

const ExamSignatureSheet = ({
  rows,
  selectedClassName = "",
  startIndex = 0,
  isFirstPage = true,
  isLastPage = true,
}: ExamSignatureSheetProps) => {
  const t = usePrintText(reportText);
  const isMadrasa = useIsMadrasa();
  const classCaption = `${isMadrasa ? t.jamat : t.classTerm}${t.colon}`;
  const firstRow = rows[0] || {};
  const examName = value(firstRow, ["exam_name"], "........................");
  const examYear = value(firstRow, ["exam_year", "academic_year"], "........................");
  const className =
    selectedClassName || value(firstRow, ["class_name", "class_name_bn"], t.allClasses);
  const subjectName = getSelectedSubjectName(firstRow);

  return (
    <div className="mx-auto w-full bg-white text-black">
      {isFirstPage && (
      <div className="student-report-heading report-block-heading mb-3 text-center">
        <h1 className="student-report-title text-xl font-bold">{t.title.examSignatureSheet}</h1>
        <p className="student-report-subtitle mt-1 text-base font-bold text-black">
          {examName} - {examYear}
        </p>
        <p className="student-report-subtitle mt-1 text-base font-bold text-black">
          {classCaption} {className}
        </p>
        {subjectName && (
          <p className="student-report-subtitle mt-1 text-base font-bold text-black">
            {t.subjectLabel} {subjectName}
          </p>
        )}
      </div>
      )}

      <table
        className={`exam-report-table w-full table-fixed border-collapse border border-black text-center ${isFirstPage ? "" : "mt-6"}`}
      >
        {isFirstPage && (
        <thead>
          <tr>
            <th className="w-14 border border-black px-1 py-2 text-base">{t.col.roll}</th>
            <th className="w-24 border border-black px-1 py-2 text-base">{t.col.regNo}</th>
            <th className="border border-black px-1 py-2 text-base">{t.col.studentName}</th>
            <th className="w-40 border border-black px-1 py-2 text-base">{t.col.signature}</th>
          </tr>
        </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={`exam-sign-${startIndex + index}-${row.id || row.student_id || index}`}>
              <td className="h-9 border border-black px-1 text-base">{printCell(row, "roll")}</td>
              <td className="h-9 border border-black px-1 text-base">{printCell(row, "registration_no")}</td>
              <td className="h-9 border border-black px-2 text-start text-base font-semibold">
                {printCell(row, "student_name")}
              </td>
              <td className="h-9 border border-black px-1" />
            </tr>
          ))}
        </tbody>
      </table>

      {isLastPage && (
      <div className="exam-report-signature report-block-signature flex justify-end">
        <div className="w-fit border-t border-black px-4 pt-0.5 text-center text-base font-medium text-black">
          {t.sign.examController}
        </div>
      </div>
      )}
    </div>
  );
};

export default ExamSignatureSheet;
