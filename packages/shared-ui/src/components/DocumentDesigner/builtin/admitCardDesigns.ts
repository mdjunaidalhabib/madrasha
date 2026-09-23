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
  o: { labelW?: number; labelColor?: string; ruleColor?: string; size?: number; labelSize?: number; height?: number } = {},
) => {
  const labelW = o.labelW ?? 132;
  const height = o.height ?? 28;
  return [
    k.text(label, x, y, labelW, height, { size: o.labelSize ?? 14, color: o.labelColor ?? "#374151", align: "left" }),
    k.text(`: ${token}`, x + labelW, y, width - labelW, height, {
      size: o.size ?? 16.5,
      align: "left",
      style: { borderBottom: `1px dotted ${o.ruleColor ?? "#6b7280"}` },
    }),
  ];
};

/** "ডিফল্ট (সাধারণ)" ডিজাইনের তথ্য-ফিল্ড - কোনটা দেখাবে/কোন ক্রমে তা মাদরাসার
 * branding-এ সংরক্ষিত (দেখুন admin/.../brandingApi.ts-এর admit_card_fields,
 * backend/.../settings.constants.ts-এর ADMIT_CARD_FIELD_KEYS - এই তিন জায়গায়
 * একই কী-লিস্ট, MARKSHEET_FIELD_KEYS-এর মতোই)। চারটা বিল্ট-ইন ডিজাইনই এই একই
 * সেটিংস মেনে চলে (দেখুন buildFieldRows ও buildAdmitCardDesign)। */
export const ADMIT_CARD_FIELD_KEYS = [
  "student_name",
  "father_name",
  "class_name",
  "roll",
  "registration_no",
  "academic_year",
] as const;

export type AdmitCardFieldSetting = { key: string; visible: boolean };

export const DEFAULT_ADMIT_CARD_FIELDS: AdmitCardFieldSetting[] = ADMIT_CARD_FIELD_KEYS.map((key) => ({
  key,
  visible: true,
}));

const FIELD_ROW_DEFS: Record<string, { label: string; token: string }> = {
  student_name: { label: "পরীক্ষার্থীর নাম", token: "{{student_name}}" },
  father_name: { label: "পিতার নাম", token: "{{father_name}}" },
  class_name: { label: "শ্রেণি", token: "{{class_name}}" },
  roll: { label: "রোল নম্বর", token: "{{roll}}" },
  registration_no: { label: "রেজি. নম্বর", token: "{{registration_no}}" },
  academic_year: { label: "শিক্ষাবর্ষ", token: "{{academic_year}}" },
};

/** কয়টা ফিল্ড দৃশ্যমান তার ওপর ভিত্তি করে `topY`-`bottomLimit` বাজেট সমান ভাগ হয়ে
 * সারির ফাঁক ও ফন্ট সাইজ বসায় - কম ফিল্ড দেখালে বাকিগুলো এমনিই বড় হয়ে আসে, ৬টাই
 * দেখালে (ডিফল্ট) যতটা বড় নিরাপদে আঁটে ততটাই। চারটা বিল্ট-ইন ডিজাইনই এই একই
 * হেল্পার ব্যবহার করে, শুধু জ্যামিতি/রং আলাদা। */
const buildFieldRows = (
  k: Kit,
  fields: AdmitCardFieldSetting[],
  o: {
    x: number;
    width: number;
    topY: number;
    bottomLimit: number;
    labelW: number;
    maxSpacing?: number;
    maxValueSize?: number;
    labelColor?: string;
    ruleColor?: string;
  },
) => {
  const visibleKeys = fields.filter((f) => f.visible && FIELD_ROW_DEFS[f.key]).map((f) => f.key);
  const count = Math.max(visibleKeys.length, 1);
  const spacing = Math.min(o.maxSpacing ?? 58, (o.bottomLimit - o.topY) / count);
  const rowHeight = spacing - 6;
  const valueSize = Math.min(o.maxValueSize ?? 32, Math.round(rowHeight / 1.3));
  const labelSize = Math.round(valueSize * 0.86);
  return visibleKeys.flatMap((key, index) => {
    const def = FIELD_ROW_DEFS[key];
    return fieldRow(k, def.label, def.token, o.x, o.topY + index * spacing, o.width, {
      size: valueSize,
      labelSize,
      labelW: o.labelW,
      height: rowHeight,
      labelColor: o.labelColor,
      ruleColor: o.ruleColor,
    });
  });
};

/** ডিফল্ট - সাদামাটা কালো-সাদা, বর্ডারসহ। QR ও ছবি নেই (আগে ছিল, বাদ দেওয়া হয়েছে) -
 * তথ্য-ফিল্ড তাই পুরো প্রস্থ জুড়ে বসে। নিচে শুধু মুহতামিমের স্বাক্ষর (আগে
 * পরীক্ষার্থী + পরীক্ষা নিয়ন্ত্রক দুটো ছিল)। */
