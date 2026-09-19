import { createKit } from "./kit";
import { BODY_PLACEHOLDER, type BuiltinDesign } from "./types";
import type { BackendDocumentType } from "../documentTypeMap";

/**
 * লেটার-ধাঁচের ডকুমেন্ট (সনদ / প্রত্যয়ন পত্র / ছাড়পত্র) - A4-এর ১০ মিমি
 * মার্জিনের কনটেন্ট-বক্সের মাপে বানানো, তাই ডিফল্ট মার্জিনে ১০০% মাপে ঠিকঠাক বসে:
 *   - ল্যান্ডস্কেপ (সনদ):   277 × 190 mm = 1047 × 718 px
 *   - পোর্ট্রেট (প্রত্যয়ন/ছাড়পত্র): 190 × 277 mm = 718 × 1047 px
 * মূল লেখা BODY_PLACEHOLDER লেয়ারে বসে - অ্যাডমিনের সেট করা wording টেমপ্লেট থেকে।
 */
type LetterConfig = {
  type: BackendDocumentType;
  /** ঋণাত্মক id-র ভিত্তি (স্টাইল অনুযায়ী -base-1, -base-2, -base-3)। */
  baseId: number;
  keyPrefix: string;
  landscape: boolean;
  title: string;
  /** ডান পাশের স্বাক্ষরের লেবেল। */
  signLabel: string;
  /** স্মারক নং / তারিখ লাইন দেখাবে কিনা (চিঠি-ধাঁচের ডকুমেন্টে)। */
  showRef: boolean;
  names: [string, string, string];
};

const size = (landscape: boolean) =>
  landscape ? { w: 1047, h: 718 } : { w: 718, h: 1047 };

/** শিরোনাম-পরবর্তী মূল লেখার (body) বক্স ও স্বাক্ষর-সারির y। */
const flow = (landscape: boolean, h: number, showRef: boolean) => {
  const bodyY = landscape ? (showRef ? 336 : 316) : showRef ? 372 : 348;
  const signY = h - (landscape ? 118 : 138);
  return { bodyY, signY, bodyH: signY - bodyY - 24 };
};

const bodyStyle = (landscape: boolean) => ({
  size: landscape ? 22 : 21,
  align: "left" as const,
  wrap: true,
  block: true,
  lineHeight: 1.95,
  color: "#1f2937",
  style: { textAlign: "justify" as const, textAlignLast: "left" as const },
});

const gold = (c: LetterConfig): BuiltinDesign => {
  const k = createKit();
  const { w, h } = size(c.landscape);
  const { bodyY, signY, bodyH } = flow(c.landscape, h, c.showRef);
  const pad = 84;
  const ink = "#6b1d1d";

  return {
    id: -(c.baseId + 1),
    key: `${c.keyPrefix}-gold`,
    type: c.type,
    name: c.names[0],
    description: "সোনালি দ্বৈত ফ্রেম, ঐতিহ্যবাহী ঢঙ",
    width: w,
    height: h,
    background: { color: "#fffdf6" },
    layers: [
      k.rect(10, 10, w - 20, h - 20, "transparent", { stroke: "#a67c00", strokeWidth: 3 }),
      k.rect(22, 22, w - 44, h - 44, "transparent", { stroke: "#d4af37", strokeWidth: 1 }),
      k.diamond(22, 22, 14, "#a67c00"),
      k.diamond(w - 22, 22, 14, "#a67c00"),
      k.diamond(22, h - 22, 14, "#a67c00"),
      k.diamond(w - 22, h - 22, 14, "#a67c00"),
      k.logo((w - 460) / 2, (h - 460) / 2, 460, { opacity: 0.05 }),
      k.text("بسم الله الرحمن الرحيم", 0, 48, w, 28, { size: 22, color: "#8a6a1f" }),
      k.logo((w - 64) / 2, 82, 64),
      k.text("{{madrasa_name}}", pad, 146, w - pad * 2, 44, { size: c.landscape ? 31 : 27, bold: true, color: ink, wrap: true, lineHeight: 1.1 }),
      k.text("{{madrasa_address}}", pad, 190, w - pad * 2, 22, { size: 14.5, color: "#6b5b45" }),
      k.line(w / 2 - 190, 232, 170, "#c9a24b", 1.5),
      k.line(w / 2 + 20, 232, 170, "#c9a24b", 1.5),
      k.diamond(w / 2, 232, 9, ink),
      k.text(c.title, pad, 244, w - pad * 2, 58, { size: c.landscape ? 46 : 42, bold: true, color: ink, spacing: 2 }),
      ...(c.showRef
        ? [
            k.text("স্মারক নং: ............................", pad, 306, 320, 22, { size: 15, align: "left", color: "#4b5563" }),
            k.text("তারিখ: ............................", w - pad - 320, 306, 320, 22, { size: 15, align: "right", color: "#4b5563" }),
          ]
        : []),
      k.text(BODY_PLACEHOLDER, pad, bodyY, w - pad * 2, bodyH, bodyStyle(c.landscape)),
      ...(c.showRef ? [] : [k.text("তারিখ: ............................", pad, signY + 36, 300, 22, { size: 15, align: "left", color: "#4b5563" })]),
      k.circle(w / 2 - 48, signY - 28, 96, "transparent", { stroke: "#c9a24b", strokeWidth: 1.5 }),
      k.text("সীল", w / 2 - 48, signY - 28, 96, 96, { size: 14, color: "#c9a24b" }),
      k.line(w - pad - 250, signY + 28, 250, ink, 1),
      k.text(c.signLabel, w - pad - 250, signY + 34, 250, 24, { size: 15, color: ink }),
    ],
  };
};

