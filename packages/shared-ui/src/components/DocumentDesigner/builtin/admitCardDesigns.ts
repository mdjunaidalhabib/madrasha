import { createKit, type Kit } from "./kit";
import type { BuiltinDesign } from "./types";

/**
 * প্রবেশপত্র - ল্যান্ডস্কেপ 190 × 132 mm (718 × 499 px)।
 *
 * এই মাপে বানানোর কারণ: A4 পোর্ট্রেটে (১০ মিমি মার্জিন, কনটেন্ট 190 × 277) ঠিক
 * ২টি উপর-নিচে বসে - প্রতিটি A4-এর অর্ধেক - আবার A5 ল্যান্ডস্কেপে (৭ মিমি
 * মার্জিন, কনটেন্ট 196 × 134) একটি ১০০% মাপে ঠিকঠাক বসে, স্কেল ছোট করা লাগে না।
 */
export const ADMIT_CARD_WIDTH = 718;
export const ADMIT_CARD_HEIGHT = 499;
const W = ADMIT_CARD_WIDTH;
const H = ADMIT_CARD_HEIGHT;

/** "লেবেল ........ মান" সারি - বাম দিকে লেবেল, ডানে বোল্ড মান, নিচে বিন্দু-রেখা। */
const fieldRow = (
  k: Kit,
  label: string,
  token: string,
  x: number,
  y: number,
  width: number,
  o: { labelW?: number; labelColor?: string; ruleColor?: string; size?: number } = {},
) => {
  const labelW = o.labelW ?? 132;
  return [
    k.text(label, x, y, labelW, 28, { size: 14, color: o.labelColor ?? "#374151", align: "left" }),
    k.text(`: ${token}`, x + labelW, y, width - labelW, 28, {
      size: o.size ?? 16.5,
      align: "left",
      style: { borderBottom: `1px dotted ${o.ruleColor ?? "#6b7280"}` },
    }),
  ];
};

const signatures = (k: Kit, y: number, color: string, ruleColor: string) => [
  k.line(36, y, 200, ruleColor, 1),
  k.text("পরীক্ষার্থীর স্বাক্ষর", 36, y + 4, 200, 20, { size: 13, color }),
  k.line(W - 236, y, 200, ruleColor, 1),
  k.text("পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর", W - 236, y + 4, 200, 20, { size: 13, color }),
];

/** ডিফল্ট - সাদামাটা কালো-সাদা, বর্ডারসহ। */
const plain = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -201,
    key: "admit-plain",
    type: "ADMIT_CARD",
    name: "সাধারণ (ডিফল্ট)",
    description: "সাদামাটা কালো-সাদা প্রবেশপত্র",
    width: W,
    height: H,
    isDefault: true,
    background: { color: "#ffffff" },
    layers: [
      k.rect(4, 4, W - 8, H - 8, "transparent", { stroke: "#111827", strokeWidth: 2 }),
      k.logo(24, 18, 56),
      k.text("{{madrasa_name}}", 92, 16, W - 184, 32, { size: 24, bold: true }),
      k.text("{{madrasa_address}}", 92, 50, W - 184, 20, { size: 12.5, color: "#374151" }),
      k.rect(W / 2 - 100, 82, 200, 34, "transparent", { stroke: "#111827", strokeWidth: 1.5, radius: 4 }),
      k.text("প্রবেশপত্র", W / 2 - 100, 82, 200, 34, { size: 21, bold: true }),
      k.text("{{exam_name}} — {{exam_year}}", 60, 124, W - 120, 24, { size: 16, bold: true }),
      k.line(24, 154, W - 48, "#111827", 1.5),
      ...fieldRow(k, "পরীক্ষার্থীর নাম", "{{student_name}}", 36, 166, 500),
      ...fieldRow(k, "পিতার নাম", "{{father_name}}", 36, 202, 500),
      ...fieldRow(k, "শ্রেণি", "{{class_name}}", 36, 238, 500),
      ...fieldRow(k, "রোল নম্বর", "{{roll}}", 36, 274, 500),
      ...fieldRow(k, "রেজি. নম্বর", "{{registration_no}}", 36, 310, 500),
      ...fieldRow(k, "শিক্ষাবর্ষ", "{{academic_year}}", 36, 346, 500),
      k.photo("image", W - 176, 168, 136, 164, { border: "1px solid #111827" }),
      k.qr("registration_no", W - 156, 342, 96),
      ...signatures(k, 452, "#111827", "#111827"),
    ],
  };
};

