import DocumentPreview from "@madrasha/shared-ui/src/components/DocumentDesigner/DocumentPreview";
import type { DocumentLayout } from "@madrasha/shared-ui/src/components/DocumentDesigner/types";
import { usePageContentBoxMm } from "../../pagination/PageGeometryContext";
import { PX_TO_MM, computeSheetCells } from "./cardSheetLayout";

type Row = Record<string, any>;

/** নির্দিষ্ট স্কেলে আঁকা ক্যানভাস - বাইরের বক্সের মাপ স্কেল-করা মাপেই থাকে (CSS transform লেআউট বদলায় না, তাই আলাদা র‍্যাপার)। */
export const ScaledCanvas = ({
  layout,
  row,
  scale,
  className,
}: {
  layout: DocumentLayout;
  row: Row;
  scale: number;
  className?: string;
}) => (
  <div
    className={className}
    style={{ width: layout.width * scale, height: layout.height * scale, overflow: "hidden", flex: "none" }}
  >
    <DocumentPreview layout={layout} row={row} zoom={scale} />
  </div>
);

/**
 * সনদ/প্রত্যয়ন/ছাড়পত্র/মার্কশিটের টেমপ্লেট - পাতার কনটেন্ট-বক্সে ঠিক আঁটে এমন
 * স্কেলে (কখনো বড় নয়) এবং অনুভূমিকভাবে মাঝখানে আঁকে। ডিজাইন কাগজের চেয়ে বড়
 * হলে ডান/নিচ থেকে কেটে যাওয়ার বদলে ছোট হয়ে আঁটে।
 */
export const FittedCanvas = ({ layout, row }: { layout: DocumentLayout; row: Row }) => {
  const box = usePageContentBoxMm();
  const scale = box
    ? Math.min(box.width / (layout.width * PX_TO_MM), box.height / (layout.height * PX_TO_MM), 1)
    : 1;

  return (
    <div className="print-page-break" style={{ display: "flex", justifyContent: "center" }}>
      <ScaledCanvas layout={layout} row={row} scale={scale} />
    </div>
  );
};

type CardSheetProps = {
  layout: DocumentLayout;
  /** এই পাতার কার্ডগুলো (≤ perPage)। */
  rows: Row[];
  perPage: number;
};

/**
 * একটি পাতা = কনটেন্ট-বক্স জুড়ে `perPage` টি সমান ঘর; প্রতিটি কার্ড নিজের ঘরে
 * আঁটে এমন স্কেলে ঠিক মাঝখানে বসে। ১টি হলে পাতার মাঝখানে একটি কার্ড; ২টি হলে
 * মাঝে ডটেড কাটার-রেখাসহ দুটি।
 */
export const CardSheet = ({ layout, rows, perPage }: CardSheetProps) => {
  const box = usePageContentBoxMm();
  if (!box) return null;

  const cardWidthMm = layout.width * PX_TO_MM;
  const cardHeightMm = layout.height * PX_TO_MM;
  const cells = computeSheetCells(box.width, box.height, cardWidthMm, cardHeightMm, perPage);
  const guide = "0.25mm dashed #b8b8b8";

  return (
    <div
      className="report-card-sheet"
      style={{
        display: "grid",
        width: `${box.width}mm`,
        height: `${box.height}mm`,
        gridTemplateColumns: `repeat(${cells.cols}, 1fr)`,
        gridTemplateRows: `repeat(${cells.rows}, 1fr)`,
      }}
    >
      {Array.from({ length: cells.cols * cells.rows }, (_, index) => {
        const row = rows[index];
        const isLast = index === cells.cols * cells.rows - 1;
        return (
          <div
            key={index}
            className="print-page-break"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
              overflow: "hidden",
              ...(isLast ? {} : cells.cols > 1 ? { borderRight: guide } : { borderBottom: guide }),
            }}
          >
            {row && <ScaledCanvas layout={layout} row={row} scale={cells.scale} />}
          </div>
        );
      })}
    </div>
  );
};

export default CardSheet;
