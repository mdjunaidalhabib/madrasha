import type { DocumentKind } from "./types";

/**
 * The backend's DocumentType enum (Prisma) and the frontend's DocumentKind
 * union (types.ts, used by Canvas/renderLayer's `data-document-designer`
 * attribute and any future kind-specific styling) don't need to share the
 * exact same string values - this is the one place that maps between them.
 */
export type BackendDocumentType =
  | "ID_CARD"
  | "ADMIT_CARD"
  | "CERTIFICATE"
  | "CLEARANCE_CERTIFICATE"
  | "TESTIMONIAL"
  | "MARKSHEET"
  | "FEE_RECEIPT"
  | "SALARY_SLIP";

export const DOCUMENT_TYPE_TO_KIND: Record<BackendDocumentType, DocumentKind> = {
  ID_CARD: "id-card",
  ADMIT_CARD: "admit-card",
  CERTIFICATE: "certificate",
  CLEARANCE_CERTIFICATE: "transfer-letter",
  TESTIMONIAL: "testimonial",
  MARKSHEET: "marksheet",
  FEE_RECEIPT: "fee-receipt",
  SALARY_SLIP: "salary-slip",
};

export const DOCUMENT_TYPE_LABELS_BN: Record<BackendDocumentType, string> = {
  ID_CARD: "আইডি কার্ড",
  ADMIT_CARD: "প্রবেশপত্র",
  CERTIFICATE: "সনদ",
  CLEARANCE_CERTIFICATE: "ছাড়পত্র",
  TESTIMONIAL: "প্রত্যয়ন পত্র",
  MARKSHEET: "মার্কশিট",
  FEE_RECEIPT: "ফি রশিদ",
  SALARY_SLIP: "বেতন স্লিপ",
};

/** Document types the new template designer is fully wired for in this
 * pass - system starter templates + legacy migration + generation UI. The
 * rest of the enum is still valid/creatable (generic engine), just without
 * dedicated starter content yet. */
export const FULLY_WIRED_DOCUMENT_TYPES: BackendDocumentType[] = ["ID_CARD", "ADMIT_CARD"];

const ALL_BACKEND_TYPES: BackendDocumentType[] = [
  "ID_CARD",
  "ADMIT_CARD",
  "CERTIFICATE",
  "CLEARANCE_CERTIFICATE",
  "TESTIMONIAL",
  "MARKSHEET",
  "FEE_RECEIPT",
  "SALARY_SLIP",
];

/** URL-friendly slug for a BackendDocumentType, e.g. "ID_CARD" -> "id-card".
 * Used for the designer route (`talimat/settings/documents/:type/:id/edit`) - a
 * plain mechanical transform, deliberately not reusing DOCUMENT_TYPE_TO_KIND
 * above (that one maps CLEARANCE_CERTIFICATE -> "transfer-letter" to match
 * the legacy DocumentKind vocabulary, which would be a confusing URL). */
export const documentTypeToUrlSlug = (type: BackendDocumentType): string =>
  type.toLowerCase().replace(/_/g, "-");

export const urlSlugToDocumentType = (slug: string): BackendDocumentType | null => {
  const candidate = slug.toUpperCase().replace(/-/g, "_") as BackendDocumentType;
  return ALL_BACKEND_TYPES.includes(candidate) ? candidate : null;
};