const green = (c: LetterConfig): BuiltinDesign => {
  const k = createKit();
  const { w, h } = size(c.landscape);
  const { bodyY, signY, bodyH } = flow(c.landscape, h, c.showRef);
  const pad = 86;
  const ink = "#0a4d31";

  return {
    id: -(c.baseId + 2),
    key: `${c.keyPrefix}-green`,
    type: c.type,
    name: c.names[1],
    description: "সবুজ ব্যান্ড ও ফ্রেম, বাম-সারিবদ্ধ হেডার",
    width: w,
    height: h,
    background: { color: "#f7fbf8" },
    layers: [
      k.rect(0, 0, w, 26, "linear-gradient(90deg,#0a4d31,#137a4c)"),
      k.rect(0, h - 26, w, 26, "linear-gradient(90deg,#137a4c,#0a4d31)"),
      k.rect(0, 26, w, 3, "#c9a24b"),
      k.rect(0, h - 29, w, 3, "#c9a24b"),
      k.rect(44, 52, w - 88, h - 104, "transparent", { stroke: ink, strokeWidth: 2 }),
      k.rect(52, 60, w - 104, h - 120, "transparent", { stroke: "#9ccbb0", strokeWidth: 1 }),
      k.logo((w - 420) / 2, (h - 420) / 2, 420, { opacity: 0.05 }),
      k.logo(pad, 84, 84),
      k.text("{{madrasa_name}}", pad + 104, 78, w - pad * 2 - 104, 56, { size: c.landscape ? 32 : 25, bold: true, color: ink, align: "left", wrap: true, lineHeight: 1.1 }),
      k.text("{{madrasa_address}}", pad + 104, 138, w - pad * 2 - 104, 24, { size: 15, color: "#4b6b58", align: "left" }),
      k.line(pad, 186, w - pad * 2, "#c9a24b", 2),
      k.rect(w / 2 - 200, 206, 400, 56, ink, { radius: 6 }),
      k.text(c.title, w / 2 - 200, 206, 400, 56, { size: c.landscape ? 34 : 32, bold: true, color: "#ffffff", spacing: 2 }),
      ...(c.showRef
        ? [
            k.text("স্মারক নং: ............................", pad, 282, 320, 22, { size: 15, align: "left", color: "#4b5563" }),
            k.text("তারিখ: ............................", w - pad - 320, 282, 320, 22, { size: 15, align: "right", color: "#4b5563" }),
          ]
        : []),
      k.text(BODY_PLACEHOLDER, pad, bodyY - (c.showRef ? 24 : 0), w - pad * 2, bodyH + (c.showRef ? 24 : 0), bodyStyle(c.landscape)),
      ...(c.showRef ? [] : [k.text("তারিখ: ............................", pad, signY + 36, 300, 22, { size: 15, align: "left", color: "#4b5563" })]),
      k.line(w - pad - 250, signY + 28, 250, ink, 1),
      k.text(c.signLabel, w - pad - 250, signY + 34, 250, 24, { size: 15, color: ink }),
      k.text("(সীল)", w - pad - 250, signY - 8, 250, 24, { size: 13, color: "#9ca3af" }),
    ],
  };
};

