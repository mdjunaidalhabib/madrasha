import { useEffect } from "react";
import { useBrandingStore } from "../../../store/brandingStore";
import { useAdmitCardDesignStore } from "../../../store/admitCardDesignStore";
import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import { DEFAULT_ADMIT_CARD_RULES } from "../../../utils/documentTemplates";
import AdmitCardClassic from "./admit-card-designs/AdmitCardClassic";
import AdmitCardMinimal from "./admit-card-designs/AdmitCardMinimal";
import AdmitCardArch from "./admit-card-designs/AdmitCardArch";
import AdmitCardCustom from "./admit-card-designs/AdmitCardCustom";

type AdmitCardGridProps = {
  rows: Record<string, any>[];
};

const AdmitCardGrid = ({ rows }: AdmitCardGridProps) => {
  const rulesTemplate = useDocumentTemplate("admit_card_rules", DEFAULT_ADMIT_CARD_RULES);

  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  const design = useAdmitCardDesignStore((s) => s.design);
  const fetchDesign = useAdmitCardDesignStore((s) => s.fetchDesign);

  useEffect(() => {
    fetchBranding();
    fetchDesign();
  }, [fetchBranding, fetchDesign]);

  const madrasaName = branding?.name || "";
  const designKey = design?.admit_card_design || "classic";
  const backgroundImage = design?.admit_card_background_image;

  return (
    <div className="report-admit-card-grid grid gap-4">
      {rows.map((row, index) => {
        const key = `admit-card-${row.id || index}`;

        if (designKey === "minimal") {
          return (
            <AdmitCardMinimal key={key} row={row} madrasaName={madrasaName} rulesTemplate={rulesTemplate} />
          );
        }
        if (designKey === "arch") {
          return (
            <AdmitCardArch key={key} row={row} madrasaName={madrasaName} rulesTemplate={rulesTemplate} />
          );
        }
        if (designKey === "custom" && backgroundImage) {
          return (
            <AdmitCardCustom
              key={key}
              row={row}
              rulesTemplate={rulesTemplate}
              backgroundImage={backgroundImage}
            />
          );
        }
        return (
          <AdmitCardClassic key={key} row={row} madrasaName={madrasaName} rulesTemplate={rulesTemplate} />
        );
      })}
    </div>
  );
};

export default AdmitCardGrid;
