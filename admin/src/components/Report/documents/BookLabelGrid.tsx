import { useBrandedRows, useDocumentLayout } from "./engine/useDocumentLayout";
import { useBookLabelRows } from "./engine/useBookLabelRows";
import { CardSheet } from "./engine/CardSheet";

type BookLabelGridProps = {
  rows: Record<string, any>[];
  // Explicit design chosen from the Reports screen (ReportFilterBar): positive
  // = DB template, negative = built-in design. Null/undefined = the plain
  // default design.
  templateId?: number | null;
  // Labels on this page - decided once for the whole report by
  // PaginatedReportPreview (see resolveCardsPerSheet): 1 = one centered label,
  // more = the paper divided into equal cells with dotted cut lines.
  cardsPerSheet?: number | null;
};

/**
 * পুরস্কার বই-লেবেল: প্রতিটি row বাছা BOOK_LABEL ডিজাইনে (ডিফল্ট: সাধারণ) আঁকা হয়। পুরো কাগজ (মার্জিনসহ)
 * সমান ঘরে ভাগ হয়, লেবেল ঘরের মাঝখানে বসে আর ঘরের সীমানায় ডটেড কাটার-রেখা থাকে (দেখুন CardSheet)।
 */
const BookLabelGrid = ({ rows, templateId, cardsPerSheet }: BookLabelGridProps) => {
  const { layout, loaded } = useDocumentLayout("BOOK_LABEL", templateId);
  const labelRows = useBookLabelRows(useBrandedRows(rows));

  if (!layout || !loaded) return null;

  return <CardSheet layout={layout} rows={labelRows} perPage={cardsPerSheet || 1} />;
};

export default BookLabelGrid;