const plain = (fields: AdmitCardFieldSetting[] = DEFAULT_ADMIT_CARD_FIELDS): BuiltinDesign => {
  const k = createKit();
  const rows = buildFieldRows(k, fields, { x: 36, width: 646, topY: 174, bottomLimit: 446, labelW: 175 });

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
      k.logo(34, 8, 80),
      k.text("{{madrasa_name}}", 124, 12, W - 216, 38, { size: 28, bold: true }),
      k.text("{{madrasa_address}}", 124, 52, W - 216, 22, { size: 18, color: "#374151" }),
      k.rect(W / 2 - 115, 80, 230, 42, "transparent", { stroke: "#111827", strokeWidth: 1.5, radius: 4 }),
      k.text("প্রবেশপত্র", W / 2 - 115, 80, 230, 42, { size: 26, bold: true }),
      k.text("{{exam_name}} — {{exam_year}}", 60, 130, W - 120, 26, { size: 20, bold: true }),
      k.line(24, 160, W - 48, "#111827", 1.5),
      ...rows,
      // ডানপাশে - রেখাটা লেবেলের টেক্সটের প্রস্থের কাছাকাছি (বক্সের মতো চওড়া নয়),
      // তাই টেক্সটের ঠিক নিচেই বসে, আলগা ফাঁকা না রেখে।
      k.line(W - 141, 460, 105, "#111827", 1),
      k.text("মুহতামিমের স্বাক্ষর", W - 141, 464, 105, 20, { size: 18, color: "#111827" }),
    ],
  };
};

/** ফরমাল ব্লু - নেভি হেডার ব্যান্ড, মাঝে পিল-শিরোনাম, হালকা নীল তথ্য-প্যানেল। QR ও
 * ছবি নেই, শুধু মুহতামিমের স্বাক্ষর (ডানে) - plain()-এর মতোই। */
const formalBlue = (fields: AdmitCardFieldSetting[] = DEFAULT_ADMIT_CARD_FIELDS): BuiltinDesign => {
  const k = createKit();
  const rows = buildFieldRows(k, fields, {
    x: 44,
    width: 630,
    topY: 208,
    bottomLimit: 436,
    labelW: 175,
    maxValueSize: 28,
    labelColor: "#1e3a8a",
    ruleColor: "#93b4f0",
  });

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
      k.rect(0, 0, W, 116, "linear-gradient(120deg,#0b2a5b 0%,#1d4ed8 100%)"),
      k.circle(20, 12, 92, "#ffffff", { stroke: "#93c5fd", strokeWidth: 2 }),
      k.logo(28, 20, 76),
      k.text("{{madrasa_name}}", 138, 18, W - 268, 44, { size: 30, bold: true, color: "#ffffff" }),
      k.text("{{madrasa_address}}", 138, 64, W - 268, 24, { size: 16, color: "#c7dcff" }),
      k.rect(W / 2 - 125, 92, 250, 44, "#ffffff", { stroke: "#1d4ed8", strokeWidth: 2, radius: 22 }),
      k.text("প্রবেশপত্র", W / 2 - 125, 92, 250, 44, { size: 25, bold: true, color: "#0b2a5b", spacing: 1 }),
      k.text("{{exam_name}}  —  {{exam_year}}", 60, 150, W - 120, 28, { size: 19, bold: true, color: "#1d4ed8" }),
      k.rect(24, 190, 670, 270, "#f1f6ff", { stroke: "#cfe0ff", strokeWidth: 1, radius: 10 }),
      ...rows,
      k.line(W - 180, 450, 140, "#1d4ed8", 1),
      k.text("মুহতামিমের স্বাক্ষর", W - 180, 454, 140, 20, { size: 18, color: "#0b2a5b" }),
      k.rect(0, H - 8, W, 8, "#0b2a5b"),
    ],
  };
};

/** ইসলামিক গ্রিন - দ্বৈত সবুজ-সোনালি ফ্রেম, কোণায় অলংকার, বিসমিল্লাহ। QR ও ছবি নেই,
 * শুধু মুহতামিমের স্বাক্ষর (ডানে) - plain()-এর মতোই। */
