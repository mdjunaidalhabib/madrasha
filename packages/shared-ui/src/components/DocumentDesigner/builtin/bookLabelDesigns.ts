import { createKit } from "./kit";
import type { BuiltinDesign } from "./types";

/**
 * পুরস্কার বই-লেবেল - 92 × 58 mm (348 × 219 px), বইয়ের প্রচ্ছদে সাঁটার ছোট লেবেল।
 * ফিল্ড: {{student_name}}, {{rank_label}} (১ম/২য়...), {{class_info}} (শ্রেণি (বিভাগ) • রোল),
 * {{madrasa_grade}}, {{exam_label}} (পরীক্ষা ও বছর) -
 * দেখুন BookLabelGrid-এর useBookLabelRows।
 */
export const BOOK_LABEL_WIDTH = 348;
export const BOOK_LABEL_HEIGHT = 219;
const W = BOOK_LABEL_WIDTH;
const H = BOOK_LABEL_HEIGHT;

const info = "{{class_info}}";

/** ডিফল্ট - সাদামাটা কালো-সাদা, সরু বর্ডারসহ। */
const plain = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -601,
    key: "book-label-plain",
    type: "BOOK_LABEL",
    name: "সাধারণ (ডিফল্ট)",
    description: "সাদামাটা কালো-সাদা বই-লেবেল",
    width: W,
    height: H,
    isDefault: true,
    background: { color: "#ffffff" },
    layers: [
      k.rect(2, 2, W - 4, H - 4, "transparent", { stroke: "#111827", strokeWidth: 1.5 }),
      k.text("{{madrasa_name}}", 16, 10, W - 32, 26, { size: 18, bold: true }),
      k.text("মেধা পুরস্কার", 16, 36, W - 32, 16, { size: 11 }),
      k.line(16, 58, W - 32, "#111827", 1),
      k.text("{{student_name}}", 16, 70, W - 32, 34, { size: 24, bold: true }),
      k.text(info, 16, 106, W - 32, 20, { size: 13 }),
      k.text("মেধাক্রম: {{rank_label}}   গ্রেড: {{madrasa_grade}}", 16, 130, W - 32, 22, { size: 15, bold: true }),
      k.text("{{exam_label}}", 16, 186, 170, 20, { size: 11.5, align: "left" }),
      k.line(W - 156, 192, 140, "#111827", 1),
      k.text("অধ্যক্ষের স্বাক্ষর", W - 156, 194, 140, 16, { size: 11 }),
    ],
  };
};

/** ধ্রুপদী - মেরুন হেডার ব্যান্ড, মাঝে গোল মেধাক্রম-ব্যাজ, সোনালি ফ্রেম। */
const classic = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -602,
    key: "book-label-classic",
    type: "BOOK_LABEL",
    name: "ধ্রুপদী",
    description: "মেরুন হেডার ও গোল মেধাক্রম-ব্যাজ",
    width: W,
    height: H,
    background: { color: "#fbf6ea" },
    layers: [
      k.rect(3, 3, W - 6, H - 6, "transparent", { stroke: "#8a2632", strokeWidth: 2, radius: 6 }),
      k.rect(8, 8, W - 16, H - 16, "transparent", { stroke: "#cda85f", strokeWidth: 1 }),
      k.rect(9, 9, W - 18, 52, "linear-gradient(180deg,#8a2632,#6c1d27)"),
      k.text("بسم الله الرحمن الرحيم", 9, 12, W - 18, 14, { size: 9.5, color: "#e9c98f" }),
      k.text("{{madrasa_name}}", 20, 26, W - 40, 20, { size: 15, bold: true, color: "#fbf1de" }),
      k.text("মেধা পুরস্কার সনদ", 9, 46, W - 18, 12, { size: 9, color: "#e9c98f", spacing: 1.5 }),
      k.circle(24, 84, 62, "#fbf1de", { stroke: "#8a2632", strokeWidth: 2 }),
      k.text("{{rank_label}}", 24, 98, 62, 24, { size: 19, bold: true, color: "#7a1f2b" }),
      k.text("স্থান", 24, 122, 62, 12, { size: 8.5, color: "#7a1f2b" }),
      k.text("{{student_name}}", 98, 84, W - 112, 30, { size: 20, bold: true, color: "#3d2a1a" }),
      k.text(info, 98, 116, W - 112, 18, { size: 11, color: "#55432c" }),
      k.text("গ্রেড: {{madrasa_grade}}", 148, 138, 100, 20, {
        size: 10.5,
        bold: true,
        color: "#7a1f2b",
        style: { background: "#ffffff", border: "1px solid #cda85f", borderRadius: 10 },
      }),
      k.line(16, 176, W - 32, "#cbb98a", 1),
      k.text("{{exam_label}}", 16, 184, 190, 18, { size: 10, color: "#6a5a3c", align: "left" }),
      k.line(W - 150, 194, 130, "#8a2632", 1),
      k.text("অধ্যক্ষের স্বাক্ষর", W - 150, 196, 130, 14, { size: 9.5, color: "#6a5a3c" }),
    ],
  };
};

