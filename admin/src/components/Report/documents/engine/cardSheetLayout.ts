import type { PaperSize, Orientation } from "../../../common/DataExportPrintActions";
import type { CardsPerPage } from "../../../../store/selectedTemplateOverrideStore";

/** CSS px → mm (96dpi)। */
export const PX_TO_MM = 25.4 / 96;

/** আইডি কার্ড গ্রিডে প্রতিটি কার্ডের চারপাশের ফাঁকা (mm) - দুই কার্ডের মাঝে
 * মোট ২× এই ফাঁক, মাঝ বরাবর ডটেড কাটার-রেখা থাকে। ২.৮ রাখা হয়েছে যাতে A4
 * পোর্ট্রেটে (১০ মিমি মার্জিন) ৩ কলাম × ৩ সারি = ৯টি কার্ড এক পাতায় ধরে। */
export const CUT_PAD_MM = 2.8;

/**
 * এক পাতায় "শিট মোডে" (কার্ড কেন্দ্রে/ভাগ করা ঘরে বসে) কয়টি কার্ড - null মানে
 * শিট মোড নয়, স্বাভাবিক ফ্লো-গ্রিড।
 *   - আইডি কার্ড: auto → ১ জন হলে ১টি (মাঝখানে), বেশি হলে গ্রিড; "1" → সবসময় প্রতি পাতায় ১টি।
 *   - প্রবেশপত্র: সবসময় শিট মোড; auto → A4 পোর্ট্রেটে ২টি (কাগজের অর্ধেক করে), অন্যথায় ১টি।
 */
export const resolveCardsPerSheet = (
  printable: string | undefined,
  option: CardsPerPage,
  rowCount: number,
  paperSize: PaperSize,
  orientation: Orientation,
): number | null => {
  if (printable === "id-card") {
    if (option === "1") return 1;
    if (option === "grid") return null;
    return rowCount === 1 ? 1 : null;
  }

  if (printable === "admit-card") {
    if (option === "1") return 1;
    if (option === "2") return 2;
    return paperSize === "a4" && orientation === "portrait" ? 2 : 1;
  }

  return null;
};

export type SheetCells = {
  cols: number;
  rows: number;
  cellWidthMm: number;
  cellHeightMm: number;
  /** কার্ডের উপর প্রয়োগের স্কেল (≤ 1, কখনো বড় করা হয় না)। */
  scale: number;
};

/** perPage টি কার্ড কনটেন্ট-বক্সে ভাগ করে - ২টির ক্ষেত্রে উপর-নিচ বা পাশাপাশি,
 * যেটায় কার্ডের স্কেল বড় থাকে (সমান হলে উপর-নিচ)। */
export const computeSheetCells = (
  contentWidthMm: number,
  contentHeightMm: number,
  cardWidthMm: number,
  cardHeightMm: number,
  perPage: number,
): SheetCells => {
  const build = (cols: number, rows: number): SheetCells => {
    const cellWidthMm = contentWidthMm / cols;
    const cellHeightMm = contentHeightMm / rows;
    const scale = Math.min(cellWidthMm / cardWidthMm, cellHeightMm / cardHeightMm, 1);
    return { cols, rows, cellWidthMm, cellHeightMm, scale };
  };

  if (perPage <= 1) return build(1, 1);

  const stacked = build(1, perPage);
  const sideBySide = build(perPage, 1);
  return sideBySide.scale > stacked.scale + 0.001 ? sideBySide : stacked;
};
