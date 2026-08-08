import { DocumentType } from "@prisma/client";

// Same mm->px conversion factor the print pipeline already standardizes on
// (frontend/src/components/Report/pagination/pageGeometry.ts MM_TO_CSS_PX),
// so a template authored at its default size renders at true physical size.
const MM_TO_PX = 96 / 25.4;
const mmToPx = (mm: number) => Math.round(mm * MM_TO_PX);

/** Default canvas size (mm) per document type. ID_CARD (54x85.6mm, CR80)
 * and ADMIT_CARD (A5, 148x210mm) match the physical dimensions already
 * used by the existing print CSS (frontend/src/index.css). The remaining
 * types default to A4/A5 as a reasonable generic starting point - they
 * have no seeded system templates in this pass, so these values only
 * matter the first time someone creates a template of that type. */
const DOCUMENT_CANVAS_SIZE_MM: Record<DocumentType, { width: number; height: number }> = {
  ID_CARD: { width: 54, height: 85.6 },
  ADMIT_CARD: { width: 148, height: 210 },
  CERTIFICATE: { width: 210, height: 297 },
  CLEARANCE_CERTIFICATE: { width: 210, height: 297 },
  TESTIMONIAL: { width: 210, height: 297 },
  MARKSHEET: { width: 210, height: 297 },
  FEE_RECEIPT: { width: 148, height: 210 },
  SALARY_SLIP: { width: 210, height: 297 },
};

export const DEFAULT_CANVAS_SIZE_PX: Record<DocumentType, { width: number; height: number }> =
  Object.fromEntries(
    Object.entries(DOCUMENT_CANVAS_SIZE_MM).map(([type, mm]) => [
      type,
      { width: mmToPx(mm.width), height: mmToPx(mm.height) },
    ]),
  ) as Record<DocumentType, { width: number; height: number }>;

export const MAX_TEMPLATE_NAME_LENGTH = 150;
export const MAX_TEMPLATE_DESCRIPTION_LENGTH = 1000;
export const MAX_LAYERS_PER_TEMPLATE = 60;

/** Only these document types are fully wired end-to-end (seeded system
 * templates, legacy migration, generation UI) in this pass. The remaining
 * DocumentType enum values are still valid, generic, creatable entities -
 * proving the engine isn't hardcoded to ID_CARD/ADMIT_CARD - they just have
 * no starter content yet. */
export const FULLY_WIRED_DOCUMENT_TYPES: DocumentType[] = ["ID_CARD", "ADMIT_CARD"];
