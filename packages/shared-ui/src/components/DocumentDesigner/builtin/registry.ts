import type { DocumentLayer } from "../types";
import type { BackendDocumentType } from "../documentTypeMap";
import { DEFAULT_ID_CARD_BACK_ID, ID_CARD_BACK_DESIGNS, ID_CARD_DESIGNS } from "./idCardDesigns";
import { ADMIT_CARD_DESIGNS } from "./admitCardDesigns";
import { BOOK_LABEL_DESIGNS } from "./bookLabelDesigns";
import { CERTIFICATE_DESIGNS, TESTIMONIAL_DESIGNS, TRANSFER_LETTER_DESIGNS } from "./letterDesigns";
import { BODY_PLACEHOLDER, type BuiltinDesign } from "./types";

export { BODY_PLACEHOLDER };
export type { BuiltinDesign };

export { DEFAULT_ID_CARD_BACK_ID };

const ALL_DESIGNS: BuiltinDesign[] = [
  ...ID_CARD_DESIGNS,
  ...ID_CARD_BACK_DESIGNS,
  ...ADMIT_CARD_DESIGNS,
  ...CERTIFICATE_DESIGNS,
  ...TESTIMONIAL_DESIGNS,
  ...TRANSFER_LETTER_DESIGNS,
  ...BOOK_LABEL_DESIGNS,
];

const BY_ID = new Map(ALL_DESIGNS.map((design) => [design.id, design]));

/** DB টেমপ্লেটের id সবসময় ধনাত্মক; বিল্ট-ইন ডিজাইনের id সবসময় ঋণাত্মক। */
export const isBuiltinDesignId = (id: number | null | undefined): id is number =>
  typeof id === "number" && id < 0;

export const getBuiltinDesign = (id: number | null | undefined): BuiltinDesign | null =>
  isBuiltinDesignId(id) ? (BY_ID.get(id) ?? null) : null;

/** ড্রপডাউনে দেখানোর ডিজাইন-তালিকা (ডিফল্ট "সাধারণ" ডিজাইন বাদে - সেটা আলাদা অপশন)। */
export const listBuiltinDesigns = (type: BackendDocumentType): BuiltinDesign[] =>
  ALL_DESIGNS.filter((design) => design.type === type && design.side !== "back" && !design.isDefault);

/** কোনো ডিজাইন নির্বাচিত না থাকলে ব্যবহৃত সাদামাটা ডিজাইন। লেটার-ধাঁচের
 * ডকুমেন্টে এটা নেই - সেখানে ডিফল্ট হলো সাধারণ রিপোর্ট-ধাঁচের LetterDocument। */
export const getDefaultBuiltinDesign = (type: BackendDocumentType): BuiltinDesign | null =>
  ALL_DESIGNS.find((design) => design.type === type && design.side !== "back" && design.isDefault) ?? null;

/** আইডি কার্ডের পিছনের রেডিমেড ডিজাইন (ডিফল্ট "সাধারণ পিছন" বাদে - সেটা আলাদা অপশন)। */
export const listBuiltinBackDesigns = (): BuiltinDesign[] =>
  ID_CARD_BACK_DESIGNS.filter((design) => design.id !== DEFAULT_ID_CARD_BACK_ID);

/** ডিফল্ট পিছনের ডিজাইন ("সাধারণ পিছন")। */
export const getDefaultBuiltinBackDesign = (): BuiltinDesign =>
  ID_CARD_BACK_DESIGNS.find((design) => design.id === DEFAULT_ID_CARD_BACK_ID)!;

/** পিছনের পাতার ডিজাইন খোঁজে; অজানা id হলে ডিফল্ট পিছনের ডিজাইন। */
export const getBuiltinBackDesign = (id: number | null | undefined): BuiltinDesign =>
  ID_CARD_BACK_DESIGNS.find((design) => design.id === id) ??
  ID_CARD_BACK_DESIGNS.find((design) => design.id === DEFAULT_ID_CARD_BACK_ID)!;

/** BODY_PLACEHOLDER লেয়ারে অ্যাডমিনের wording টেমপ্লেট বসায় (সনদ/প্রত্যয়ন/ছাড়পত্র)। */
export const withBodyTemplate = (layers: DocumentLayer[], bodyTemplate: string): DocumentLayer[] =>
  layers.map((layer) => {
    const content = layer.content as { template?: string } | undefined;
    if (layer.type !== "text" || content?.template !== BODY_PLACEHOLDER) return layer;
    return { ...layer, content: { ...content, template: bodyTemplate } };
  });
