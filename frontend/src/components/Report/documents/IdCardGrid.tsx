import { useEffect } from "react";
import { useBrandingStore } from "../../../store/brandingStore";
import { useIdCardDesignStore } from "../../../store/idCardDesignStore";
import IdCardClassic from "./id-card-designs/IdCardClassic";
import IdCardMinimal from "./id-card-designs/IdCardMinimal";
import IdCardArch from "./id-card-designs/IdCardArch";
import IdCardCustom from "./id-card-designs/IdCardCustom";

type IdCardGridProps = {
  rows: Record<string, any>[];
};

const IdCardGrid = ({ rows }: IdCardGridProps) => {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  const design = useIdCardDesignStore((s) => s.design);
  const fetchDesign = useIdCardDesignStore((s) => s.fetchDesign);

  useEffect(() => {
    fetchBranding();
    fetchDesign();
  }, [fetchBranding, fetchDesign]);

  const madrasaName = branding?.name || "";
  const designKey = design?.id_card_design || "classic";
  const backgroundImage = design?.id_card_background_image;

  return (
    <div className="report-id-card-grid grid justify-center gap-[3mm]">
      {rows.map((row, index) => {
        const key = `id-card-${row.id || index}`;

        if (designKey === "minimal") {
          return <IdCardMinimal key={key} row={row} madrasaName={madrasaName} />;
        }
        if (designKey === "arch") {
          return <IdCardArch key={key} row={row} madrasaName={madrasaName} />;
        }
        if (designKey === "custom" && backgroundImage) {
          return <IdCardCustom key={key} row={row} backgroundImage={backgroundImage} />;
        }
        return <IdCardClassic key={key} row={row} madrasaName={madrasaName} />;
      })}
    </div>
  );
};

export default IdCardGrid;
