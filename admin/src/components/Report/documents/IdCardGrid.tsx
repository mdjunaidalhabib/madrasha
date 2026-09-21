import { useDocumentLayout, useBrandedRows, useBackLayout } from "./engine/useDocumentLayout";
import { useIdCardBackRows } from "./engine/useIdCardBackRows";
import { useSelectedTemplateOverrideStore } from "../../../store/selectedTemplateOverrideStore";
import { DEFAULT_ID_CARD_BACK_ID } from "@madrasha/shared-ui/src/components/DocumentDesigner/builtin/registry";
import { CardSheet } from "./engine/CardSheet";

type IdCardGridProps = {
  rows: Record<string, any>[];
  // Explicit design chosen from the Reports screen (ReportFilterBar): positive
  // = DB template, negative = built-in design. Null/undefined = the plain
  // default design.
  templateId?: number | null;
  // Cards on this page - decided once for the whole report by
  // PaginatedReportPreview (see resolveCardsPerSheet): 1 = one centered card,
  // 2 = paper split in two, more = the paper divided into equal cells.
  cardsPerSheet?: number | null;
  // "আইডি কার্ড ব্যাক" report: the chosen back design IS the card (no front).
  backOnly?: boolean;
};

/**
 * Renders each row through the chosen ID_CARD design (default: the plain
 * built-in one) via the generic DocumentDesigner engine, as a "sheet": one
 * centered card per page ("একক শিক্ষার্থী"), or - "সকল শিক্ষার্থী" - the whole
 * paper (margins included) divided into equal cells like the admit card, each
 * card centered in its cell with dotted cut lines along the cell borders (see
 * CardSheet / computeContentGrid).
 *
 * Single-student mode + a chosen back design (pairBackId): each page shows the
 * front and the back together - portrait: front on top / back below; landscape:
 * side by side (see CardPairSheet).
 *
 * "আইডি কার্ড ব্যাক" report (backOnly): the chosen back design takes the
 * front's place, with the same sheet layout.
 */
const IdCardGrid = ({ rows, templateId, cardsPerSheet, backOnly }: IdCardGridProps) => {
  const { layout: frontLayout, loaded } = useDocumentLayout("ID_CARD", templateId);
  const backId = useSelectedTemplateOverrideStore((s) => s.idCardBackId);
  const pairBackId = useSelectedTemplateOverrideStore((s) => s.idCardPairBackId);
  const backWithFront = useSelectedTemplateOverrideStore((s) => s.idCardBackWithFront);
  const cardsPerPageOption = useSelectedTemplateOverrideStore((s) => s.cardsPerPage);
  const singleMode = cardsPerPageOption === "1";
  const chosenBack = useBackLayout(backOnly ? (backId ?? DEFAULT_ID_CARD_BACK_ID) : null);
  // "একক শিক্ষার্থী" মোডে দুই পাশ: সামনের সাথে পিছনও একই পাতায় (উপরে সামনে, নিচে পিছনে)।
  //  - আইডি কার্ড রিপোর্ট: পিছনের ডিজাইন = pairBackId (null → শুধু সামনে)
  //  - আইডি কার্ড ব্যাক রিপোর্ট: "দুই পাশ" বাছলে সামনের ডিজাইনের নিচে chosenBack
  const pairLayout = useBackLayout(!backOnly && singleMode ? pairBackId : null);
  const backWithFrontActive = !!backOnly && singleMode && backWithFront;
  const brandedRows = useIdCardBackRows(useBrandedRows(rows), !!(chosenBack || pairLayout));
  // backOnly: শুধু পিছন হলে পিছনের ডিজাইনই কার্ড; দুই পাশ হলে সামনে + পিছন।
  const layout = backOnly && !backWithFrontActive ? chosenBack : frontLayout;
  const secondLayout = backWithFrontActive ? chosenBack : pairLayout;

  if (!layout || !loaded) return null;

  return <CardSheet layout={layout} rows={brandedRows} perPage={cardsPerSheet || 1} backLayout={secondLayout} />;
};

export default IdCardGrid;
