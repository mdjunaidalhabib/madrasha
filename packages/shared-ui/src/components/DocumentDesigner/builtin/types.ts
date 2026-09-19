import type { CanvasBackground, DocumentLayer } from "../types";
import type { BackendDocumentType } from "../documentTypeMap";

/**
 * কোডে লেখা রেডিমেড ডিজাইন (DB টেমপ্লেট নয়)। এগুলো Reports স্ক্রিনের
 * "ডিজাইন" ড্রপডাউনে সরাসরি দেখায় - কোনো seed/migration ছাড়াই, সব মাদরাসায়।
 *
 * `id` সবসময় ঋণাত্মক পূর্ণসংখ্যা - DB টেমপ্লেটের id সবসময় ধনাত্মক, তাই
 * একই `templateId: number` স্লট দিয়ে দুটোকেই আলাদা করা যায় (দেখুন registry.ts)।
 */
export type BuiltinDesign = {
  id: number;
  key: string;
  type: BackendDocumentType;
  name: string;
  description: string;
  /** Design-time canvas size (px). */
  width: number;
  height: number;
  background?: CanvasBackground;
  layers: DocumentLayer[];
  /** true = "ডিফল্ট (সাধারণ)" ডিজাইন - ড্রপডাউনের আলাদা তালিকায় নয়, কোনো ডিজাইন নির্বাচন না থাকলে এটাই ব্যবহৃত হয়। */
  isDefault?: boolean;
};

/**
 * লেটার-ধাঁচের ডকুমেন্টে (সনদ/প্রত্যয়ন/ছাড়পত্র) মূল লেখার জায়গা - এখানে
 * অ্যাডমিনের সেট করা wording টেমপ্লেট (sanad_template ইত্যাদি) বসে, ডিজাইনে
 * আলাদা করে লেখা থাকে না। দেখুন `withBodyTemplate`।
 */
export const BODY_PLACEHOLDER = "{{__body__}}";