const blue = (c: LetterConfig): BuiltinDesign => {
  const k = createKit();
  const { w, h } = size(c.landscape);
  const { bodyY, signY, bodyH } = flow(c.landscape, h, c.showRef);
  const left = 112;
  const right = 64;
  const ink = "#0b2a5b";

  return {
    id: -(c.baseId + 3),
    key: `${c.keyPrefix}-blue`,
    type: c.type,
    name: c.names[2],
    description: "বাম পাশে নেভি স্ট্রিপ, আধুনিক বাম-সারিবদ্ধ বিন্যাস",
    width: w,
    height: h,
    background: { color: "#ffffff" },
    layers: [
      k.rect(0, 0, 58, h, "linear-gradient(180deg,#0b2a5b,#1d4ed8)"),
      k.rect(58, 0, 5, h, "#c9a24b"),
      k.logo((w - 420) / 2 + 30, (h - 420) / 2, 420, { opacity: 0.045 }),
      k.logo(left, 52, 78),
      k.text("{{madrasa_name}}", left + 96, 50, w - left - right - 96, 48, { size: c.landscape ? 31 : 24, bold: true, color: ink, align: "left", wrap: true, lineHeight: 1.1 }),
      k.text("{{madrasa_address}}", left + 96, 102, w - left - right - 96, 24, { size: 15, color: "#475569", align: "left" }),
      k.line(left, 148, w - left - right, "#cbd5e1", 1),
      k.text(c.title, left, 178, w - left - right, 60, { size: c.landscape ? 46 : 42, bold: true, color: ink, align: "left" }),
      k.rect(left, 244, 84, 5, "#1d4ed8", { radius: 3 }),
      ...(c.showRef
        ? [
            k.text("স্মারক নং: ............................", left, 272, 320, 22, { size: 15, align: "left", color: "#64748b" }),
            k.text("তারিখ: ............................", w - right - 320, 272, 320, 22, { size: 15, align: "right", color: "#64748b" }),
          ]
        : []),
      k.text(BODY_PLACEHOLDER, left, bodyY - (c.showRef ? 30 : 0) , w - left - right, bodyH + (c.showRef ? 30 : 0), bodyStyle(c.landscape)),
      ...(c.showRef ? [] : [k.text("তারিখ: ............................", left, signY + 36, 300, 22, { size: 15, align: "left", color: "#64748b" })]),
      k.line(w - right - 250, signY + 28, 250, ink, 1),
      k.text(c.signLabel, w - right - 250, signY + 34, 250, 24, { size: 15, color: ink }),
      k.text("(সীল)", w - right - 250, signY - 8, 250, 24, { size: 13, color: "#9ca3af" }),
    ],
  };
};

const build = (c: LetterConfig) => [gold(c), green(c), blue(c)];

export const CERTIFICATE_DESIGNS = build({
  type: "CERTIFICATE",
  baseId: 300,
  keyPrefix: "cert",
  landscape: true,
  title: "সনদপত্র",
  signLabel: "প্রধান শিক্ষকের স্বাক্ষর",
  showRef: false,
  names: ["স্বর্ণালী সনদ", "সবুজ ইসলামিক সনদ", "রয়্যাল ব্লু সনদ"],
});

export const TESTIMONIAL_DESIGNS = build({
  type: "TESTIMONIAL",
  baseId: 400,
  keyPrefix: "testimonial",
  landscape: false,
  title: "প্রত্যয়ন পত্র",
  signLabel: "প্রধান শিক্ষকের স্বাক্ষর",
  showRef: true,
  names: ["স্বর্ণালী প্রত্যয়ন", "সবুজ ইসলামিক প্রত্যয়ন", "রয়্যাল ব্লু প্রত্যয়ন"],
});

export const TRANSFER_LETTER_DESIGNS = build({
  type: "CLEARANCE_CERTIFICATE",
  baseId: 500,
  keyPrefix: "transfer",
  landscape: false,
  title: "ছাড়পত্র",
  signLabel: "প্রধান শিক্ষকের স্বাক্ষর",
  showRef: true,
  names: ["স্বর্ণালী ছাড়পত্র", "সবুজ ইসলামিক ছাড়পত্র", "রয়্যাল ব্লু ছাড়পত্র"],
});
