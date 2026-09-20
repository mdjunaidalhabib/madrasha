import { FittedCanvas } from "../documents/engine/CardSheet";
import { useBrandedRows, useDocumentLayout } from "../documents/engine/useDocumentLayout";
import { useBrandingStore } from "../../../store/brandingStore";
import { DEFAULT_MARKSHEET_FIELDS } from "../../../services/brandingApi";
import { SIGNATURE_LABELS, getSignatureSettings } from "./marksheetSignatures";
import { cellValue, formatMeritRank, formatReportValue, toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";

type SubjectMark = {
  book_id?: number | string;
  subject_name?: string;
  full_marks?: number | string;
  mark?: number | string | null;
  is_absent?: boolean;
};

type MarksheetListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  // Explicit design chosen from ReportFilterBar (DB template id). Null/undefined = the plain default marksheet below.
  templateId?: number | null;
};

const getSubjects = (row: Record<string, any>): SubjectMark[] => {
  const value = row?.subjects;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

// DOB is stored as a DATE column (no time-of-day meaning), so the UTC
// getters are used deliberately - a local-timezone read (toLocaleDateString)
// can roll the calendar day backward/forward depending on the viewer's
// timezone offset from the midnight-UTC timestamp the API returns.
const formatDob = (value: unknown) => {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return toBanglaDigits(`${day}/${month}/${year}`);
};

// Every field the marksheet's info grid can show, keyed the same way as
// backend/src/modules/settings/settings.constants.ts's MARKSHEET_FIELD_KEYS
// (BrandingSettingsPage's "মার্কশিট তথ্য ফিল্ড" section lets a madrasa toggle/
// reorder these). Original hardcoded order (roll, registration number, DOB,
// name, father, grade, general grade, status, then merit rank last) is
// DEFAULT_MARKSHEET_FIELDS's order - an untouched madrasa renders
// pixel-identical to before.
const INFO_FIELD_DEFS: Record<string, { label: string; value: (row: Record<string, any>) => string }> = {
  roll: { label: "রোল নম্বর", value: (row) => cellValue(row, "roll") },
  registration_no: { label: "রেজিস্ট্রেশন নম্বর", value: (row) => cellValue(row, "registration_no") },
  date_of_birth: { label: "জন্ম তারিখ", value: (row) => formatDob(row?.date_of_birth) },
  student_name: { label: "শিক্ষার্থীর নাম", value: (row) => cellValue(row, "student_name") },
  father_name: { label: "পিতার নাম", value: (row) => cellValue(row, "father_name") },
  madrasa_grade: { label: "ফলাফল বিভাগ", value: (row) => cellValue(row, "madrasa_grade") },
  general_grade: { label: "গ্রেড", value: (row) => cellValue(row, "general_grade") },
  status: { label: "স্ট্যাটাস", value: (row) => cellValue(row, "status") },
  rank_no: { label: "মেধাস্থান", value: (row) => formatMeritRank(row?.rank_no) },
};

// Applies the tenant's saved visibility + order on top of INFO_FIELD_DEFS -
// hidden fields are dropped, everything else renders in the saved order.
const getInfoFields = (row: Record<string, any>, fieldSettings: { key: string; visible: boolean }[]) =>
  fieldSettings
    .filter((field) => field.visible && INFO_FIELD_DEFS[field.key])
    .map((field) => ({ label: INFO_FIELD_DEFS[field.key].label, value: INFO_FIELD_DEFS[field.key].value(row) }));

const SIGNATURE_CELL_CLASS = {
  left: "col-start-1 row-start-1 justify-self-start",
  center: "col-start-2 row-start-1 justify-self-center",
  right: "col-start-3 row-start-1 justify-self-end",
} as const;

const formatMark = (subject: SubjectMark) => {
  if (subject.is_absent) return "অনু";
  const mark = subject.mark;
  return mark === null || mark === undefined || mark === "" ? "—" : formatReportValue(mark);
};

const MarksheetList = ({ rows, isFirstPage = true, isLastPage = true, templateId }: MarksheetListProps) => {
  const row = rows[0] || {};
  const rowStatus = String(row?.status || "").toUpperCase();
  const failed = rowStatus === "FAIL";
  const isAbsent = rowStatus === "ABSENT";
  const subjects = getSubjects(row);

  // ডিফল্ট = নিচের সাধারণ মার্কশিট; ব্যবহারকারী ডিজাইন বেছে নিলে তবেই টেমপ্লেট।
  const { layout, loaded: layoutLoaded } = useDocumentLayout("MARKSHEET", templateId);
  const [brandedRow] = useBrandedRows([row]);
  const marksheetFields = useBrandingStore((s) => s.branding?.marksheet_fields) || DEFAULT_MARKSHEET_FIELDS;
  // Signature toggles + sides share the marksheet_fields list; missing = shown at the default side.
  const visibleSignatures = getSignatureSettings(marksheetFields).filter((signature) => signature.visible);

  if (layout) return <FittedCanvas layout={layout} row={brandedRow} />;

  // Selected DB template still loading - render nothing this pass rather than
  // flashing the fallback layout, PaginatedReportPreview re-measures once
  // it arrives.
  if (!layoutLoaded) return null;

  // Total/average have no per-subject serial or full-marks concept of their
  // own, so their row merges the (ক্রম + বিষয়ের নাম) and (প্রাপ্ত নম্বর +
  // পূর্ণমান) column pairs into two wide cells instead of leaving two of the
  // four columns empty.
  // `average` is already stored as a percentage (total earned / total full
  // marks * 100, see result-panel.service.ts) - this row is labelled and
  // shown as গড় নম্বর (plain average) rather than a "শতকরা (%)" figure,
  // per this madrasa's preference, so no "%" suffix here.
  const percentageValue = cellValue(row, "average");
  const summaryRows = [
    { label: "মোট নম্বর", value: cellValue(row, "total") },
    { label: "গড় নম্বর", value: percentageValue },
  ];

  return (
    <section
      className={`marksheet-card p-6 sm:p-8 ${
        failed ? "bg-red-50" : isAbsent ? "bg-amber-50" : "bg-white"
      }`}
    >
      {isFirstPage && (
        <div className="report-block-heading">
          <div className="border-b-2 border-black pb-3 text-center text-black">
            <h2 className="marksheet-title font-bold text-black">মার্কশিট</h2>
            <p className="mt-1 text-lg font-semibold text-black">শ্রেণিঃ {cellValue(row, "class_name")}</p>
            <p className="mt-1 text-lg font-semibold text-black">
              {cellValue(row, "exam_name")} - {cellValue(row, "exam_year")} ইং
            </p>
          </div>

          <div className="marksheet-info mt-4 grid grid-cols-3 gap-x-6 gap-y-2 px-6 py-3 text-left text-lg text-black">
            {getInfoFields(row, marksheetFields).map((field) => (
              <p key={field.label}>
                <b>{field.label}:</b> {field.value}
              </p>
            ))}
          </div>

          {subjects.length > 0 && (
            <table className="marksheet-table mt-4 w-full border-collapse text-black">
              <thead>
                <tr className="bg-emerald-100 text-emerald-950">
                  <th className="w-12 border border-emerald-400 px-2 py-2 text-center font-bold">ক্রম</th>
                  <th className="border border-emerald-400 px-3 py-2 text-left font-bold">বিষয়ের নাম</th>
                  <th className="w-24 border border-emerald-400 px-3 py-2 text-center font-bold">প্রাপ্ত নম্বর</th>
                  <th className="w-24 border border-emerald-400 px-3 py-2 text-center font-bold">পূর্ণমান</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject, index) => (
                  <tr key={subject.book_id ?? index} className={index % 2 === 0 ? "bg-white" : "bg-emerald-50"}>
                    <td className="border border-emerald-700 px-2 py-2 text-center font-semibold text-emerald-900">
                      {toBanglaDigits(index + 1)}
                    </td>
                    <td className="border border-emerald-700 px-3 py-2 font-medium">{subject.subject_name || "—"}</td>
                    <td className="border border-emerald-700 px-3 py-2 text-center font-bold text-emerald-900">
                      {formatMark(subject)}
                    </td>
                    <td className="border border-emerald-700 px-3 py-2 text-center">
                      {subject.full_marks === undefined || subject.full_marks === null
                        ? "—"
                        : formatReportValue(subject.full_marks)}
                    </td>
                  </tr>
                ))}
                {summaryRows.map((summary, index) => (
                  <tr key={summary.label} className={index === 0 ? "bg-amber-100" : "bg-amber-50"}>
                    <td colSpan={2} className="border border-emerald-700 px-3 py-2 text-base font-bold text-emerald-900">
                      {summary.label}
                    </td>
                    <td colSpan={2} className="border border-emerald-700 px-3 py-2 text-center text-base font-bold">
                      {summary.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {isLastPage && visibleSignatures.length > 0 && (
        <div className="report-block-signature mt-20 marksheet-signatures grid grid-cols-3 gap-x-4 px-12 text-black">
          {/* Each signature sits in the column of its chosen side (বাম/মাঝ/ডান); the side
              padding keeps it off the page edge. The line above each label is exactly as
              wide as the text. */}
          {visibleSignatures.map((signature) => (
            <div key={signature.key} className={SIGNATURE_CELL_CLASS[signature.position]}>
              <div className="whitespace-nowrap border-t border-black px-1 pt-0.5 text-center text-base font-semibold">
                {SIGNATURE_LABELS[signature.key]}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default MarksheetList;
