// Same mm->px conversion factor the backend standardizes on
// (backend/src/modules/document-templates/document-templates.constants.ts),
// so a page picked here matches the printed physical size.
const MM_TO_PX = 96 / 25.4;
export const mmToPx = (mm: number) => Math.round(mm * MM_TO_PX);
export const pxToMm = (px: number) => Math.round((px / MM_TO_PX) * 10) / 10;

export type Orientation = "portrait" | "landscape";
export type PageSizeId = "A4" | "A5" | "CUSTOM";

/** Portrait mm dimensions for every non-custom preset. */
export const PAGE_SIZE_MM: Record<Exclude<PageSizeId, "CUSTOM">, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
};

export const PAGE_SIZE_LABELS_BN: Record<PageSizeId, string> = {
  A4: "A4",
  A5: "A5",
  CUSTOM: "কাস্টম",
};

const closeTo = (a: number, b: number, tolerance = 2) => Math.abs(a - b) <= tolerance;

/** Best-effort reverse lookup so the toolbar can reflect a size that was set
 * elsewhere (loaded from a saved template, or the per-document-type default)
 * as the matching preset + orientation instead of always falling back to
 * "custom". */
export function detectPageSize(widthPx: number, heightPx: number): { id: PageSizeId; orientation: Orientation } {
  const wMm = pxToMm(widthPx);
  const hMm = pxToMm(heightPx);

  for (const id of Object.keys(PAGE_SIZE_MM) as (keyof typeof PAGE_SIZE_MM)[]) {
    const { width, height } = PAGE_SIZE_MM[id];
    if (closeTo(wMm, width) && closeTo(hMm, height)) return { id, orientation: "portrait" };
    if (closeTo(wMm, height) && closeTo(hMm, width)) return { id, orientation: "landscape" };
  }

  return { id: "CUSTOM", orientation: wMm >= hMm ? "landscape" : "portrait" };
}

/** px size for a preset at a given orientation. */
export function pageSizePx(id: Exclude<PageSizeId, "CUSTOM">, orientation: Orientation): { width: number; height: number } {
  const mm = PAGE_SIZE_MM[id];
  const width = mmToPx(orientation === "landscape" ? mm.height : mm.width);
  const height = mmToPx(orientation === "landscape" ? mm.width : mm.height);
  return { width, height };
}
