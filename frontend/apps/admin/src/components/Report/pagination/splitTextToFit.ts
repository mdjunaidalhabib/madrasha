export type MeasureTextFn = (text: string) => number;

export type SplitTextResult = {
  fits: string;
  remainder: string;
};

/**
 * Binary-searches the longest prefix of `text` whose rendered height (via
 * the injected `measure` probe) stays within `budgetPx`, then snaps the cut
 * back to the nearest preceding whitespace/newline so a page break never
 * lands mid-word or mid Bengali conjunct cluster. Used only for the rare
 * free-flowing paragraph (testimonial/certificate/admit-card rules text)
 * that's itself taller than one page - table/grid rows never need this,
 * they're paginated whole via `paginateBlocks`.
 */
export const splitTextToFit = (text: string, budgetPx: number, measure: MeasureTextFn): SplitTextResult => {
  if (!text) return { fits: "", remainder: "" };
  if (measure(text) <= budgetPx) return { fits: text, remainder: "" };

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high + 1) / 2);
    if (measure(text.slice(0, mid)) <= budgetPx) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  if (low === 0) {
    // Budget is smaller than even the first line - still make forward
    // progress by cutting at the first word boundary instead of stalling.
    const firstBreak = text.indexOf(" ");
    low = firstBreak > 0 ? firstBreak : Math.min(text.length, 1);
  }

  let cut = low;
  while (cut > 0 && !/\s/.test(text[cut - 1])) cut -= 1;
  if (cut === 0) cut = low;

  return {
    fits: text.slice(0, cut).trimEnd(),
    remainder: text.slice(cut).trimStart(),
  };
};
