import { useEffect } from "react";
import DocumentPreview from "../../DocumentDesigner/DocumentPreview";
import { useDocumentTemplateDefaultStore } from "../../../store/documentTemplateDefaultStore";

type IdCardGridProps = {
  rows: Record<string, any>[];
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
const IdCardGrid = ({ rows }: IdCardGridProps) => {
  const template = useDocumentTemplateDefaultStore((s) => s.defaults.ID_CARD);
  const fetchDefault = useDocumentTemplateDefaultStore((s) => s.fetchDefault);

  useEffect(() => {
    fetchDefault("ID_CARD");
  }, [fetchDefault]);

  const version = template?.published || template?.draft;
  if (!version) return null;

  return (
    <div className="report-id-card-grid grid justify-center gap-[3mm]">
      {rows.map((row, index) => {
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
  );
};

export default IdCardGrid;
