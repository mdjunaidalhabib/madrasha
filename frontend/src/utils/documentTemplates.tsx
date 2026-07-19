import type { ReactNode } from "react";
import { cellValue } from "./reportUtils";

/**
 * Editable document templates (Sanad, Testimonial, Transfer Letter, Admit Card rules).
 *
 * IMPORTANT: only the surrounding *wording* is editable here. Student data
 * (name, class, session, roll, exam...) is never free text — it is always
 * written as a {{token}} inside the template, and getFieldTokens/renderTemplateText
 * always substitutes it from the real student record at render time. Admins
 * can move a token around or delete it, but they can never type a fake value
 * in its place.
 */

export type TemplateToken = { key: string; label: string };

export const SANAD_TOKENS: TemplateToken[] = [
  { key: "student_name", label: "শিক্ষার্থীর নাম" },
  { key: "father_name", label: "পিতার নাম" },
  { key: "mother_name", label: "মাতার নাম" },
  { key: "division_name", label: "বিভাগ" },
  { key: "class_name", label: "শ্রেণি" },
  { key: "academic_year", label: "শিক্ষাবর্ষ/সেশন" },
  { key: "result_summary", label: "ফলাফল" },
];

export const TESTIMONIAL_TOKENS: TemplateToken[] = [
  { key: "student_name", label: "শিক্ষার্থীর নাম" },
  { key: "father_name", label: "পিতার নাম" },
  { key: "division_name", label: "বিভাগ" },
  { key: "class_name", label: "শ্রেণি" },
];

export const TRANSFER_LETTER_TOKENS: TemplateToken[] = [
  { key: "student_name", label: "শিক্ষার্থীর নাম" },
  { key: "father_name", label: "পিতার নাম" },
  { key: "roll", label: "রোল নম্বর" },
  { key: "registration_no", label: "রেজিস্ট্রেশন নম্বর" },
  { key: "division_name", label: "বিভাগ" },
  { key: "class_name", label: "শ্রেণি" },
  { key: "academic_year", label: "শিক্ষাবর্ষ/সেশন" },
];

export const ADMIT_CARD_RULE_TOKENS: TemplateToken[] = [
  { key: "exam_name", label: "পরীক্ষার নাম" },
  { key: "academic_year", label: "শিক্ষাবর্ষ/সেশন" },
];

export const DEFAULT_SANAD_TEMPLATE =
  "এই মর্মে সনদপত্র প্রদান করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, মাতা: {{mother_name}}, অত্র প্রতিষ্ঠানের {{division_name}} বিভাগের {{class_name}} শ্রেণিতে {{academic_year}} শিক্ষাবর্ষে অধ্যয়ন সমাপ্ত করেছে।\n\nপরীক্ষার ফলাফল: {{result_summary}}";

export const DEFAULT_TESTIMONIAL_TEMPLATE =
  "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, অত্র প্রতিষ্ঠানের {{class_name}} শ্রেণির একজন শিক্ষার্থী।\n\nতার আচরণ ও নৈতিক চরিত্র আমাদের জানা মতে সন্তোষজনক।";

export const DEFAULT_TRANSFER_LETTER_TEMPLATE =
  "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, রোল নম্বর: {{roll}}, রেজিস্ট্রেশন নম্বর: {{registration_no}}, অত্র প্রতিষ্ঠানের {{class_name}} শ্রেণির একজন শিক্ষার্থী ছিল এবং {{academic_year}} শিক্ষাবর্ষ পর্যন্ত অত্র প্রতিষ্ঠানে অধ্যয়ন করেছে।\n\nতাকে এই মর্মে ছাড়পত্র প্রদান করা হলো। প্রতিষ্ঠানের কোনো পাওনা তার নিকট নেই।";

export const DEFAULT_ADMIT_CARD_RULES =
  "১. পরীক্ষার হলে অবশ্যই প্রবেশপত্র সাথে আনতে হবে।\n২. নির্ধারিত সময়ের ১৫ মিনিট পূর্বে কেন্দ্রে উপস্থিত হতে হবে।\n৩. পরীক্ষার হলে মোবাইল ফোন বা কোনো ইলেকট্রনিক ডিভাইস আনা সম্পূর্ণ নিষিদ্ধ।\n৪. নকল বা অসদুপায় অবলম্বন করলে পরীক্ষা বাতিল বলে গণ্য হবে।";

const TOKEN_REGEX = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/**
 * Splits a template string on {{token}} placeholders and renders the
 * placeholder portions from the actual row data (bold), while the
 * surrounding wording is rendered exactly as the admin typed it.
 * Placeholders can never display anything other than the real record's value.
 */
export function renderTemplateText(template: string, row: Record<string, any>): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  TOKEN_REGEX.lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${key++}`}>{template.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<b key={`f-${key++}`}>{cellValue(row, match[1])}</b>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.length) {
    parts.push(<span key={`t-${key++}`}>{template.slice(lastIndex)}</span>);
  }
  return parts;
}