/** ফরমাল ব্লু - নেভি হেডার ব্যান্ড, মাঝে পিল-শিরোনাম, হালকা নীল তথ্য-প্যানেল। */
const formalBlue = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -202,
    key: "admit-formal-blue",
    type: "ADMIT_CARD",
    name: "ফরমাল ব্লু",
    description: "নেভি হেডার ব্যান্ড ও তথ্য-প্যানেল",
    width: W,
    height: H,
    background: { color: "#ffffff" },
    layers: [
      k.rect(0, 0, W, 110, "linear-gradient(120deg,#0b2a5b 0%,#1d4ed8 100%)"),
      k.circle(22, 20, 68, "#ffffff", { stroke: "#93c5fd", strokeWidth: 2 }),
      k.logo(30, 28, 52),
      k.text("{{madrasa_name}}", 104, 22, W - 208, 42, { size: 27, bold: true, color: "#ffffff" }),
      k.text("{{madrasa_address}}", 104, 66, W - 208, 22, { size: 13, color: "#c7dcff" }),
      k.rect(W / 2 - 110, 92, 220, 40, "#ffffff", { stroke: "#1d4ed8", strokeWidth: 2, radius: 20 }),
      k.text("প্রবেশপত্র", W / 2 - 110, 92, 220, 40, { size: 22, bold: true, color: "#0b2a5b", spacing: 1 }),
      k.text("{{exam_name}}  —  {{exam_year}}", 60, 140, W - 120, 26, { size: 17, bold: true, color: "#1d4ed8" }),
      k.rect(24, 176, 522, 262, "#f1f6ff", { stroke: "#cfe0ff", strokeWidth: 1, radius: 10 }),
      ...fieldRow(k, "পরীক্ষার্থীর নাম", "{{student_name}}", 44, 188, 486, { labelColor: "#1e3a8a", ruleColor: "#93b4f0" }),
      ...fieldRow(k, "পিতার নাম", "{{father_name}}", 44, 226, 486, { labelColor: "#1e3a8a", ruleColor: "#93b4f0" }),
      ...fieldRow(k, "শ্রেণি", "{{class_name}}", 44, 264, 486, { labelColor: "#1e3a8a", ruleColor: "#93b4f0" }),
      ...fieldRow(k, "রোল নম্বর", "{{roll}}", 44, 302, 486, { labelColor: "#1e3a8a", ruleColor: "#93b4f0" }),
      ...fieldRow(k, "রেজি. নম্বর", "{{registration_no}}", 44, 340, 486, { labelColor: "#1e3a8a", ruleColor: "#93b4f0" }),
      ...fieldRow(k, "শিক্ষাবর্ষ", "{{academic_year}}", 44, 378, 486, { labelColor: "#1e3a8a", ruleColor: "#93b4f0" }),
      k.photo("image", W - 172, 178, 136, 164, { borderRadius: 8, border: "3px solid #1d4ed8" }),
      k.qr("registration_no", W - 152, 352, 92),
      ...signatures(k, 456, "#0b2a5b", "#1d4ed8"),
      k.rect(0, H - 8, W, 8, "#0b2a5b"),
    ],
  };
};

/** ইসলামিক গ্রিন - দ্বৈত সবুজ-সোনালি ফ্রেম, কোণায় অলংকার, বিসমিল্লাহ। */
const islamicGreen = (): BuiltinDesign => {
  const k = createKit();
  const corners = [
    [22, 22],
    [W - 22, 22],
    [22, H - 22],
    [W - 22, H - 22],
  ].map(([cx, cy]) => k.diamond(cx, cy, 12, "#c9a24b"));

  return {
    id: -203,
    key: "admit-islamic-green",
    type: "ADMIT_CARD",
    name: "ইসলামিক গ্রিন",
    description: "সবুজ-সোনালি দ্বৈত ফ্রেম ও বিসমিল্লাহ",
    width: W,
    height: H,
    background: { color: "#fbfaf2" },
    layers: [
      k.rect(8, 8, W - 16, H - 16, "transparent", { stroke: "#0a4d31", strokeWidth: 3 }),
      k.rect(16, 16, W - 32, H - 32, "transparent", { stroke: "#c9a24b", strokeWidth: 1 }),
      ...corners,
      k.text("بسم الله الرحمن الرحيم", 0, 22, W, 26, { size: 18, color: "#8a6a1f" }),
      k.logo(40, 50, 60),
      k.text("{{madrasa_name}}", 110, 48, W - 220, 34, { size: 26, bold: true, color: "#0a4d31" }),
      k.text("{{madrasa_address}}", 110, 84, W - 220, 20, { size: 12.5, color: "#5b6b5f" }),
      k.line(60, 132, 160, "#c9a24b", 1.5),
      k.line(W - 220, 132, 160, "#c9a24b", 1.5),
      k.rect(W / 2 - 120, 114, 240, 38, "#0a4d31", { radius: 4 }),
      k.text("প্রবেশপত্র", W / 2 - 120, 114, 240, 38, { size: 22, bold: true, color: "#ffffff", spacing: 1 }),
      k.text("{{exam_name}}  —  {{exam_year}}", 60, 160, W - 120, 24, { size: 16, bold: true, color: "#8a6a1f" }),
      ...fieldRow(k, "পরীক্ষার্থীর নাম", "{{student_name}}", 44, 194, 492, { labelColor: "#0a4d31", ruleColor: "#c9a24b", size: 17 }),
      ...fieldRow(k, "পিতার নাম", "{{father_name}}", 44, 228, 492, { labelColor: "#0a4d31", ruleColor: "#c9a24b" }),
      ...fieldRow(k, "শ্রেণি", "{{class_name}}", 44, 262, 492, { labelColor: "#0a4d31", ruleColor: "#c9a24b" }),
      ...fieldRow(k, "রোল নম্বর", "{{roll}}", 44, 296, 492, { labelColor: "#0a4d31", ruleColor: "#c9a24b" }),
      ...fieldRow(k, "রেজি. নম্বর", "{{registration_no}}", 44, 330, 492, { labelColor: "#0a4d31", ruleColor: "#c9a24b" }),
      ...fieldRow(k, "শিক্ষাবর্ষ", "{{academic_year}}", 44, 364, 492, { labelColor: "#0a4d31", ruleColor: "#c9a24b" }),
      k.rect(W - 184, 190, 144, 172, "#c9a24b", { radius: 3 }),
      k.photo("image", W - 180, 194, 136, 164, { borderRadius: 2 }),
      k.qr("registration_no", W - 156, 366, 76),
      ...signatures(k, 452, "#0a4d31", "#0a4d31"),
    ],
  };
};

