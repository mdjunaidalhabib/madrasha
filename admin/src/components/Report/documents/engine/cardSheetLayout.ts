import type { PaperSize, Orientation } from "../../../common/DataExportPrintActions";
import type { CardsPerPage } from "../../../../store/selectedTemplateOverrideStore";

/** CSS px → mm (96dpi)। */
export const PX_TO_MM = 25.4 / 96;

/**
 * এক পাতায় "শিট মোডে" (কার্ড কেন্দ্রে/ভাগ করা ঘরে বসে) কয়টি কার্ড - null মানে
 * শিট মোড নয়, স্বাভাবিক ফ্লো-গ্রিড।
 *   - আইডি কার্ড: ১ জন হলে একটি (মাঝখানে); বেশি হলে পুরো কাগজ (মার্জিনসহ) সমান ঘরে ভাগ হয় -
 *     `gridCount` = কাগজে যত ঘর ধরে (দেখুন computeContentGrid); "1"/"2" → সবসময় প্রতি পাতায় ১/২টি।
 *     পিছনের পাতা থাকলে সংখ্যাটা শিক্ষার্থীর - প্রতিজনের সামনে (উপরে) ও পিছন (নিচে) একটি কলামে
 *     বসে, তাই A4 ল্যান্ডস্কেপে auto → ২ কলাম (দুটি A5-এর মতো), বাকি সব কাগজে ১টি।
 *   - প্রবেশপত্র: সবসময় শিট মোড; auto → পোর্ট্রেটে (A4/A5) ২টি (কাগজের দুই অর্ধেকে, মাঝে কাটার-রেখা), ল্যান্ডস্কেপে ১টি।
 */
export const resolveCardsPerSheet = (
  printable: string | undefined,
  option: CardsPerPage,
  rowCount: number,
  paperSize: PaperSize,
  orientation: Orientation,
  hasBack = false,
  gridCount = 1,
): number | null => {
  if (printable === "id-card") {
    if (option === "1") return 1;
    if (option === "2") return 2;
    if (rowCount !== 1) return Math.max(gridCount, 1);
    return hasBack && paperSize === "a4" && orientation === "landscape" ? 2 : 1;
  }

  // পুরস্কার বই-লেবেল: "১টি" ছাড়া সবসময় পুরো কাগজ সমান ঘরে ভাগ - প্রতিটি লেবেলের চার পাশে ফাঁকা ও ঘরের
  // সীমানায় কাটার-রেখা (আইডি কার্ড "সকল শিক্ষার্থী"-র মতো, দেখুন CardSheet/computeContentGrid)।
  if (printable === "book-label") {
    return option === "1" ? 1 : Math.max(gridCount, 1);
  }

  if (printable === "admit-card") {
    // সবসময় স্বয়ংক্রিয় বিন্যাস (কোনো ইউজার-পছন্দ নেই) - A5 ল্যান্ডস্কেপ = ঠিক একটি
    // প্রবেশপত্রের মাপ, বাকি সব কাগজে পোর্ট্রেটে ২টি (উপর-নিচ), ল্যান্ডস্কেপে ১টি।
    if (paperSize === "a5" && orientation === "landscape") return 1;
    return orientation === "portrait" ? 2 : 1;
  }

  return null;
};

/** ১টি কার্ড: কনটেন্ট-বক্সে ঠিক আঁটে এমন স্কেল (≤ 1, কখনো বড় করা হয় না)। */
export const computeSingleScale = (
  contentWidthMm: number,
  contentHeightMm: number,
  cardWidthMm: number,
  cardHeightMm: number,
): number => Math.min(contentWidthMm / cardWidthMm, contentHeightMm / cardHeightMm, 1);

export type PaperSplit = {
  cols: number;
  rows: number;
  /** কাগজের একেকটি টুকরোর (অর্ধেক) মাপ - কাটার-রেখা এই সীমানায়। */
  pieceWidthMm: number;
  pieceHeightMm: number;
  /** কার্ডের উপর প্রয়োগের স্কেল (≤ 1)। */
  scale: number;
};

/** আইডি কার্ড গ্রিডে প্রতিটি কার্ডের চারপাশের ন্যূনতম ফাঁকা (mm) - দুই কার্ডের মাঝে মোট ২× এই ফাঁক,
 * মাঝ বরাবর ডটেড কাটার-রেখা। ২.৮ রাখা হয়েছে যাতে A4 পোর্ট্রেটে (১০ মিমি মার্জিন) ৩ কলাম × ৩ সারি
 * = ৯টি কার্ড এক পাতায় ধরে। */
export const CARD_CUT_PAD_MM = 2.8;

/**
 * অনেক কার্ড (আইডি কার্ড, "সকল শিক্ষার্থী"): পুরো কাগজ (মার্জিনসহ) সমান ঘরে ভাগ হয় - কার্ডের চার পাশে
 * অন্তত `padMm` ফাঁকা রেখে যত কলাম/সারি আঁটে (A4 পোর্ট্রেটে ৩×৩ = ৯টি)। কার্ড ঘরের মাঝখানে বসে, ঘরের
 * সীমানায় কাগজের এক প্রান্ত থেকে অন্য প্রান্ত পর্যন্ত কাটার-রেখা। কার্ড ঘরের চেয়ে বড় হলে স্কেল < ১।
 */
export const computeContentGrid = (
  contentWidthMm: number,
  contentHeightMm: number,
  cardWidthMm: number,
  cardHeightMm: number,
  padMm: number = CARD_CUT_PAD_MM,
) => {
  const cols = Math.max(1, Math.floor(contentWidthMm / (cardWidthMm + 2 * padMm)));
  const rows = Math.max(1, Math.floor(contentHeightMm / (cardHeightMm + 2 * padMm)));
  const cellWidthMm = contentWidthMm / cols;
  const cellHeightMm = contentHeightMm / rows;
  const scale = Math.min(
    (cellWidthMm - 2 * padMm) / cardWidthMm,
    (cellHeightMm - 2 * padMm) / cardHeightMm,
    1,
  );
  return { cols, rows, cellWidthMm, cellHeightMm, scale };
};

/**
 * শিট মোডে ২+ কার্ড: পুরো কাগজকে সমান টুকরোয় ভাগ করে (উপর-নিচ বা পাশাপাশি, যেটায় কার্ড
 * বড় থাকে)। প্রতিটি কার্ড নিজের টুকরোর ঠিক মাঝখানে বসে, চার পাশে অন্তত `marginMm`
 * (পাতার মার্জিন) ফাঁকা রেখে - কাটলে কার্ডের চার পাশে (প্রায়) সমান জায়গা থাকে।
 */
export const computePaperSplit = (
  paperWidthMm: number,
  paperHeightMm: number,
  cardWidthMm: number,
  cardHeightMm: number,
  perPage: number,
  marginMm: number,
): PaperSplit => {
  const build = (cols: number, rows: number): PaperSplit => {
    const pieceWidthMm = paperWidthMm / cols;
    const pieceHeightMm = paperHeightMm / rows;
    const scale = Math.min(
      (pieceWidthMm - 2 * marginMm) / cardWidthMm,
      (pieceHeightMm - 2 * marginMm) / cardHeightMm,
      1,
    );
    return { cols, rows, pieceWidthMm, pieceHeightMm, scale };
  };

  const stacked = build(1, perPage);
  const sideBySide = build(perPage, 1);
  return sideBySide.scale > stacked.scale + 0.001 ? sideBySide : stacked;
};
