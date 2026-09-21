import { createKit, type Kit } from "./kit";
import type { DocumentLayer } from "../types";
import type { BuiltinDesign } from "./types";

/**
 * আইডি কার্ড - CR80 পোর্ট্রেট (54 × 85.6 mm = 204 × 324 px), ছাপার পর কেটে
 * ল্যামিনেট করার আসল মাপ। ব্র্যান্ডিং টোকেন ({{madrasa_name}}, {{madrasa_address}},
 * madrasa_logo) রেন্ডারের সময় মাদরাসার সেটিং থেকে row-তে যোগ হয়।
 */
export const ID_CARD_WIDTH = 204;
export const ID_CARD_HEIGHT = 324;
const W = ID_CARD_WIDTH;
const H = ID_CARD_HEIGHT;

/** ডিফল্ট - সাদামাটা, অন্যান্য রিপোর্টের মতো কালো-সাদা। */
const plain = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -101,
    key: "id-plain",
    type: "ID_CARD",
    name: "সাধারণ (ডিফল্ট)",
    description: "সাদামাটা কালো-সাদা আইডি কার্ড",
    width: W,
    height: H,
    isDefault: true,
    background: { color: "#ffffff" },
    layers: [
      k.rect(3, 3, W - 6, H - 6, "transparent", { stroke: "#1f2937", strokeWidth: 1, radius: 6 }),
      k.logo(12, 12, 34),
      k.text("{{madrasa_name}}", 52, 8, 140, 28, { size: 11.5, bold: true, align: "left", wrap: true, lineHeight: 1.12 }),
      k.text("{{madrasa_address}}", 52, 37, 140, 12, { size: 7.5, color: "#4b5563", align: "left" }),
      k.line(12, 54, W - 24, "#1f2937", 1),
      k.text("পরিচয়পত্র", 12, 59, W - 24, 16, { size: 11, bold: true, spacing: 1 }),
      k.photo("image", (W - 84) / 2, 80, 84, 100, { border: "1px solid #1f2937" }),
      k.text("{{student_name}}", 10, 186, W - 20, 34, { size: 14, wrap: true, lineHeight: 1.15 }),
      k.text("শ্রেণি: {{class_name}}", 16, 224, W - 32, 15, { size: 10, align: "left" }),
      k.text("রোল: {{roll}}", 16, 239, W - 32, 15, { size: 10, align: "left" }),
      k.text("রেজি. নং: {{registration_no}}", 16, 254, W - 32, 15, { size: 10, align: "left" }),
      k.text("পিতা: {{father_name}}", 16, 269, W - 32, 15, { size: 10, align: "left" }),
      k.text("মোবাইল: {{guardian_phone}}", 16, 284, W - 32, 15, { size: 10, align: "left" }),
      k.line(12, 304, W - 24, "#9ca3af", 1),
      k.text("সেশন: {{academic_year}}", 12, 306, W - 24, 14, { size: 9, color: "#374151" }),
    ],
  };
};

/** সবুজ ইসলামিক - উপরে গাঢ় সবুজ ব্যান্ড, সোনালি রেখা, গোল ছবি। */
const emerald = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -102,
    key: "id-emerald",
    type: "ID_CARD",
    name: "ইসলামিক গ্রিন",
    description: "গাঢ় সবুজ ব্যান্ড ও সোনালি অলংকরণ",
    width: W,
    height: H,
    background: { color: "#f7faf6" },
    layers: [
      k.rect(0, 0, W, 96, "linear-gradient(135deg,#0a4d31 0%,#137a4c 100%)"),
      k.rect(0, 96, W, 3, "#c9a24b"),
      k.circle(14, 14, 40, "#ffffff", { stroke: "#c9a24b", strokeWidth: 2 }),
      k.logo(19, 19, 30),
      k.text("{{madrasa_name}}", 60, 14, 136, 30, { size: 12.5, bold: true, color: "#ffffff", align: "left", wrap: true, lineHeight: 1.15 }),
      k.text("{{madrasa_address}}", 60, 46, 136, 22, { size: 7.5, color: "#d7efe2", align: "left", wrap: true, lineHeight: 1.2, valign: "top" }),
      k.rect(52, 74, 100, 18, "#c9a24b", { radius: 9 }),
      k.text("পরিচয়পত্র", 52, 74, 100, 18, { size: 10.5, bold: true, color: "#0a4d31", spacing: 1 }),
      k.circle(54, 104, 96, "#ffffff", { stroke: "#c9a24b", strokeWidth: 3 }),
      k.photo("image", 58, 108, 88, 88, { borderRadius: "50%" }),
      k.qr("registration_no", 158, 108, 36, { background: "#ffffff", padding: 2 }),
      k.text("{{student_name}}", 8, 206, W - 16, 30, { size: 14, color: "#0a4d31", wrap: true, lineHeight: 1.15 }),
      k.line(72, 238, 60, "#c9a24b", 1.5),
      k.text("শ্রেণি", 18, 244, 60, 16, { size: 8.5, color: "#6b7280", align: "left" }),
      k.text("{{class_name}}", 78, 244, 112, 16, { size: 10.5, align: "left" }),
      k.text("রোল নং", 18, 260, 60, 16, { size: 8.5, color: "#6b7280", align: "left" }),
      k.text("{{roll}}", 78, 260, 112, 16, { size: 10.5, align: "left" }),
      k.text("রেজি. নং", 18, 276, 60, 16, { size: 8.5, color: "#6b7280", align: "left" }),
      k.text("{{registration_no}}", 78, 276, 112, 16, { size: 10.5, align: "left" }),
      k.text("পিতা", 18, 292, 60, 16, { size: 8.5, color: "#6b7280", align: "left" }),
      k.text("{{father_name}}", 78, 292, 112, 16, { size: 10.5, align: "left" }),
      k.rect(0, 312, W, 12, "#0a4d31"),
      k.text("শিক্ষাবর্ষ {{academic_year}}", 0, 312, W, 12, { size: 8, color: "#ffffff" }),
    ],
  };
};