const islamicGreen = (fields: AdmitCardFieldSetting[] = DEFAULT_ADMIT_CARD_FIELDS): BuiltinDesign => {
  const k = createKit();
  const corners = [
    [22, 22],
    [W - 22, 22],
    [22, H - 22],
    [W - 22, H - 22],
  ].map(([cx, cy]) => k.diamond(cx, cy, 12, "#c9a24b"));
  const rows = buildFieldRows(k, fields, {
    x: 44,
    width: 630,
    topY: 210,
    bottomLimit: 440,
    labelW: 175,
    maxValueSize: 28,
    labelColor: "#0a4d31",
    ruleColor: "#c9a24b",
  });

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
      k.text("بسم الله الرحمن الرحيم", 0, 20, W, 28, { size: 19, color: "#8a6a1f" }),
      k.logo(46, 56, 76),
      k.text("{{madrasa_name}}", 134, 54, W - 268, 40, { size: 29, bold: true, color: "#0a4d31" }),
      k.text("{{madrasa_address}}", 134, 96, W - 268, 22, { size: 15, color: "#5b6b5f" }),
      k.line(60, 142, 160, "#c9a24b", 1.5),
      k.line(W - 220, 142, 160, "#c9a24b", 1.5),
      k.rect(W / 2 - 130, 122, 260, 44, "#0a4d31", { radius: 4 }),
      k.text("প্রবেশপত্র", W / 2 - 130, 122, 260, 44, { size: 25, bold: true, color: "#ffffff", spacing: 1 }),
      k.text("{{exam_name}}  —  {{exam_year}}", 60, 172, W - 120, 26, { size: 18, bold: true, color: "#8a6a1f" }),
      ...rows,
      k.line(W - 176, 452, 140, "#0a4d31", 1),
      k.text("মুহতামিমের স্বাক্ষর", W - 176, 456, 140, 20, { size: 18, color: "#0a4d31" }),
    ],
  };
};

/** মডার্ন সাইডবার - বাঁয়ে টিল প্যানেলে বড় লোগো, ডানে বড় শিরোনাম ও তথ্য। QR ও ছবি
 * নেই (আগে টিল প্যানেলে ছিল, বাদ দেওয়ায় লোগো অনেক বড় করে বসানো হয়েছে); নিচে
 * শুধু মুহতামিমের স্বাক্ষর - plain()-এর মতোই। */
const modernSidebar = (fields: AdmitCardFieldSetting[] = DEFAULT_ADMIT_CARD_FIELDS): BuiltinDesign => {
  const k = createKit();
  const SIDEBAR_W = 230;
  const rows = buildFieldRows(k, fields, {
    x: SIDEBAR_W + 26,
    width: W - SIDEBAR_W - 56,
    topY: 132,
    bottomLimit: 440,
    labelW: 170,
    labelColor: "#0f766e",
    ruleColor: "#b7e4dd",
  });

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
      k.rect(0, 0, SIDEBAR_W, H, "linear-gradient(180deg,#0f766e 0%,#115e59 100%)"),
      k.circle(45, 36, 140, "#ffffff"),
      k.logo(57, 48, 116),
      k.text("{{madrasa_name}}", 12, 200, SIDEBAR_W - 24, 72, {
        size: 19,
        bold: true,
        color: "#ffffff",
        wrap: true,
        lineHeight: 1.3,
      }),
      k.text("শিক্ষাবর্ষ {{academic_year}}", 12, 320, SIDEBAR_W - 24, 26, { size: 15, color: "#ccfbf1" }),
      k.text("{{madrasa_address}}", 16, 356, SIDEBAR_W - 32, 100, {
        size: 12,
        color: "#99f6e4",
        wrap: true,
        lineHeight: 1.3,
        valign: "top",
      }),
      k.text("প্রবেশপত্র", SIDEBAR_W + 26, 26, 300, 48, { size: 36, bold: true, color: "#134e4a", align: "left" }),
      k.text("{{exam_name}}  —  {{exam_year}}", SIDEBAR_W + 26, 80, W - SIDEBAR_W - 56, 26, {
        size: 18,
        color: "#4b5563",
        align: "left",
      }),
      k.rect(SIDEBAR_W + 26, 114, 64, 4, "#14b8a6", { radius: 2 }),
      ...rows,
      k.line(W - 150, 452, 110, "#134e4a", 1),
      k.text("মুহতামিমের স্বাক্ষর", W - 150, 456, 110, 20, { size: 16, color: "#134e4a" }),
    ],
  };
};

/** id অনুযায়ী চারটা বিল্ট-ইন প্রবেশপত্র ডিজাইনের যেকোনোটা লাইভ ফিল্ড-সেটিংসসহ বানায় -
 * useDocumentLayout এটাই কল করে ADMIT_CARD-এ কোনো DB টেমপ্লেট বাছা না থাকলে (id
 * null/undefined বা এই চারটার কোনো একটার ঋণাত্মক id)। */
export const buildAdmitCardDesign = (
  id: number | null | undefined,
  fields: AdmitCardFieldSetting[] = DEFAULT_ADMIT_CARD_FIELDS,
): BuiltinDesign => {
  switch (id) {
    case -202:
      return formalBlue(fields);
    case -203:
      return islamicGreen(fields);
    case -204:
      return modernSidebar(fields);
    default:
      return plain(fields);
  }
};

export const ADMIT_CARD_DESIGNS: BuiltinDesign[] = [plain(), formalBlue(), islamicGreen(), modernSidebar()];
