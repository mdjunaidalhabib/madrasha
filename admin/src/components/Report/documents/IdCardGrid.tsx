import { useStaggeredReveal } from "../../../hooks/useStaggeredReveal";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { useDocumentLayout, useBrandedRows } from "./engine/useDocumentLayout";
import { CardSheet, ScaledCanvas } from "./engine/CardSheet";
import { CUT_PAD_MM, PX_TO_MM } from "./engine/cardSheetLayout";

type IdCardGridProps = {
  rows: Record<string, any>[];
  // Explicit design chosen from the Reports screen (ReportFilterBar): positive
  // = DB template, negative = built-in design. Null/undefined = the plain
  // default design.
  templateId?: number | null;
  // Set (1) when the report is in "one card per page, centered" mode - see
  // resolveCardsPerSheet. Null/undefined = the normal cut-friendly grid.
  cardsPerSheet?: number | null;
};

const GUIDE_MM = 0.25;
const GUIDE = `${GUIDE_MM}mm dashed #b8b8b8`;

/**
 * Renders each row through the chosen ID_CARD design (default: the plain
 * built-in one) via the generic DocumentDesigner engine.
 *
 * Two layouts:
 *   - grid (default for many students): every card sits in a cell with
 *     CUT_PAD_MM of empty paper on all sides and a dotted guide line on the
 *     cell edge - so two neighbouring cards are separated by a wide gap with
 *     the cut line running through the middle of it.
 *   - sheet (single student, or "প্রতি পাতায় ১টি"): the card sits alone in
 *     the exact centre of its own page.
 */
const IdCardGrid = ({ rows, templateId, cardsPerSheet }: IdCardGridProps) => {
  const { layout, loaded } = useDocumentLayout("ID_CARD", templateId);
  const brandedRows = useBrandedRows(rows);

  // rows.length বড় হলে ধাপে ধাপে রেন্ডার হয় - দেখুন useStaggeredReveal
  const revealed = useStaggeredReveal(rows.length);
  const visibleRows = revealed >= rows.length ? brandedRows : brandedRows.slice(0, revealed);

  if (!layout || !loaded) return null;

  if (cardsPerSheet) return <CardSheet layout={layout} rows={brandedRows} perPage={cardsPerSheet} />;

  const cellWidthMm = layout.width * PX_TO_MM + CUT_PAD_MM * 2;
  const cellHeightMm = layout.height * PX_TO_MM + CUT_PAD_MM * 2;

  return (
    <>
      {revealed < rows.length && (
        <p className="no-print mb-2 text-center text-sm text-slate-500 dark:text-slate-400">
          প্রস্তুত হচ্ছে... {toBanglaDigits(revealed)}/{toBanglaDigits(rows.length)}
        </p>
      )}
      <div
        className="report-id-card-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, ${cellWidthMm}mm)`,
          justifyContent: "center",
        }}
      >
        {visibleRows.map((row, index) => (
          <div
            key={`id-card-${row.id || index}`}
            className="print-page-break"
            style={{
              boxSizing: "border-box",
              width: `${cellWidthMm}mm`,
              height: `${cellHeightMm}mm`,
              padding: `${CUT_PAD_MM - GUIDE_MM}mm`,
              border: GUIDE,
            }}
          >
            <ScaledCanvas layout={layout} row={row} scale={1} />
          </div>
        ))}
      </div>
    </>
  );
};

export default IdCardGrid;
