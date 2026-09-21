import DocumentPreview from "@madrasha/shared-ui/src/components/DocumentDesigner/DocumentPreview";
import type { DocumentLayout } from "@madrasha/shared-ui/src/components/DocumentDesigner/types";
import { usePageContentBoxMm, usePageSheetMm } from "../../pagination/PageGeometryContext";
import { PX_TO_MM, computeContentGrid, computePaperSplit, computeSingleScale } from "./cardSheetLayout";

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
  /** আইডি কার্ডের পিছনের পাতা - থাকলে (একক শিক্ষার্থী, "দুই পাশ") প্রথম row-র সামনে + পিছন জোড়া বেঁধে মাঝখানে বসে, পাতা ভাগ হয় না। */
  backLayout?: DocumentLayout | null;
};

const GUIDE = "0.25mm dashed #b8b8b8";

/** সামনে ও পিছনের মাঝের ফাঁক (mm) - কাছাকাছি, কিন্তু ছাঁটার মতো যথেষ্ট জায়গা রেখে। A5 পোর্ট্রেট
 * (কাগজের প্রস্থ ≤ ১৫০ মিমি; A4 ল্যান্ডস্কেপের ২-আপ অর্ধেকও) জায়গা কম, তাই ফাঁক ছোট। */
const PAIR_GAP_MM = 12;
const PAIR_GAP_A5_PORTRAIT_MM = 6;
const A5_PORTRAIT_MAX_PAPER_WIDTH_MM = 150;

/**
 * সামনে + পিছনের জোড়া ("দুই পাশ"): পাতা ভাগ হয় না, কাটার-রেখাও নেই - দুটি কার্ড পাশাপাশি/উপর-নিচে
 * কাছাকাছি (PAIR_GAP_MM ফাঁকে) একটি জোড়া হয়ে পাতার কনটেন্ট-বক্সের মাঝখানে বসে। পোর্ট্রেটে উপরে সামনে,
 * নিচে পিছনে; ল্যান্ডস্কেপে সামনে বাঁয়ে, পিছন ডানে (যেটায় কার্ড বড় থাকে সেটাই, সমান হলে পাতার দিক অনুযায়ী)।
 */
const CardPairSheet = ({
  layout,
  backLayout,
  row,
}: {
  layout: DocumentLayout;
  backLayout: DocumentLayout;
  row: Row;
}) => {
  const box = usePageContentBoxMm();
  const sheet = usePageSheetMm();
  if (!box || !sheet) return null;

  const gapMm = sheet.paperWidth <= A5_PORTRAIT_MAX_PAPER_WIDTH_MM ? PAIR_GAP_A5_PORTRAIT_MM : PAIR_GAP_MM;
  const cardWidthMm = layout.width * PX_TO_MM;
  const cardHeightMm = layout.height * PX_TO_MM;
  const fit = (pairWidthMm: number, pairHeightMm: number) =>
    Math.min(box.width / pairWidthMm, box.height / pairHeightMm, 1);
  const stackedScale = fit(cardWidthMm, cardHeightMm * 2 + gapMm);
  const sideScale = fit(cardWidthMm * 2 + gapMm, cardHeightMm);
  const sideBySide =
    sideScale > stackedScale + 0.001 || (Math.abs(sideScale - stackedScale) <= 0.001 && box.width > box.height);
  const scale = sideBySide ? sideScale : stackedScale;

  return (
    <div
      className="report-card-sheet"
      style={{
        display: "flex",
        flexDirection: sideBySide ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: `${gapMm * scale}mm`,
        width: `${box.width}mm`,
        height: `${box.height}mm`,
      }}
    >
      {[layout, backLayout].map((cardLayout, slot) => (
        <div key={slot} className="print-page-break">
          <ScaledCanvas layout={cardLayout} row={row} scale={scale} />
        </div>
      ))}
    </div>
  );
};

/**
 * একটি পাতা = `perPage` টি কার্ড। ১টি হলে কনটেন্ট-বক্সের মাঝখানে একটি কার্ড। ২টি হলে
 * পুরো কাগজ (মার্জিনসহ) সমান দুই অর্ধেকে ভাগ হয়, প্রতিটি কার্ড নিজের অর্ধেকের ঠিক
 * মাঝখানে বসে - চার পাশে অন্তত পাতার মার্জিন পরিমাণ ফাঁকা, আর মাঝ বরাবর কাগজ-জোড়া
 * ডটেড কাটার-রেখা; ফলে কাটলে চার পাশে (প্রায়) সমান জায়গা থাকে, যেকোনো কাগজে।
 */
