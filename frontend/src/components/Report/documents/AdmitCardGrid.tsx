import { useEffect } from "react";
import DocumentPreview from "../../DocumentDesigner/DocumentPreview";
import { useDocumentTemplateDefaultStore } from "../../../store/documentTemplateDefaultStore";

type AdmitCardGridProps = {
  rows: Record<string, any>[];
};

/**
 * Renders each row through the tenant's effective ADMIT_CARD template,
 * same reasoning/pattern as IdCardGrid.tsx (including why it reads from
 * the shared documentTemplateDefaultStore instead of a local fetch).
 */
const AdmitCardGrid = ({ rows }: AdmitCardGridProps) => {
  const template = useDocumentTemplateDefaultStore((s) => s.defaults.ADMIT_CARD);
  const fetchDefault = useDocumentTemplateDefaultStore((s) => s.fetchDefault);

  useEffect(() => {
    fetchDefault("ADMIT_CARD");
  }, [fetchDefault]);

  const version = template?.published || template?.draft;
  if (!version) return null;

  return (
    <div className="report-admit-card-grid grid gap-4">
      {rows.map((row, index) => {
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
  );
};

export default AdmitCardGrid;