/** রয়্যাল ব্লু - উপরে বাঁকানো নেভি হেডার, গোলাকৃতি ছবি ফ্রেম, চিপ-ধাঁচের তথ্য। */
const royal = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -103,
    key: "id-royal",
    type: "ID_CARD",
    name: "রয়্যাল ব্লু",
    description: "বাঁকানো নীল হেডার, আধুনিক তথ্য-ব্লক",
    width: W,
    height: H,
    background: { color: "#ffffff" },
    layers: [
      k.circle(-58, -214, 320, "linear-gradient(160deg,#0b2a5b 0%,#1d4ed8 100%)"),
      k.circle(W - 40, -34, 84, "rgba(255,255,255,0.08)"),
      k.circle(82, 8, 40, "#ffffff", { stroke: "#93c5fd", strokeWidth: 2 }),
      k.logo(87, 13, 30),
      k.text("{{madrasa_name}}", 8, 49, W - 16, 28, { size: 11.5, bold: true, color: "#ffffff", wrap: true, lineHeight: 1.1 }),
      k.text("{{madrasa_address}}", 12, 78, W - 24, 11, { size: 7, color: "#c7dcff" }),
      k.photo("image", 58, 92, 88, 88, { borderRadius: 16, border: "4px solid #ffffff", boxShadow: "0 3px 10px rgba(11,42,91,0.35)" }),
      k.text("{{student_name}}", 8, 186, W - 16, 30, { size: 14, color: "#0b2a5b", wrap: true, lineHeight: 1.15 }),
      k.rect(72, 218, 60, 14, "#dbeafe", { radius: 7 }),
      k.text("শিক্ষার্থী", 72, 218, 60, 14, { size: 8.5, color: "#1d4ed8", bold: true }),
      k.rect(12, 238, 88, 30, "#eff6ff", { radius: 6 }),
      k.text("শ্রেণি", 18, 240, 76, 11, { size: 7.5, color: "#64748b", align: "left" }),
      k.text("{{class_name}}", 18, 251, 76, 15, { size: 10.5, align: "left" }),
      k.rect(104, 238, 88, 30, "#eff6ff", { radius: 6 }),
      k.text("রোল", 110, 240, 76, 11, { size: 7.5, color: "#64748b", align: "left" }),
      k.text("{{roll}}", 110, 251, 76, 15, { size: 10.5, align: "left" }),
      k.rect(12, 272, 88, 30, "#eff6ff", { radius: 6 }),
      k.text("রেজি. নং", 18, 274, 76, 11, { size: 7.5, color: "#64748b", align: "left" }),
      k.text("{{registration_no}}", 18, 285, 76, 15, { size: 10.5, align: "left" }),
      k.rect(104, 272, 88, 30, "#eff6ff", { radius: 6 }),
      k.text("পিতা", 110, 274, 76, 11, { size: 7.5, color: "#64748b", align: "left" }),
      k.text("{{father_name}}", 110, 285, 76, 15, { size: 10, align: "left" }),
      k.rect(0, 308, W, 16, "#0b2a5b"),
      k.text("সেশন {{academic_year}}  •  {{guardian_phone}}", 0, 308, W, 16, { size: 8, color: "#ffffff" }),
    ],
  };
};

