import { useEffect, useState } from "react";
import DocumentPreview from "../../DocumentDesigner/DocumentPreview";
import { useDocumentTemplateDefaultStore } from "../../../store/documentTemplateDefaultStore";
import { useBrandingStore } from "../../../store/brandingStore";
import { cellValue, toBanglaDigits } from "../../../utils/reportUtils";
import { useStaggeredReveal } from "../../../hooks/useStaggeredReveal";
import { getTemplate, type TemplateDetailDto } from "../../../services/documentTemplateLibraryApi";

type AdmitCardGridProps = {
  rows: Record<string, any>[];
  // Explicit non-default published template chosen from the Reports screen
  // (ReportFilterBar) - when set, overrides the tenant's effective default
  // fetched below. Null/undefined keeps today's default-lookup behaviour.
  templateId?: number | null;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2 border-b border-dotted border-black/50 pb-1">
    <span className="text-black">{label}</span>
    <b className="text-right text-black">{value}</b>
  </div>
);

/**
 * Renders each row through the tenant's effective ADMIT_CARD template (own
 * default, or SYSTEM default / migrated legacy design) via the generic
 * DocumentDesigner engine - same pattern as IdCardGrid.
 *
 * Unlike IdCardGrid (which renders nothing when no template has ever
 * resolved), this keeps the original fixed black-on-white admit-card layout
 * as an explicit fallback once the fetch has settled and no template was
 * found - so a tenant who hasn't touched the new template system yet never
 * sees a blank admit card.
 */
const AdmitCardGrid = ({ rows, templateId }: AdmitCardGridProps) => {
  const defaultTemplate = useDocumentTemplateDefaultStore((s) => s.defaults.ADMIT_CARD);
  const defaultTemplateLoaded = useDocumentTemplateDefaultStore((s) => s.loaded.ADMIT_CARD);
  const fetchDefault = useDocumentTemplateDefaultStore((s) => s.fetchDefault);
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  const [overrideTemplate, setOverrideTemplate] = useState<TemplateDetailDto | null>(null);
  const [overrideLoaded, setOverrideLoaded] = useState(false);

  useEffect(() => {
    fetchDefault("ADMIT_CARD");
  }, [fetchDefault]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  useEffect(() => {
    if (!templateId) {
      setOverrideTemplate(null);
      setOverrideLoaded(false);
      return;
    }

    let cancelled = false;
    setOverrideLoaded(false);
    getTemplate(templateId)
      .then((detail) => {
        if (!cancelled) {
          setOverrideTemplate(detail);
          setOverrideLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOverrideTemplate(null);
          setOverrideLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const template = templateId ? overrideTemplate : defaultTemplate;
  const templateLoaded = templateId ? overrideLoaded : defaultTemplateLoaded;
  const version = template?.published || template?.draft;

  // rows.length বড় হলে ধাপে ধাপে রেন্ডার হয় - দেখুন useStaggeredReveal
  const revealed = useStaggeredReveal(rows.length);
  const visibleRows = revealed >= rows.length ? rows : rows.slice(0, revealed);
  const progressLine = revealed < rows.length && (
    <p className="no-print mb-2 text-center text-sm text-slate-500 dark:text-slate-400">
      প্রস্তুত হচ্ছে... {toBanglaDigits(revealed)}/{toBanglaDigits(rows.length)}
    </p>
  );

  if (version) {
    return (
      <>
        {progressLine}
        <div className="report-id-card-grid grid justify-center gap-[3mm]">
          {visibleRows.map((row, index) => {
            const key = `admit-card-${row.id || index}`;
            return (
              <DocumentPreview
                key={key}
                className="print-page-break"
                layout={{
                  id: String(template!.id),
                  kind: "admit-card",
                  width: version.width,
                  height: version.height,
                  background: version.background || undefined,
                  layers: version.layers,
                }}
                row={row}
              />
            );
          })}
        </div>
      </>
    );
  }

  // Not yet resolved (still loading) - render nothing this pass rather than
  // flashing the fallback layout, PaginatedReportPreview re-measures once
  // `loaded` flips.
  if (!templateLoaded) return null;

  return (
    <>
      {progressLine}
      <div className="report-admit-card-grid grid gap-4">
        {visibleRows.map((row, index) => {
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
    </>
  );
};

export default AdmitCardGrid;
