export type MeasuredBlock = {
  id: string;
  heightPx: number;
};

export type PaginateBlocksOptions = {
  // Usable height (px) on the page carrying the group's heading/thead.
  firstPageBudgetPx: number;
  // Usable height (px) on a continuation page (no heading/thead, just the
  // small top offset a continuation page adds in its place).
  continuationPageBudgetPx: number;
  // Height (px) of a footer/signature block that must always render right
  // after the LAST block on the LAST page.
  footerReservePx?: number;
  // Widow/orphan control: the last page never carries fewer than this many
  // blocks (unless the whole list is shorter). When it would, blocks are
  // pulled forward off the end of the previous page so a lone row or two
  // (and the signature) never sit by themselves on an otherwise empty page.
  // The same rule keeps a footer that overflowed onto its own page from
  // standing alone - it takes the last few rows with it. 0 = off.
  minLastPageBlocks?: number;
};

/**
 * Exact page-break walker: given real measured block heights (table rows,
 * grid rows, or letter/marksheet sections - any "list of things that must
 * stay whole"), returns which block ids land on which page. No averaging,
 * no statistical safety margin - a block only rolls to the next page when it
 * genuinely doesn't fit in the remaining budget.
 *
 * A single block taller than a whole page's budget still gets placed alone
 * on its own page (nothing here can split a block further - that's what
 * `splitTextToFit` is for, one level down) so pagination always terminates.
 *
 * `footerReservePx` is deliberately NOT reserved on every page up front -
 * that would waste a footer's worth of blank space at the bottom of every
 * page except the last one. Pages are packed as full as possible first;
 * only if the resulting last page has no room left for the footer does a
 * dedicated footer-only page get appended - blocks already placed on a full
 * page are never pulled back off it (that would leave a matching gap behind
 * on that page for no reason, just to move content one page later).
 */
export const paginateBlocks = (
  blocks: MeasuredBlock[],
  options: PaginateBlocksOptions,
): string[][] => {
  const {
    firstPageBudgetPx,
    continuationPageBudgetPx,
    footerReservePx = 0,
    minLastPageBlocks = 0,
  } = options;

  if (!blocks.length) return [[]];

  const pages: string[][] = [];
  let currentPage: string[] = [];
  let usedPx = 0;
  let budget = firstPageBudgetPx;

  blocks.forEach((block) => {
    const isEmptyPage = currentPage.length === 0;
    const fits = isEmptyPage || usedPx + block.heightPx <= budget;

    if (!fits) {
      pages.push(currentPage);
      currentPage = [];
      usedPx = 0;
      budget = continuationPageBudgetPx;
    }

    currentPage.push(block.id);
    usedPx += block.heightPx;
  });

  if (currentPage.length) pages.push(currentPage);

  const heightById = new Map(blocks.map((b) => [b.id, b.heightPx]));
  const sumHeights = (ids: string[]) => ids.reduce((sum, id) => sum + (heightById.get(id) ?? 0), 0);

  // Too few blocks stranded on the last page: pull some forward from the
  // previous one. Only done when the result still fits the page together
  // with the footer, and the previous page keeps at least one block.
  if (minLastPageBlocks > 0 && pages.length > 1) {
    const last = pages[pages.length - 1];
    const previous = pages[pages.length - 2];
    const missing = minLastPageBlocks - last.length;

    if (missing > 0 && previous.length - missing >= 1) {
      const pulled = previous.slice(previous.length - missing);
      const combinedPx = sumHeights(pulled) + sumHeights(last) + footerReservePx;

      if (combinedPx <= continuationPageBudgetPx) {
        pages[pages.length - 2] = previous.slice(0, previous.length - missing);
        pages[pages.length - 1] = [...pulled, ...last];
      }
    }
  }

  if (!footerReservePx) return pages;

  const lastPageBudget = pages.length > 1 ? continuationPageBudgetPx : firstPageBudgetPx;
  const lastPage = pages[pages.length - 1];
  const lastPageHeightPx = sumHeights(lastPage);

  if (lastPageHeightPx + footerReservePx <= lastPageBudget) {
    return pages;
  }

  // No room left on the last content page. With widow control on, hand the
  // footer the last few rows to travel with, so the signature isn't alone on
  // a blank page.
  if (minLastPageBlocks > 0 && lastPage.length - minLastPageBlocks >= 1) {
    const pulled = lastPage.slice(lastPage.length - minLastPageBlocks);

    if (sumHeights(pulled) + footerReservePx <= continuationPageBudgetPx) {
      pages[pages.length - 1] = lastPage.slice(0, lastPage.length - minLastPageBlocks);
      pages.push(pulled);
      return pages;
    }
  }

  // Otherwise give the footer its own page rather than pulling rows back off
  // an already-full page (which would just leave that page with a gap and
  // push the same rows one page later anyway, for no net gain).
  pages.push([]);

  return pages;
};
