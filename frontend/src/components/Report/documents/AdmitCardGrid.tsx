import { useEffect } from "react";
import { useBrandingStore } from "../../../store/brandingStore";
import { cellValue, toBanglaDigits } from "../../../utils/reportUtils";

type AdmitCardGridProps = {
  rows: Record<string, any>[];
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2 border-b border-dotted border-black/50 pb-1">
    <span className="text-black">{label}</span>
    <b className="text-right text-black">{value}</b>
  </div>
);

/**
 * One fixed, plain (non-designer) admit-card layout per student - same
 * black-on-white visual language as MarksheetList/AcademicResultPrint,
 * instead of routing through the Document Designer template engine.
 *
 * Landscape-A5-shaped (fills the page width, ~half the A4 content height)
 * and stacked one column at a time (.report-admit-card-grid) so exactly two
 * land on one A4 sheet, top and bottom, ready to cut in half into two real
 * A5 cards - rather than the old fixed-148mm-wide portrait card, which
 * overflowed a 2-column layout on a 210mm-wide A4 page.
 */
const AdmitCardGrid = ({ rows }: AdmitCardGridProps) => {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return (
    <div className="report-admit-card-grid grid gap-4">
      {rows.map((row, index) => {
        const key = `admit-card-${row.id || index}`;
        const examLine = [cellValue(row, "exam_name"), cellValue(row, "academic_year")]
          .filter((value) => value && value !== "-")
          .join(" - ");

        return (
          <section
            key={key}
            className="print-page-break flex flex-col justify-between border-2 border-black bg-white p-4"
            style={{ minHeight: "135mm" }}
          >
            <div className="border-b-2 border-black pb-2 text-center">
              <p className="text-[9px] text-black">بسم الله الرحمن الرحيم</p>
              {branding?.name && (
                <p className="mt-0.5 text-xs font-bold text-black">{toBanglaDigits(branding.name)}</p>
              )}
              {branding?.address && (
                <p className="text-[10px] text-black">{toBanglaDigits(branding.address)}</p>
              )}
              <h2 className="mt-1 text-lg font-bold text-black">প্রবেশপত্র</h2>
              {examLine && <p className="text-xs font-semibold text-black">{examLine}</p>}
            </div>

            <div className="flex flex-1 items-center gap-6">
              <div className="flex h-[32mm] w-[26mm] shrink-0 items-center justify-center border border-black bg-slate-50">
                {row.image ? (
                  <img src={row.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-slate-400">ছবি</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-2 text-base font-bold text-black">
                  {cellValue(row, "student_name")}
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <Field label="পিতার নাম" value={cellValue(row, "father_name")} />
                  <Field label="রোল নম্বর" value={cellValue(row, "roll")} />
                  <Field label="রেজিস্ট্রেশন নম্বর" value={cellValue(row, "registration_no")} />
                  <Field label="শ্রেণি" value={cellValue(row, "class_name")} />
                  <Field label="বিভাগ" value={cellValue(row, "division_name")} />
                </div>
              </div>
            </div>

            <div className="flex justify-between border-t-2 border-black pt-2 text-xs font-semibold text-black">
              <span>শিক্ষার্থীর স্বাক্ষর</span>
              <span>পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</span>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default AdmitCardGrid;
