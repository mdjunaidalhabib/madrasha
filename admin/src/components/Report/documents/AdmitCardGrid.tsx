import { useDocumentLayout, useBrandedRows } from "./engine/useDocumentLayout";
import { CardSheet } from "./engine/CardSheet";

type AdmitCardGridProps = {
  /** এই পাতার প্রবেশপত্রগুলো (≤ cardsPerSheet) - পাতা ভাগ করে PaginatedReportPreview। */
  rows: Record<string, any>[];
  // Explicit design chosen from the Reports screen (ReportFilterBar): positive
  // = DB template, negative = built-in design. Null/undefined = the plain
  // default design.
  templateId?: number | null;
  // পাতায় কয়টি প্রবেশপত্র (১ বা ২) - resolveCardsPerSheet থেকে।
  cardsPerSheet?: number | null;
};

/**
 * প্রতিটি পাতা একটি "শিট": প্রবেশপত্র ১৯০ × ১৩২ মিমি (A4-এর প্রায় অর্ধেক) - A4
 * পোর্ট্রেটে উপর-নিচ ২টি, A5 ল্যান্ডস্কেপে ১টি ঠিক মাপে বসে; ২টি বেছে নিলে ছোট
 * কাগজেও স্কেল করে আঁটে (দেখুন CardSheet)।
 */
const AdmitCardGrid = ({ rows, templateId, cardsPerSheet }: AdmitCardGridProps) => {
  const { layout, loaded } = useDocumentLayout("ADMIT_CARD", templateId);
  const brandedRows = useBrandedRows(rows);

  if (!layout || !loaded) return null;

  return <CardSheet layout={layout} rows={brandedRows} perPage={cardsPerSheet || 1} />;
};

export default AdmitCardGrid;