/** মেরুন গোল্ড - ক্রিম জমিন, দ্বৈত সোনালি ফ্রেম, বিসমিল্লাহ, ঐতিহ্যবাহী ঢঙ। */
const maroon = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -104,
    key: "id-maroon",
    type: "ID_CARD",
    name: "মেরুন গোল্ড",
    description: "ক্রিম জমিনে দ্বৈত সোনালি ফ্রেম",
    width: W,
    height: H,
    background: { color: "#fbf5e6" },
    layers: [
      k.rect(4, 4, W - 8, H - 8, "transparent", { stroke: "#7a1f2b", strokeWidth: 2 }),
      k.rect(9, 9, W - 18, H - 18, "transparent", { stroke: "#c9a24b", strokeWidth: 1 }),
      k.text("بسم الله الرحمن الرحيم", 12, 14, W - 24, 14, { size: 9.5, color: "#7a1f2b" }),
      k.logo(82, 30, 40),
      k.text("{{madrasa_name}}", 14, 72, W - 28, 28, { size: 11.5, bold: true, color: "#7a1f2b", wrap: true, lineHeight: 1.1 }),
      k.text("{{madrasa_address}}", 16, 100, W - 32, 11, { size: 7.5, color: "#6b5b45" }),
      k.line(22, 114, 74, "#c9a24b", 1),
      k.line(108, 114, 74, "#c9a24b", 1),
      k.diamond(W / 2, 114, 7, "#7a1f2b"),
      k.rect(60, 122, 84, 100, "#c9a24b", { radius: 3 }),
      k.photo("image", 63, 125, 78, 94, { borderRadius: 2 }),
      k.text("{{student_name}}", 12, 228, W - 24, 28, { size: 14, color: "#7a1f2b", wrap: true, lineHeight: 1.15 }),
      k.text("শ্রেণি: {{class_name}}   রোল: {{roll}}", 12, 258, W - 24, 14, { size: 9.5, color: "#3b2a1a" }),
      k.text("রেজি. নং: {{registration_no}}", 12, 272, W - 24, 14, { size: 9.5, color: "#3b2a1a" }),
      k.text("পিতা: {{father_name}}", 12, 286, W - 24, 14, { size: 9.5, color: "#3b2a1a" }),
      k.line(22, 304, W - 44, "#c9a24b", 1),
      k.text("শিক্ষাবর্ষ {{academic_year}}", 12, 306, W - 24, 12, { size: 8.5, color: "#7a1f2b" }),
    ],
  };
};

/** আধুনিক টিল - কোনাকুনি কাটা হেডার, তথ্য-চিপ, নিচে ফুটার স্ট্রিপ। */
const modern = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -105,
    key: "id-modern",
    type: "ID_CARD",
    name: "আধুনিক টিল",
    description: "কোনাকুনি হেডার ও তথ্য-চিপ",
    width: W,
    height: H,
    background: { color: "#ffffff" },
    layers: [
      k.rect(0, 0, W, 130, "linear-gradient(135deg,#0f766e 0%,#14b8a6 100%)", {
        style: { clipPath: "polygon(0 0, 100% 0, 100% 62%, 0 100%)" },
      }),
      k.circle(10, 10, 34, "#ffffff"),
      k.logo(13, 13, 28),
      k.text("{{madrasa_name}}", 50, 10, 146, 26, { size: 11.5, bold: true, color: "#ffffff", align: "left", wrap: true, lineHeight: 1.15 }),
      k.text("{{madrasa_address}}", 50, 37, 146, 12, { size: 7.5, color: "#d1faf5", align: "left" }),
      k.photo("image", 58, 62, 88, 106, { borderRadius: 12, border: "3px solid #ffffff", boxShadow: "0 3px 10px rgba(15,118,110,0.35)" }),
      k.text("{{student_name}}", 8, 174, W - 16, 32, { size: 14, color: "#134e4a", wrap: true, lineHeight: 1.15 }),
      k.rect(87, 208, 30, 3, "#14b8a6", { radius: 2 }),
      k.rect(12, 218, 88, 34, "#ecfdf9", { radius: 8 }),
      k.text("শ্রেণি", 20, 221, 74, 11, { size: 7.5, color: "#0f766e", align: "left" }),
      k.text("{{class_name}}", 20, 233, 74, 16, { size: 11, align: "left" }),
      k.rect(104, 218, 88, 34, "#ecfdf9", { radius: 8 }),
      k.text("রোল", 112, 221, 74, 11, { size: 7.5, color: "#0f766e", align: "left" }),
      k.text("{{roll}}", 112, 233, 74, 16, { size: 11, align: "left" }),
      k.rect(12, 258, 88, 34, "#ecfdf9", { radius: 8 }),
      k.text("রেজি. নং", 20, 261, 74, 11, { size: 7.5, color: "#0f766e", align: "left" }),
      k.text("{{registration_no}}", 20, 273, 74, 16, { size: 10.5, align: "left" }),
      k.rect(104, 258, 88, 34, "#ecfdf9", { radius: 8 }),
      k.text("পিতা", 112, 261, 74, 11, { size: 7.5, color: "#0f766e", align: "left" }),
      k.text("{{father_name}}", 112, 273, 74, 16, { size: 10, align: "left" }),
      k.rect(0, 302, W, 22, "#0f766e"),
      k.text("সেশন {{academic_year}}  |  মোবাইল {{guardian_phone}}", 0, 302, W, 22, { size: 8, color: "#ffffff" }),
    ],
  };
};