/** মডার্ন সাইডবার - বাঁয়ে টিল প্যানেলে ছবি ও কিউআর, ডানে বড় শিরোনাম ও তথ্য-গ্রিড। */
const modernSidebar = (): BuiltinDesign => {
  const k = createKit();
  const cell = (label: string, token: string, x: number, y: number, w: number) => [
    k.text(label, x, y, w, 16, { size: 11.5, color: "#0f766e", align: "left" }),
    k.text(token, x, y + 16, w, 28, {
      size: 17,
      align: "left",
      style: { borderBottom: "1px solid #b7e4dd" },
    }),
  ];

  return {
    id: -204,
    key: "admit-modern-sidebar",
    type: "ADMIT_CARD",
    name: "মডার্ন সাইডবার",
    description: "বাঁয়ে টিল প্যানেল, ডানে তথ্য-গ্রিড",
    width: W,
    height: H,
    background: { color: "#ffffff" },
    layers: [
      k.rect(0, 0, 214, H, "linear-gradient(180deg,#0f766e 0%,#115e59 100%)"),
      k.circle(77, 22, 60, "#ffffff"),
      k.logo(83, 28, 48),
      k.text("{{madrasa_name}}", 10, 90, 194, 44, { size: 15.5, bold: true, color: "#ffffff", wrap: true, lineHeight: 1.2 }),
      k.photo("image", 45, 144, 124, 150, { borderRadius: 12, border: "4px solid #ffffff" }),
      k.qr("registration_no", 67, 306, 80, { background: "#ffffff", padding: 4, borderRadius: 6 }),
      k.text("শিক্ষাবর্ষ {{academic_year}}", 10, 400, 194, 22, { size: 13.5, color: "#ccfbf1" }),
      k.text("{{madrasa_address}}", 14, 428, 186, 44, { size: 10.5, color: "#99f6e4", wrap: true, lineHeight: 1.25, valign: "top" }),
      k.text("প্রবেশপত্র", 244, 26, 300, 46, { size: 34, bold: true, color: "#134e4a", align: "left" }),
      k.text("{{exam_name}}  —  {{exam_year}}", 244, 76, 440, 24, { size: 16, color: "#4b5563", align: "left" }),
      k.rect(244, 108, 64, 4, "#14b8a6", { radius: 2 }),
      ...cell("পরীক্ষার্থীর নাম", "{{student_name}}", 244, 128, 448),
      ...cell("পিতার নাম", "{{father_name}}", 244, 184, 448),
      ...cell("শ্রেণি", "{{class_name}}", 244, 240, 214),
      ...cell("রোল নম্বর", "{{roll}}", 478, 240, 214),
      ...cell("রেজি. নম্বর", "{{registration_no}}", 244, 296, 448),
      k.line(244, 452, 190, "#134e4a", 1),
      k.text("পরীক্ষার্থীর স্বাক্ষর", 244, 456, 190, 20, { size: 13, color: "#134e4a" }),
      k.line(W - 214, 452, 190, "#134e4a", 1),
      k.text("পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর", W - 214, 456, 190, 20, { size: 13, color: "#134e4a" }),
    ],
  };
};

export const ADMIT_CARD_DESIGNS: BuiltinDesign[] = [plain(), formalBlue(), islamicGreen(), modernSidebar()];