export const CardSheet = ({ layout, rows, perPage, backLayout }: CardSheetProps) => {
  const box = usePageContentBoxMm();
  const sheet = usePageSheetMm();
  if (!box || !sheet) return null;

  if (backLayout && rows[0]) return <CardPairSheet layout={layout} backLayout={backLayout} row={rows[0]} />;

  const cardWidthMm = layout.width * PX_TO_MM;
  const cardHeightMm = layout.height * PX_TO_MM;
  const guide = GUIDE;

  if (perPage <= 1) {
    const scale = computeSingleScale(box.width, box.height, cardWidthMm, cardHeightMm);
    return (
      <div
        className="report-card-sheet"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: `${box.width}mm`,
          height: `${box.height}mm`,
        }}
      >
        {rows[0] && (
          <div className="print-page-break">
            <ScaledCanvas layout={layout} row={rows[0]} scale={scale} />
          </div>
        )}
      </div>
    );
  }

  // ২টির বেশি = আইডি কার্ডের গ্রিড: পুরো কাগজ (মার্জিনসহ) সমান ঘরে ভাগ (যত কলাম × সারি আঁটে)।
  // কাগজের কোণ থেকে মাপা ঘর → কনটেন্ট-বক্সের কোণ থেকে মাপে রূপান্তর (offsetLeft/Top)।
  if (perPage > 2) {
    const grid = computeContentGrid(sheet.paperWidth, sheet.paperHeight, cardWidthMm, cardHeightMm);
    const gridScaledWidth = cardWidthMm * grid.scale;
    const gridScaledHeight = cardHeightMm * grid.scale;
    return (
      <div
        className="report-card-sheet"
        style={{ position: "relative", width: `${box.width}mm`, height: `${box.height}mm` }}
      >
        {Array.from({ length: grid.cols * grid.rows }, (_, index) => {
          const row = rows[index];
          if (!row) return null;
          const left =
            (index % grid.cols) * grid.cellWidthMm + (grid.cellWidthMm - gridScaledWidth) / 2 - sheet.offsetLeft;
          const top =
            Math.floor(index / grid.cols) * grid.cellHeightMm +
            (grid.cellHeightMm - gridScaledHeight) / 2 -
            sheet.offsetTop;
          return (
            <div
              key={index}
              className="print-page-break"
              style={{ position: "absolute", left: `${left}mm`, top: `${top}mm` }}
            >
              <ScaledCanvas layout={layout} row={row} scale={grid.scale} />
            </div>
          );
        })}
        {Array.from({ length: grid.cols - 1 }, (_, i) => (
          <div
            key={`v${i}`}
            aria-hidden
            style={{
              position: "absolute",
              top: `${-sheet.offsetTop}mm`,
              height: `${sheet.paperHeight}mm`,
              left: `${(i + 1) * grid.cellWidthMm - sheet.offsetLeft}mm`,
              borderLeft: guide,
            }}
          />
        ))}
        {Array.from({ length: grid.rows - 1 }, (_, i) => (
          <div
            key={`h${i}`}
            aria-hidden
            style={{
              position: "absolute",
              left: `${-sheet.offsetLeft}mm`,
              width: `${sheet.paperWidth}mm`,
              top: `${(i + 1) * grid.cellHeightMm - sheet.offsetTop}mm`,
              borderTop: guide,
            }}
          />
        ))}
      </div>
    );
  }

  const split = computePaperSplit(sheet.paperWidth, sheet.paperHeight, cardWidthMm, cardHeightMm, perPage, sheet.margin);
  const scaledWidthMm = cardWidthMm * split.scale;
  const scaledHeightMm = cardHeightMm * split.scale;

  return (
    <div
      className="report-card-sheet"
      style={{ position: "relative", width: `${box.width}mm`, height: `${box.height}mm` }}
    >
      {Array.from({ length: split.cols * split.rows }, (_, index) => {
        const row = rows[index];
        if (!row) return null;
        const col = index % split.cols;
        const line = Math.floor(index / split.cols);
        // কাগজের কোণ থেকে মাপা টুকরোর কেন্দ্র → কনটেন্ট-বক্সের কোণ থেকে মাপে রূপান্তর।
        const left = (col + 0.5) * split.pieceWidthMm - scaledWidthMm / 2 - sheet.offsetLeft;
        const top = (line + 0.5) * split.pieceHeightMm - scaledHeightMm / 2 - sheet.offsetTop;
        return (
          <div
            key={index}
            className="print-page-break"
            style={{ position: "absolute", left: `${left}mm`, top: `${top}mm` }}
          >
            <ScaledCanvas layout={layout} row={row} scale={split.scale} />
          </div>
        );
      })}
      {/* টুকরোর সীমানায় কাগজের এক প্রান্ত থেকে অন্য প্রান্ত পর্যন্ত কাটার-রেখা */}
      {Array.from({ length: split.cols - 1 }, (_, i) => (
        <div
          key={`v${i}`}
          aria-hidden
          style={{
            position: "absolute",
            top: `${-sheet.offsetTop}mm`,
            height: `${sheet.paperHeight}mm`,
            left: `${(i + 1) * split.pieceWidthMm - sheet.offsetLeft}mm`,
            borderLeft: guide,
          }}
        />
      ))}
      {Array.from({ length: split.rows - 1 }, (_, i) => (
        <div
          key={`h${i}`}
          aria-hidden
          style={{
            position: "absolute",
            left: `${-sheet.offsetLeft}mm`,
            width: `${sheet.paperWidth}mm`,
            top: `${(i + 1) * split.pieceHeightMm - sheet.offsetTop}mm`,
            borderTop: guide,
          }}
        />
      ))}
    </div>
  );
};

export default CardSheet;