export const ID_CARD_DESIGNS: BuiltinDesign[] = [plain(), emerald(), royal(), maroon(), modern()];

/** পিছনের পাতা কিছু না বাছলে (ডিফল্ট) এই ডিজাইনটাই ব্যবহৃত হয়। */
export const DEFAULT_ID_CARD_BACK_ID = -111;

type BackTheme = {
  id: number;
  key: string;
  name: string;
  description: string;
  isDefault?: boolean;
  bg: string;
  ink: string;
  muted: string;
  /** বিভাজক রেখার রং। */
  accent: string;
  titleColor: string;
  /** উপরের ব্যান্ডের ফিল (না থাকলে শিরোনামের নিচে শুধু রেখা)। */
  band?: string;
  /** ব্যান্ডের নিচের সরু রঙিন দাগ। */
  bandBar?: string;
  /** নিচের স্ট্রিপের ফিল (না থাকলে শুধু রেখা + লেখা)। */
  strip?: string;
  stripText: string;
  /** ইস্যু/মেয়াদ চিপের পটভূমি। */
  chip: string;
  frames?: (k: Kit) => DocumentLayer[];
};

/**
 * পিছনের পাতা - মাদরাসার নাম (লোগোসহ), কার্ড ইস্যুর তারিখ ও মেয়াদ, হারিয়ে গেলে কাকে
 * ফেরত দিতে হবে, অধ্যক্ষের স্বাক্ষর ও পদবি। ইস্যু/মেয়াদ/স্বাক্ষর/ফেরতের ঠিকানা আসে
 * Talimat → সেটিং → "আইডি কার্ড ব্যাক" পেজ থেকে (row টোকেন id_issue_date, id_expiry_date,
 * principal_signature, principal_title, id_lost_return)। সব থিমে বিন্যাস এক, শুধু রং
 * আলাদা - সামনের ডিজাইনগুলোর সাথে মেলে।
 */
const backDesign = (t: BackTheme): BuiltinDesign => {
  const k = createKit();
  const layers: DocumentLayer[] = [...(t.frames?.(k) ?? [])];

  if (t.band) {
    layers.push(k.rect(0, 0, W, 52, t.band));
    if (t.bandBar) layers.push(k.rect(0, 52, W, 3, t.bandBar));
  }
  layers.push(
    k.circle(10, 9, 34, "#ffffff", { stroke: t.accent, strokeWidth: 1.5 }),
    k.logo(13, 12, 28),
    k.text("{{madrasa_name}}", 50, 6, 146, 40, { size: 11.5, bold: true, color: t.titleColor, align: "left", wrap: true, lineHeight: 1.15 }),
  );
  if (!t.band) layers.push(k.line(12, 54, W - 24, t.accent, 1));

  layers.push(
    k.rect(12, 66, 88, 38, t.chip, { radius: 6 }),
    k.text("ইস্যু তারিখ", 19, 70, 76, 11, { size: 7.5, color: t.muted, align: "left" }),
    k.text("{{id_issue_date}}", 19, 82, 76, 18, { size: 11, bold: true, color: t.ink, align: "left" }),
    k.rect(104, 66, 88, 38, t.chip, { radius: 6 }),
    k.text("মেয়াদ শেষ", 111, 70, 76, 11, { size: 7.5, color: t.muted, align: "left" }),
    k.text("{{id_expiry_date}}", 111, 82, 76, 18, { size: 11, bold: true, color: t.ink, align: "left" }),
    k.line(12, 116, W - 24, t.accent, 1),
    k.text("কার্ড হারিয়ে গেলে ফেরত দিন:", 14, 122, W - 28, 14, { size: 8.5, bold: true, color: t.ink, align: "left" }),
    k.text("{{id_lost_return}}", 14, 138, W - 28, 84, { size: 9, color: t.ink, align: "left", valign: "top", wrap: true, lineHeight: 1.45 }),
    k.text("{{student_name}}\nরেজি. নং: {{registration_no}}", 14, 244, 84, 40, { size: 8, color: t.muted, align: "left", valign: "bottom", wrap: true, lineHeight: 1.35 }),
    k.signature("principal_signature", 108, 236, 80, 38),
    k.line(104, 278, 88, t.muted, 1),
    k.text("{{principal_title}}", 104, 281, 88, 14, { size: 8.5, bold: true, color: t.ink }),
  );

  if (t.strip) layers.push(k.rect(0, 310, W, 14, t.strip));
  else layers.push(k.line(12, 311, W - 24, t.accent, 1));
  layers.push(k.text("শিক্ষাবর্ষ {{academic_year}}", 0, 310, W, 14, { size: 8, color: t.stripText }));

  return {
    id: t.id,
    key: t.key,
    type: "ID_CARD",
    name: t.name,
    description: t.description,
    width: W,
    height: H,
    isDefault: t.isDefault,
    side: "back",
    background: { color: t.bg },
    layers,
  };
};

