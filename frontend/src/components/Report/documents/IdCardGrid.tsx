import { useEffect, useState } from "react";
import DocumentPreview from "../../DocumentDesigner/DocumentPreview";
import { useDocumentTemplateDefaultStore } from "../../../store/documentTemplateDefaultStore";
import { useStaggeredReveal } from "../../../hooks/useStaggeredReveal";
import { toBanglaDigits } from "../../../utils/reportUtils";
import { getTemplate, type TemplateDetailDto } from "../../../services/documentTemplateLibraryApi";

type IdCardGridProps = {
  rows: Record<string, any>[];
  // Explicit non-default published template chosen from the Reports screen
  // (ReportFilterBar) - when set, overrides the tenant's effective default
  // fetched below. Null/undefined keeps today's default-lookup behaviour.
  templateId?: number | null;
};

/**
 * Renders each row through the tenant's effective ID_CARD template
 * (their own default, or the SYSTEM default if they haven't set one -
 * lazily auto-migrated from their old classic/minimal/arch/custom design
 * on first call) via the generic DocumentDesigner engine, instead of the
 * old hardcoded IdCardClassic/Minimal/Arch/Custom preset components.
 *
 * Reads from the shared documentTemplateDefaultStore (not a local
 * useState) - PaginatedReportPreview's off-screen pagination-measurement
 * pass mounts this component before the async fetch can resolve, and
 * subscribes to the same store to re-measure once it's loaded. See that
 * store's doc-comment for why a local fetch would silently mis-paginate.
 */
const IdCardGrid = ({ rows, templateId }: IdCardGridProps) => {
  const defaultTemplate = useDocumentTemplateDefaultStore((s) => s.defaults.ID_CARD);
  const fetchDefault = useDocumentTemplateDefaultStore((s) => s.fetchDefault);
  const [overrideTemplate, setOverrideTemplate] = useState<TemplateDetailDto | null>(null);

  useEffect(() => {
    fetchDefault("ID_CARD");
  }, [fetchDefault]);

  useEffect(() => {
    if (!templateId) {
      setOverrideTemplate(null);
      return;
    }

    let cancelled = false;
    getTemplate(templateId)
      .then((detail) => {
        if (!cancelled) setOverrideTemplate(detail);
      })
      .catch(() => {
        if (!cancelled) setOverrideTemplate(null);
      });

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const template = templateId ? overrideTemplate : defaultTemplate;
  const version = template?.published || template?.draft;

  // rows.length বড় হলে ধাপে ধাপে রেন্ডার হয় - দেখুন useStaggeredReveal
  const revealed = useStaggeredReveal(rows.length);
  const visibleRows = revealed >= rows.length ? rows : rows.slice(0, revealed);

  if (!version) return null;

  return (
    <>
      {revealed < rows.length && (
        <p className="no-print mb-2 text-center text-sm text-slate-500 dark:text-slate-400">
          প্রস্তুত হচ্ছে... {toBanglaDigits(revealed)}/{toBanglaDigits(rows.length)}
        </p>
      )}
      <div className="report-id-card-grid grid justify-center gap-[3mm]">
        {visibleRows.map((row, index) => {
          const key = `id-card-${row.id || index}`;
          return (
            <DocumentPreview
              key={key}
              className="print-page-break"
              layout={{
                id: String(template!.id),
                kind: "id-card",
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
};

export default IdCardGrid;