/** মিনিমাল - সবুজ শীর্ষ-রেখা, বামে নামের অক্ষর-ব্যাজ, পরিচ্ছন্ন সাদা জমিন। */
const minimal = (): BuiltinDesign => {
  const k = createKit();
  return {
    id: -603,
    key: "book-label-minimal",
    type: "BOOK_LABEL",
    name: "মিনিমাল",
    description: "সবুজ শীর্ষ-রেখা ও পরিচ্ছন্ন বিন্যাস",
    width: W,
    height: H,
    background: { color: "#ffffff" },
    layers: [
      k.rect(1, 1, W - 2, H - 2, "transparent", { stroke: "#d7e4df", strokeWidth: 1, radius: 6 }),
      k.rect(1, 1, W - 2, 8, "#1f6f5c"),
      k.logo(16, 20, 34),
      k.text("{{madrasa_name}}", 58, 20, W - 140, 20, { size: 14, bold: true, color: "#1c2a26", align: "left" }),
      k.text("MERIT PRIZE", 58, 40, W - 140, 12, { size: 8, color: "#6f8c83", align: "left", spacing: 1.5 }),
      k.circle(W - 70, 16, 52, "transparent", { stroke: "#1f6f5c", strokeWidth: 2 }),
      k.text("{{rank_label}}", W - 70, 16, 52, 52, { size: 16, bold: true, color: "#1f6f5c" }),
      k.line(16, 76, W - 32, "#e3ebe8", 1),
      k.text("{{student_name}}", 16, 92, W - 32, 34, { size: 23, bold: true, color: "#1c2a26" }),
      k.text(info, 16, 128, W - 32, 18, { size: 12, color: "#4b5f58" }),
      k.text("গ্রেড: {{madrasa_grade}}", 16, 150, W - 32, 18, { size: 11.5, bold: true, color: "#1f6f5c" }),
      k.text("{{exam_label}}", 16, 190, 190, 18, { size: 10.5, color: "#6f8c83", align: "left" }),
      k.line(W - 150, 198, 130, "#1f6f5c", 1),
      k.text("অধ্যক্ষের স্বাক্ষর", W - 150, 200, 130, 14, { size: 9.5, color: "#4b5f58" }),
    ],
  };
};

/** খিলান - সবুজ-সোনালি দ্বৈত ফ্রেম, কোণায় অলংকার। */
const arch = (): BuiltinDesign => {
  const k = createKit();
  const corners = [
    [16, 16],
    [W - 16, 16],
    [16, H - 16],
    [W - 16, H - 16],
  ].map(([cx, cy]) => k.diamond(cx, cy, 8, "#c9a24b"));
  return {
    id: -604,
    key: "book-label-arch",
    type: "BOOK_LABEL",
    name: "খিলান",
    description: "সবুজ-সোনালি দ্বৈত ফ্রেম ও অলংকার",
    width: W,
    height: H,
    background: { color: "#fbfaf2" },
    layers: [
      k.rect(5, 5, W - 10, H - 10, "transparent", { stroke: "#0a4d31", strokeWidth: 2.5 }),
      k.rect(11, 11, W - 22, H - 22, "transparent", { stroke: "#c9a24b", strokeWidth: 1 }),
      ...corners,
      k.text("{{madrasa_name}}", 24, 20, W - 48, 22, { size: 15, bold: true, color: "#0a4d31" }),
      k.text("মেধা পুরস্কার", 24, 42, W - 48, 14, { size: 10, color: "#8a6a1f", spacing: 1.5 }),
      k.line(60, 62, W - 120, "#c9a24b", 1),
      k.text("{{student_name}}", 24, 72, W - 48, 32, { size: 22, bold: true, color: "#0a4d31" }),
      k.text(info, 24, 106, W - 48, 18, { size: 11.5, color: "#3f5a4c" }),
      k.text("মেধাক্রম: {{rank_label}}   গ্রেড: {{madrasa_grade}}", 24, 128, W - 48, 22, {
        size: 13.5,
        bold: true,
        color: "#8a6a1f",
      }),
      k.text("{{exam_label}}", 26, 176, 180, 18, { size: 10, color: "#3f5a4c", align: "left" }),
      k.line(W - 156, 186, 130, "#0a4d31", 1),
      k.text("অধ্যক্ষের স্বাক্ষর", W - 156, 188, 130, 14, { size: 9.5, color: "#3f5a4c" }),
    ],
  };
};

export const BOOK_LABEL_DESIGNS: BuiltinDesign[] = [plain(), classic(), minimal(), arch()];