export const ID_CARD_BACK_DESIGNS: BuiltinDesign[] = [
  backDesign({
    id: DEFAULT_ID_CARD_BACK_ID,
    key: "id-back-plain",
    chip: "#f3f4f6",
    name: "সাধারণ পিছন (ডিফল্ট)",
    description: "সাদামাটা কালো-সাদা পিছনের পাতা",
    isDefault: true,
    bg: "#ffffff",
    ink: "#1f2937",
    muted: "#4b5563",
    accent: "#9ca3af",
    titleColor: "#1f2937",
    stripText: "#374151",
    frames: (k) => [k.rect(3, 3, W - 6, H - 6, "transparent", { stroke: "#1f2937", strokeWidth: 1, radius: 6 })],
  }),
  backDesign({
    id: -112,
    key: "id-back-emerald",
    chip: "#e6f2ea",
    name: "ইসলামিক গ্রিন (পিছন)",
    description: "সবুজ ব্যান্ড ও সোনালি রেখা",
    bg: "#f7faf6",
    ink: "#1f2937",
    muted: "#4b5563",
    accent: "#c9a24b",
    titleColor: "#ffffff",
    band: "linear-gradient(135deg,#0a4d31 0%,#137a4c 100%)",
    bandBar: "#c9a24b",
    strip: "#0a4d31",
    stripText: "#ffffff",
  }),
  backDesign({
    id: -113,
    key: "id-back-royal",
    chip: "#eff6ff",
    name: "রয়্যাল ব্লু (পিছন)",
    description: "নীল ব্যান্ড ও নীল ফুটার",
    bg: "#ffffff",
    ink: "#0f172a",
    muted: "#475569",
    accent: "#93c5fd",
    titleColor: "#ffffff",
    band: "linear-gradient(160deg,#0b2a5b 0%,#1d4ed8 100%)",
    strip: "#0b2a5b",
    stripText: "#ffffff",
  }),
  backDesign({
    id: -114,
    key: "id-back-maroon",
    chip: "#f3e7c9",
    name: "মেরুন গোল্ড (পিছন)",
    description: "ক্রিম জমিনে দ্বৈত সোনালি ফ্রেম",
    bg: "#fbf5e6",
    ink: "#3b2a1a",
    muted: "#6b5b45",
    accent: "#c9a24b",
    titleColor: "#7a1f2b",
    stripText: "#7a1f2b",
    frames: (k) => [
      k.rect(4, 4, W - 8, H - 8, "transparent", { stroke: "#7a1f2b", strokeWidth: 2 }),
      k.rect(9, 9, W - 18, H - 18, "transparent", { stroke: "#c9a24b", strokeWidth: 1 }),
    ],
  }),
  backDesign({
    id: -115,
    key: "id-back-modern",
    chip: "#ecfdf9",
    name: "আধুনিক টিল (পিছন)",
    description: "টিল ব্যান্ড ও ফুটার স্ট্রিপ",
    bg: "#ffffff",
    ink: "#134e4a",
    muted: "#475569",
    accent: "#14b8a6",
    titleColor: "#ffffff",
    band: "linear-gradient(135deg,#0f766e 0%,#14b8a6 100%)",
    strip: "#0f766e",
    stripText: "#ffffff",
  }),
];
