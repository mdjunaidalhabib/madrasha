import { useEffect } from "react";
import { useBrandingStore } from "../../../store/brandingStore";
import { useBookLabelDesignStore } from "../../../store/bookLabelDesignStore";
import BookLabelClassic from "./book-label-designs/BookLabelClassic";
import BookLabelMinimal from "./book-label-designs/BookLabelMinimal";
import BookLabelArch from "./book-label-designs/BookLabelArch";
import BookLabelCustom from "./book-label-designs/BookLabelCustom";

type BookLabelGridProps = {
  rows: Record<string, any>[];
};

const BookLabelGrid = ({ rows }: BookLabelGridProps) => {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  const design = useBookLabelDesignStore((s) => s.design);
  const fetchDesign = useBookLabelDesignStore((s) => s.fetchDesign);

  useEffect(() => {
    fetchBranding();
    fetchDesign();
  }, [fetchBranding, fetchDesign]);

  const madrasaName = branding?.name || "";
  const designKey = design?.book_label_design || "classic";
  const backgroundImage = design?.book_label_background_image;

  return (
    <div className="report-book-label-grid grid justify-center gap-[3mm]">
      {rows.map((row, index) => {
        const key = `book-label-${row.id || index}`;

        if (designKey === "minimal") {
          return <BookLabelMinimal key={key} row={row} madrasaName={madrasaName} />;
        }
        if (designKey === "arch") {
          return <BookLabelArch key={key} row={row} madrasaName={madrasaName} />;
        }
        if (designKey === "custom" && backgroundImage) {
          return <BookLabelCustom key={key} row={row} backgroundImage={backgroundImage} />;
        }
        return <BookLabelClassic key={key} row={row} madrasaName={madrasaName} />;
      })}
    </div>
  );
};

export default BookLabelGrid;
