import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ReportMenuItem } from "../../features/reports/types";
import { PaperSize, Orientation } from "../common/DataExportPrintActions";
import { ReportBackground, ReportBrandHeader, ReportWatermark } from "./ReportBranding";
import ReportContent from "./ReportContent";
import { toBanglaDigits } from "../../utils/reportUtils";
import { MM_TO_CSS_PX, getPaperWidthMm, getPaperHeightMm, getPagePaddingMm } from "./pagination/pageGeometry";
import { paginateBlocks, type MeasuredBlock } from "./pagination/paginateBlocks";
import { splitTextToFit } from "./pagination/splitTextToFit";
import { getPrintableConfig } from "./pagination/printableConfig";
import { useDocumentTemplateDefaultStore } from "../../store/documentTemplateDefaultStore";

type PaginatedReportPreviewProps = {
  loading: boolean;
  report: ReportMenuItem;
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  hideBrandHeader?: boolean;
  paperSize: PaperSize;
  orientation: Orientation;
};

type ReportDensity = "comfortable" | "compact" | "dense" | "ultra-dense";

type ResolvedPage = {
  key: string;
  rows: Record<string, any>[];
  startIndex: number;
  // Only the very first physical page of a group (exam/class/year context
  // for grouped types, or the whole report for ungrouped ones) shows the
  // institution brand header - matches the pre-rewrite behaviour exactly.
  isFirstPageOfGroup: boolean;
  // Whether THIS physical page is where its record/group's own heading
  // renders (independent of isFirstPageOfGroup - every blocks-kind record
  // gets its own heading on its own first page, not just the report's).
  isFirstPage: boolean;
  isLastPage: boolean;
  density: ReportDensity;
  // Single-record free-text types (testimonial/certificate/transfer-letter)
  // only: the pre-sliced body text that belongs on this specific physical
  // page, when the full body didn't fit on one page.
  bodyTextOverride?: string;
  // academic-result only: pass/fail/absent counts for the WHOLE group (this
  // class's this exam), not just this physical page's row slice.
  resultStats?: ResultStats;
  // columnsPerPage:2 only: true when this chunk starts a fresh column
  // rather than continuing to pack below the previous chunk in the same
  // column - see packColumnsAcrossGroups.
  startsNewColumn?: boolean;
};

// Kept unused on purpose (a sliver of every page's budget) so the last row
// or card lands a hair short of the page's bottom padding instead of
// touching it right at the measured limit.
const SAFETY_MARGIN_RATIO = 0.01;
// Continuation pages render without a heading/thead - just the small top
// margin every print component adds in its place (Tailwind `mt-6` = 24px),
// applied uniformly whenever `isFirstPage` is false.
const CONTINUATION_TOP_OFFSET_PX = 24;
// Horizontal space reserved between the two columns of a columnsPerPage:2
// report (exam-signature-number-sheet-2col) - a thin divider line renders
// centered in this gap so cutting straight down the middle leaves an equal
// blank margin on both halves instead of shaving one side's content close.
const TWO_COLUMN_GAP_PX = 48;
// Vertical space reserved between two classes stacked in the same column of
// a columnsPerPage:2 report - a thin divider line renders centered in this
// gap too, matching TWO_COLUMN_GAP_PX's vertical-cut divider, so there's
// blank paper to cut through between classes as well as between columns.
const COLUMN_CLASS_GAP_PX = 40;

const getPaperWidthPx = (paperSize: PaperSize, orientation: Orientation) =>
  getPaperWidthMm(paperSize, orientation) * MM_TO_CSS_PX;

const getPaperHeightPx = (paperSize: PaperSize, orientation: Orientation) =>
  getPaperHeightMm(paperSize, orientation) * MM_TO_CSS_PX;

const parseSubjects = (row: Record<string, any>) => {
  if (Array.isArray(row?.subjects)) return row.subjects;
  if (typeof row?.subjects !== "string") return [];
  try {
    const parsed = JSON.parse(row.subjects);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// One student row per subject, tagged with __subject_name so
// printableConfig's exam-signature-number-sheet group key can split them
// into one heading+table per subject (see the comment where this is called).
const expandRowsBySubject = (allRows: Record<string, any>[]) => {
  const expanded: Record<string, any>[] = [];
  allRows.forEach((row) => {
    const subjects = parseSubjects(row);
    if (!subjects.length) {
      expanded.push(row);
      return;
    }
    subjects.forEach((subject: Record<string, any>, index: number) => {
      expanded.push({
        ...row,
        __subject_name: subject.subject_name || `বিষয় ${toBanglaDigits(index + 1)}`,
      });
    });
  });
  return expanded;
};

const getEffectiveColumnCount = (report: ReportMenuItem, rows: Record<string, any>[]) => {
  if (report.printable !== "academic-result") return report.columns.length;

  const subjects = new Set<string>();
  rows.forEach((row) => {
    parseSubjects(row).forEach((subject: Record<string, any>, index: number) => {
      subjects.add(String(subject.book_id ?? subject.subject_name ?? index));
    });
  });

  return report.columns.length + subjects.size;
};

// Computed once per GROUP (not per already-chunked page) so every physical
// page belonging to the same exam/class/year context renders at the same
// font size - the old per-page-chunk version was circular (density decided
// capacity, capacity decided the chunked row count density then read back).
const getDensity = (
  report: ReportMenuItem,
  groupRows: Record<string, any>[],
  paperSize: PaperSize,
  orientation: Orientation,
): ReportDensity => {
  const columns = getEffectiveColumnCount(report, groupRows);
  const a5Penalty = paperSize === "a5" ? 2 : 0;
  const portraitPenalty = orientation === "portrait" ? 1 : 0;
  const densityScore = columns + a5Penalty + portraitPenalty;

  if (densityScore >= 18) return "ultra-dense";
  if (densityScore >= 14) return "dense";
  if (densityScore >= 10 || groupRows.length >= 18) return "compact";
  return "comfortable";
};

type ResultStats = { total: number; pass: number; fail: number; absent: number };

// Computed from the GROUP's full row set (every row belonging to this
// class/exam, before pagination slices it across physical pages) - not from
// a single page's `rows`, otherwise "কতজন পাশ" would only reflect whatever
// students happened to land on that one printed page.
const getResultStats = (groupRowsData: Record<string, any>[]): ResultStats => {
  let pass = 0;
  let fail = 0;
  let absent = 0;

  groupRowsData.forEach((row) => {
    const status = String(row?.status || "").toUpperCase();
    if (status === "PASS") pass += 1;
    else if (status === "FAIL") fail += 1;
    else if (status === "ABSENT") absent += 1;
  });

  return { total: groupRowsData.length, pass, fail, absent };
};

const groupRows = (rows: Record<string, any>[], getGroupKey: (row: Record<string, any>) => string) => {
  const map = new Map<string, Record<string, any>[]>();
  rows.forEach((row) => {
    const key = getGroupKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  });
  return Array.from(map.values());
};

// ---- table-kind measurement (academic-result, result-notice, attendance
// registers, student/guardian/teacher lists, exam sheets, default table) ----

type TableGroupMeasurement = {
  // Distance from the page's content-top to the first data row's own top -
  // measured as a position delta (not a sum of each block's own
  // getBoundingClientRect().height) so it automatically captures the brand
  // header, heading, thead AND every margin between them (Tailwind's
  // `my-6`/`mt-10`/etc. add margin that sits OUTSIDE an element's own
  // measured height and would otherwise be silently dropped).
  firstRowOffsetPx: number;
  // Distance from the last data row's bottom to the footer's bottom -same
  // position-delta trick, so it captures the footer's own `mt-*` margin
  // plus its height in one measurement instead of just the box height.
  footerReservePx: number;
  rowHeightsPx: number[];
};

const measureTableGroupContainer = (
  container: HTMLElement,
  paddingTopPx: number,
): TableGroupMeasurement => {
  const footerEl = container.querySelector(".report-block-signature");
  const dataRows = Array.from(container.querySelectorAll("tbody tr"));
  const containerTop = container.getBoundingClientRect().top;
  const firstRow = dataRows[0];
  const lastRow = dataRows[dataRows.length - 1];

  const firstRowOffsetPx = firstRow
    ? firstRow.getBoundingClientRect().top - containerTop - paddingTopPx
    : 0;

  const footerReservePx =
    footerEl && lastRow
      ? footerEl.getBoundingClientRect().bottom - lastRow.getBoundingClientRect().bottom
      : 0;

  return {
    firstRowOffsetPx,
    footerReservePx,
    rowHeightsPx: dataRows.map((tr) => tr.getBoundingClientRect().height),
  };
};

const paginateTableGroup = (
  measurement: TableGroupMeasurement,
  groupRowsData: Record<string, any>[],
  availableHeightPx: number,
  continuationOffsetPx: number,
): Record<string, any>[][] => {
  const safetyPx = availableHeightPx * SAFETY_MARGIN_RATIO;
  const firstPageBudgetPx = availableHeightPx - measurement.firstRowOffsetPx - safetyPx;
  const continuationPageBudgetPx = availableHeightPx - continuationOffsetPx - safetyPx;

  const blocks: MeasuredBlock[] = measurement.rowHeightsPx.map((heightPx, i) => ({
    id: String(i),
    heightPx,
  }));

  const pageIdGroups = paginateBlocks(blocks, {
    firstPageBudgetPx,
    continuationPageBudgetPx,
    footerReservePx: measurement.footerReservePx,
  });

  return pageIdGroups.map((ids) => ids.map((id) => groupRowsData[Number(id)]));
};

// ---- columnsPerPage:2 measurement (exam-signature-number-sheet-2col): a
// continuous top-to-bottom packer across ALL groups combined, not one
// column per group. A class starts wherever the current column still has
// room left - several small classes share a column instead of each one
// wasting the rest of a column - and only moves to a fresh column when it
// genuinely doesn't fit what's left. A class too big for one column still
// spills into the next; only that class's true first chunk shows the
// heading and only its true last chunk shows the footer (see ColumnChunk
// below) - a spillover chunk repeats neither, it just continues the table. ----

type ColumnChunk = {
  groupIndex: number;
  rows: Record<string, any>[];
  startsNewColumn: boolean;
  // Whether this chunk is where its class's own heading (brand header +
  // exam/class/subject line) belongs - only the class's very first chunk,
  // even when that class's later chunks each start a fresh column. Spillover
  // chunks of the same class repeat neither the heading nor the signature -
  // only the class's true first/last chunk get those, wherever they land.
  isFirstChunkOfGroup: boolean;
  // Whether this chunk is where its class's signature line belongs - only
  // the class's very last chunk (see isFirstChunkOfGroup above).
  isLastChunkOfGroup: boolean;
};

const packColumnsAcrossGroups = (
  groups: Record<string, any>[][],
  measurements: TableGroupMeasurement[],
  availableHeightPx: number,
  // Top overhead a chunk that ISN'T its group's first chunk carries instead
  // of the full heading - same "real continuation page" measurement the
  // single-column table path uses (see CONTINUATION_PROBE_KEY). Only a
  // group's true first chunk (isFirstChunkOfGroup) reserves the full
  // heading+brand-header height; a group's true last chunk (and only that
  // one, once it's known) reserves the footer/signature height - matching
  // what each chunk actually renders after the isFirstPage/isLastPage fix,
  // instead of every chunk reserving both regardless.
  continuationOffsetPx: number,
): ColumnChunk[] => {
  const safetyPx = availableHeightPx * SAFETY_MARGIN_RATIO;
  const freshColumnBudgetPx = availableHeightPx - safetyPx;
  const chunks: ColumnChunk[] = [];
  let remainingPx = freshColumnBudgetPx;
  let isFirstChunkOfColumn = true;

  groups.forEach((groupRowsData, groupIndex) => {
    const measurement = measurements[groupIndex];
    const footerReservePx = measurement.footerReservePx;

    let rowIndex = 0;
    let isFirstChunkOfThisGroup = true;
    while (rowIndex < groupRowsData.length) {
      const headingOverheadPx = isFirstChunkOfThisGroup ? measurement.firstRowOffsetPx : continuationOffsetPx;

      // A class only ever splits across columns when it's too big for one
      // column on its own - never just to top off a little leftover space
      // below a previous class. So before packing anything, check whether
      // the REST of this class (not just its next row) fits in what's left
      // here; if it doesn't, hop to a fresh column first (where it either
      // fits whole, or - if it's genuinely bigger than a full column - at
      // least starts filling from a clean top instead of a cramped corner).
      if (!isFirstChunkOfColumn) {
        const remainingRowsHeightPx = measurement.rowHeightsPx
          .slice(rowIndex)
          .reduce((sum, h) => sum + h, 0);
        const budgetHerePx = remainingPx - COLUMN_CLASS_GAP_PX - headingOverheadPx - footerReservePx;

        if (remainingRowsHeightPx > budgetHerePx) {
          remainingPx = freshColumnBudgetPx;
          isFirstChunkOfColumn = true;
        }
      }

      // Between two classes sharing a column, reserve a visible gap (see
      // COLUMN_CLASS_GAP_PX) so there's blank paper to cut through between
      // them, not just between the two side-by-side columns.
      const gapPx = isFirstChunkOfColumn ? 0 : COLUMN_CLASS_GAP_PX;
      // Footer isn't reserved up front here (mirrors paginateBlocks' same
      // choice) - reserving it on every chunk would waste a footer's worth
      // of space on every non-last chunk of a spilled class. Whether it
      // actually fits alongside THIS chunk's rows is resolved below, once
      // it's known this chunk reaches the group's last row.
      const rowBudgetPx = remainingPx - gapPx - headingOverheadPx;

      // If this is a fresh column and even the budget above doesn't cover
      // one row (a class bigger than a whole column), there's nothing more
      // to do here - the `chunkRows.length > 0` guard below still forces at
      // least one row through regardless, so this always makes progress.

      const chunkRows: Record<string, any>[] = [];
      let usedPx = 0;
      while (rowIndex < groupRowsData.length) {
        const heightPx = measurement.rowHeightsPx[rowIndex];
        if (chunkRows.length > 0 && usedPx + heightPx > rowBudgetPx) break;
        chunkRows.push(groupRowsData[rowIndex]);
        usedPx += heightPx;
        rowIndex += 1;
      }

      const reachesGroupEnd = rowIndex >= groupRowsData.length;
      const footerFitsHere = reachesGroupEnd && usedPx + footerReservePx <= rowBudgetPx;

      chunks.push({
        groupIndex,
        rows: chunkRows,
        startsNewColumn: isFirstChunkOfColumn,
        isFirstChunkOfGroup: isFirstChunkOfThisGroup,
        isLastChunkOfGroup: footerFitsHere,
      });
      remainingPx -= gapPx + headingOverheadPx + usedPx + (footerFitsHere ? footerReservePx : 0);
      isFirstChunkOfColumn = false;
      isFirstChunkOfThisGroup = false;

      if (reachesGroupEnd && !footerFitsHere) {
        // The signature doesn't fit alongside the group's last content chunk
        // - give it a fresh column of its own (a dedicated footer-only
        // chunk) rather than pulling rows back off the chunk already packed
        // above, matching paginateBlocks' same footer-overflow handling.
        chunks.push({
          groupIndex,
          rows: [],
          startsNewColumn: true,
          isFirstChunkOfGroup: false,
          isLastChunkOfGroup: true,
        });
        remainingPx = freshColumnBudgetPx - continuationOffsetPx - footerReservePx;
        isFirstChunkOfColumn = false;
      }
    }
  });

  return chunks;
};

// ---- grid-kind measurement (id-card, admit-card) ----

type GridMeasurement = {
  // Position delta from content-top to the first card's own top - captures
  // the brand header's height AND its `margin-bottom` (index.css) in one
  // measurement, the same way table-kind's firstRowOffsetPx does.
  firstCardOffsetPx: number;
  cardRows: { heightPx: number; cardIndices: number[] }[];
};

const measureGridContainer = (container: HTMLElement, paddingTopPx: number): GridMeasurement => {
  const cards = Array.from(container.querySelectorAll<HTMLElement>(".print-page-break"));
  const containerTop = container.getBoundingClientRect().top;

  const cardRows: { heightPx: number; cardIndices: number[] }[] = [];
  let currentTop: number | null = null;

  cards.forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    if (currentTop === null || Math.abs(rect.top - currentTop) > 2) {
      cardRows.push({ heightPx: rect.height, cardIndices: [index] });
      currentTop = rect.top;
    } else {
      const row = cardRows[cardRows.length - 1];
      row.heightPx = Math.max(row.heightPx, rect.height);
      row.cardIndices.push(index);
    }
  });

  const firstCardOffsetPx = cards[0]
    ? cards[0].getBoundingClientRect().top - containerTop - paddingTopPx
    : 0;

  return { firstCardOffsetPx, cardRows };
};

const paginateGrid = (measurement: GridMeasurement, availableHeightPx: number): number[][] => {
  const safetyPx = availableHeightPx * SAFETY_MARGIN_RATIO;
  const firstPageBudgetPx = availableHeightPx - measurement.firstCardOffsetPx - safetyPx;
  const continuationPageBudgetPx = availableHeightPx - safetyPx;

  const blocks: MeasuredBlock[] = measurement.cardRows.map((row, i) => ({
    id: String(i),
    heightPx: row.heightPx,
  }));

  const pageIdGroups = paginateBlocks(blocks, { firstPageBudgetPx, continuationPageBudgetPx });

  return pageIdGroups.map((ids) => ids.flatMap((id) => measurement.cardRows[Number(id)].cardIndices));
};

// ---- blocks-kind measurement (marksheet, certificate, testimonial,
// transfer-letter): each row is its own independent physical document that
// almost always fits one page, but must flow onto a continuation page
// instead of being clipped when it doesn't. ----

type RecordPage = {
  isFirstPage: boolean;
  isLastPage: boolean;
  bodyTextOverride?: string;
};

const measureAndSplitRecord = (
  container: HTMLElement,
  paddingTopPx: number,
  firstPageBudgetPx: number,
  continuationBudgetPx: number,
): RecordPage[] => {
  const paddingYPx = paddingTopPx * 2;
  const containerTop = container.getBoundingClientRect().top;
  const naturalHeightPx = container.getBoundingClientRect().height - paddingYPx;

  if (naturalHeightPx <= firstPageBudgetPx) {
    return [{ isFirstPage: true, isLastPage: true }];
  }

  const footerEl = container.querySelector<HTMLElement>(".report-block-signature");
  const bodyEl = container.querySelector<HTMLElement>(".report-block-body");
  const contentOnlyHeightPx = footerEl
    ? footerEl.getBoundingClientRect().top - containerTop - paddingTopPx
    : naturalHeightPx;
  // The gap between content and footer (from the footer's own `mt-*`
  // margin, e.g. LetterDocument's footer) collapses into the space BEFORE
  // the footer's box rather than being part of its own measured height, so
  // "total natural height minus content-only height" is what actually needs
  // reserving - not just footerEl's own getBoundingClientRect().height.
  const footerReservePx = footerEl ? naturalHeightPx - contentOnlyHeightPx : 0;

  if (!bodyEl) {
    // No splittable free-text body (marksheet's fixed heading/info/table
    // sequence) - the only thing that can move to a continuation page is
    // the footer/signature block.
    if (contentOnlyHeightPx <= firstPageBudgetPx) {
      return [
        { isFirstPage: true, isLastPage: false },
        { isFirstPage: false, isLastPage: true },
      ];
    }
    // Even the content alone doesn't fit and there's no text block left to
    // split further - render it whole rather than silently losing data.
    return [{ isFirstPage: true, isLastPage: true }];
  }

  const fullBodyText = bodyEl.textContent || "";
  const headingHeightPx = bodyEl.getBoundingClientRect().top - containerTop - paddingTopPx;

  const measure = (candidate: string) => {
    const original = bodyEl.textContent;
    bodyEl.textContent = candidate;
    const height = bodyEl.getBoundingClientRect().height;
    bodyEl.textContent = original;
    return height;
  };

  const pages: RecordPage[] = [];
  let remainder = fullBodyText;
  let isFirst = true;

  while (true) {
    const pageBudgetPx = isFirst ? firstPageBudgetPx - headingHeightPx : continuationBudgetPx;
    const budgetWithFooterPx = pageBudgetPx - footerReservePx;

    if (measure(remainder) <= budgetWithFooterPx) {
      pages.push({ isFirstPage: isFirst, isLastPage: true, bodyTextOverride: remainder });
      break;
    }

    const { fits, remainder: rest } = splitTextToFit(remainder, pageBudgetPx, measure);

    if (!rest || rest === remainder) {
      // Couldn't make forward progress (budget smaller than a single word) -
      // stop here instead of looping forever.
      pages.push({ isFirstPage: isFirst, isLastPage: true, bodyTextOverride: remainder });
      break;
    }

    pages.push({ isFirstPage: isFirst, isLastPage: false, bodyTextOverride: fits });
    remainder = rest;
    isFirst = false;
  }

  return pages;
};

const PaginatedReportPreview = ({
  loading,
  report,
  rows: rawRows,
  selectedDivisionName = "",
  selectedClassName = "",
  hideBrandHeader = false,
  paperSize,
  orientation,
}: PaginatedReportPreviewProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [previewScale, setPreviewScale] = useState(1);
  const [resolvedPages, setResolvedPages] = useState<ResolvedPage[] | null>(null);

  // exam-signature-number-sheet prints one table PER SUBJECT (signature +
  // hand-written mark column for that subject alone), not one wide table
  // with a subject column each - so each incoming student row is expanded
  // into one row per subject before grouping/pagination ever sees it. Every
  // other printable type passes rows through untouched.
  const rows = useMemo(
    () =>
      report.printable === "exam-signature-number-sheet" ||
      report.printable === "exam-signature-number-sheet-2col"
        ? expandRowsBySubject(rawRows)
        : rawRows,
    [rawRows, report.printable],
  );

  // IdCardGrid resolves its template asynchronously (from
  // documentTemplateDefaultStore), so the very first off-screen measurement
  // pass below can run before that data arrives and see an empty grid.
  // Subscribing here and including it in the measurement effect's deps
  // makes that effect re-run (and correctly re-measure) the moment the
  // template finishes loading - same pattern as the document.fonts.ready
  // re-measurement a few lines down. AdmitCardGrid is a plain fixed layout
  // (no async template), so it needs no such subscription.
  const idCardTemplateLoaded = useDocumentTemplateDefaultStore((s) => s.loaded.ID_CARD);

  const config = getPrintableConfig(report);
  const showBrandAtAll = !hideBrandHeader && report.printable !== "id-card";
  const columnsPerPage = config.columnsPerPage ?? 1;
  const pagePaddingPx = getPagePaddingMm(paperSize) * MM_TO_CSS_PX;
  // Content width of ONE column in a columnsPerPage:2 report - the page's
  // full content width (paper width minus its own left/right padding) split
  // in half around the divider gap. Off-screen measurement below renders at
  // this width (not the full page width) so wrapped student names measure
  // the same row height they'll actually take up in the narrower column.
  const columnContentWidthPx =
    columnsPerPage === 2
      ? (getPaperWidthPx(paperSize, orientation) - pagePaddingPx * 2 - TWO_COLUMN_GAP_PX) / 2
      : null;
  const measurementWidthPx =
    columnsPerPage === 2 && columnContentWidthPx !== null
      ? columnContentWidthPx + pagePaddingPx * 2
      : getPaperWidthPx(paperSize, orientation);

  const groups = useMemo(() => {
    if (config.kind !== "table" || !rows.length) return [];
    return groupRows(rows, config.getGroupKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, report.printable, config.kind]);

  type MeasureTarget = {
    key: string;
    rows: Record<string, any>[];
    showBrand: boolean;
    density: ReportDensity;
    // Defaults to true/true (a group/record's natural full render) for
    // every target except the continuation-offset probe below, which needs
    // isFirstPage=false to measure what a REAL continuation page's top
    // overhead actually is instead of guessing a fixed px value.
    isFirstPage?: boolean;
    isLastPage?: boolean;
    resultStats?: ResultStats;
  };

  const CONTINUATION_PROBE_KEY = "table-continuation-probe";

  const measureTargets: MeasureTarget[] = useMemo(() => {
    if (loading || !rows.length) return [];

    if (config.kind === "table") {
      // Includes resultStats so the off-screen measurement reflects the
      // stats box's real height - otherwise firstRowOffsetPx would be
      // under-measured and the real first page's table could start too high,
      // colliding with the box actually rendered above it.
      const tableTargets = groups.map((groupRowsData, i) => ({
        key: `table-${i}`,
        rows: groupRowsData,
        showBrand: showBrandAtAll,
        density: getDensity(report, groupRowsData, paperSize, orientation),
        resultStats:
          report.printable === "academic-result" ? getResultStats(groupRowsData) : undefined,
      }));

      // One extra off-screen probe (not tied to any real group) rendered
      // with isFirstPage=false so the effect can measure exactly how much
      // top overhead a continuation page has - reading it from the DOM
      // instead of assuming every table-kind component uses the same
      // hardcoded margin utility.
      return [
        ...tableTargets,
        {
          key: CONTINUATION_PROBE_KEY,
          rows: [rows[0]],
          showBrand: false,
          density: getDensity(report, groups[0] ?? rows, paperSize, orientation),
          isFirstPage: false,
          isLastPage: false,
        },
      ];
    }

    if (config.kind === "grid") {
      return [{ key: "grid", rows, showBrand: showBrandAtAll, density: "comfortable" }];
    }

    // "single" always renders as exactly one page from the full row set (see
    // the runMeasurement effect below) with no per-row/per-group height
    // measurement needed to decide that.
    if (config.kind === "single") return [];

    return rows.map((row, i) => ({
      key: `blocks-${i}`,
      rows: [row],
      showBrand: showBrandAtAll && i === 0,
      density: "comfortable",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rows, report, paperSize, orientation, groups, config.kind, showBrandAtAll]);

  useLayoutEffect(() => {
    if (loading || !rows.length) {
      setResolvedPages(null);
      return;
    }

    let cancelled = false;

    const runMeasurement = () => {
      if (cancelled) return;

      const paddingMm = getPagePaddingMm(paperSize);
      const paddingPx = paddingMm * MM_TO_CSS_PX;
      const availableHeightPx = getPaperHeightPx(paperSize, orientation) - paddingPx * 2;

      const nextPages: ResolvedPage[] = [];
      let globalStartIndex = 0;
      let isVeryFirstPage = true;

      if (config.kind === "table") {
        const probeContainer = measureRefs.current.get(CONTINUATION_PROBE_KEY);
        const continuationOffsetPx = probeContainer
          ? measureTableGroupContainer(probeContainer, paddingPx).firstRowOffsetPx
          : CONTINUATION_TOP_OFFSET_PX;

        if (columnsPerPage === 2) {
          const measurements = groups.map((_, groupIndex) => {
            const container = measureRefs.current.get(`table-${groupIndex}`);
            return container ? measureTableGroupContainer(container, paddingPx) : null;
          });

          if (measurements.every((m): m is TableGroupMeasurement => m !== null)) {
            const chunks = packColumnsAcrossGroups(groups, measurements, availableHeightPx, continuationOffsetPx);

            chunks.forEach((chunk, chunkIndex) => {
              const groupRowsData = groups[chunk.groupIndex];
              const resultStats =
                report.printable === "academic-result" ? getResultStats(groupRowsData) : undefined;

              nextPages.push({
                key: `${report.key}-table-${chunk.groupIndex}-${chunkIndex}`,
                rows: chunk.rows,
                startIndex: globalStartIndex,
                isFirstPageOfGroup: chunk.isFirstChunkOfGroup,
                isFirstPage: chunk.isFirstChunkOfGroup,
                isLastPage: chunk.isLastChunkOfGroup,
                density: getDensity(report, groupRowsData, paperSize, orientation),
                resultStats,
                startsNewColumn: chunk.startsNewColumn,
              });
              globalStartIndex += chunk.rows.length;
            });
          }
        } else {
          groups.forEach((groupRowsData, groupIndex) => {
            const container = measureRefs.current.get(`table-${groupIndex}`);
            if (!container) return;

            const measurement = measureTableGroupContainer(container, paddingPx);
            const producedPages = paginateTableGroup(measurement, groupRowsData, availableHeightPx, continuationOffsetPx);
            const resultStats =
              report.printable === "academic-result" ? getResultStats(groupRowsData) : undefined;

            producedPages.forEach((pageRows, pageIndexInGroup) => {
              nextPages.push({
                key: `${report.key}-table-${groupIndex}-${pageIndexInGroup}`,
                rows: pageRows,
                startIndex: globalStartIndex,
                isFirstPageOfGroup: pageIndexInGroup === 0,
                isFirstPage: pageIndexInGroup === 0,
                isLastPage: pageIndexInGroup === producedPages.length - 1,
                density: getDensity(report, groupRowsData, paperSize, orientation),
                resultStats,
              });
              globalStartIndex += pageRows.length;
            });
          });
        }
      } else if (config.kind === "grid") {
        const container = measureRefs.current.get("grid");
        if (container) {
          const measurement = measureGridContainer(container, paddingPx);
          const producedPages = paginateGrid(measurement, availableHeightPx);

          producedPages.forEach((cardIndices, pageIndex) => {
            nextPages.push({
              key: `${report.key}-grid-${pageIndex}`,
              rows: cardIndices.map((i) => rows[i]),
              startIndex: 0,
              isFirstPageOfGroup: pageIndex === 0,
              isFirstPage: true,
              isLastPage: true,
              density: "comfortable",
            });
          });
        }
      } else if (config.kind === "single") {
        // admit-card-with-rules: always exactly one page (the exam rules
        // notice), never one page per student - see ReportContent's routing
        // for this printable and AdmitCardRulesPage.
        nextPages.push({
          key: `${report.key}-single`,
          rows,
          startIndex: 0,
          isFirstPageOfGroup: true,
          isFirstPage: true,
          isLastPage: true,
          density: "comfortable",
        });
      } else {
        const continuationBudgetPx = availableHeightPx - CONTINUATION_TOP_OFFSET_PX;
        const firstContainer = measureRefs.current.get("blocks-0");
        const firstRecordBrandHeightPx =
          showBrandAtAll && firstContainer
            ? firstContainer.querySelector(".report-brand-header")?.getBoundingClientRect().height ?? 0
            : 0;

        rows.forEach((row, rowIndex) => {
          const container = measureRefs.current.get(`blocks-${rowIndex}`);
          if (!container) return;

          const firstPageBudgetPx =
            rowIndex === 0 ? availableHeightPx - firstRecordBrandHeightPx : availableHeightPx;
          const recordPages = measureAndSplitRecord(
            container,
            paddingPx,
            firstPageBudgetPx,
            continuationBudgetPx,
          );

          recordPages.forEach((recordPage, pageIndexInRecord) => {
            nextPages.push({
              key: `${report.key}-blocks-${rowIndex}-${pageIndexInRecord}`,
              rows: [row],
              startIndex: 0,
              isFirstPageOfGroup: isVeryFirstPage,
              isFirstPage: recordPage.isFirstPage,
              isLastPage: recordPage.isLastPage,
              density: "comfortable",
              bodyTextOverride: recordPage.bodyTextOverride,
            });
            isVeryFirstPage = false;
          });
        });
      }

      setResolvedPages(
        nextPages.length
          ? nextPages
          : [
              {
                key: `${report.key}-empty`,
                rows: [],
                startIndex: 0,
                isFirstPageOfGroup: true,
                isFirstPage: true,
                isLastPage: true,
                density: "comfortable",
              },
            ],
      );
    };

    runMeasurement();

    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(runMeasurement).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading,
    rows,
    report,
    paperSize,
    orientation,
    groups,
    config.kind,
    showBrandAtAll,
    measureTargets,
    idCardTemplateLoaded,
  ]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      const availableWidth = Math.max(240, viewport.clientWidth - 16);
      const paperWidth = getPaperWidthPx(paperSize, orientation);
      const nextScale = Math.min(1, availableWidth / paperWidth);
      setPreviewScale(Number(nextScale.toFixed(3)));
    };

    updateScale();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScale) : null;
    observer?.observe(viewport);
    window.addEventListener("resize", updateScale);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [orientation, paperSize]);

  const scaleStyle = { "--report-preview-scale": previewScale } as CSSProperties;

  const statusPage: ResolvedPage = {
    key: `${report.key}-status`,
    rows: [],
    startIndex: 0,
    isFirstPageOfGroup: true,
    isFirstPage: true,
    isLastPage: true,
    density: "comfortable",
  };

  const fallbackPages: ResolvedPage[] = rows.length
    ? [
        {
          key: `${report.key}-fallback`,
          rows,
          startIndex: 0,
          isFirstPageOfGroup: true,
          isFirstPage: true,
          isLastPage: true,
          density: getDensity(report, rows, paperSize, orientation),
          resultStats: report.printable === "academic-result" ? getResultStats(rows) : undefined,
        },
      ]
    : [statusPage];

  const pages = loading || !rows.length ? [statusPage] : resolvedPages ?? fallbackPages;

  // columnsPerPage:2 only: fold the flat chunk sequence back into columns
  // (a column can hold several stacked chunks when classes packed together -
  // see packColumnsAcrossGroups) so each one renders as a vertical stack
  // inside its own column div, sharing a single letterhead at the top.
  const twoColColumns =
    columnsPerPage === 2
      ? pages.reduce<ResolvedPage[][]>((columns, page) => {
          if (page.startsNewColumn || columns.length === 0) columns.push([page]);
          else columns[columns.length - 1].push(page);
          return columns;
        }, [])
      : null;

  return (
    <>
      {measureTargets.length > 0 && (
        <div aria-hidden="true" style={{ position: "fixed", top: 0, left: "-99999px", visibility: "hidden" }}>
          {measureTargets.map((target) => (
            <div
              key={target.key}
              ref={(el) => {
                if (el) measureRefs.current.set(target.key, el);
                else measureRefs.current.delete(target.key);
              }}
              className="print-page-preview report-print-page bg-white"
              data-report={report.printable || "table"}
              data-paper-size={paperSize}
              data-orientation={orientation}
              data-density={target.density}
              style={{
                width: `${measurementWidthPx}px`,
                padding: `${getPagePaddingMm(paperSize)}mm`,
                height: "auto",
                overflow: "visible",
              }}
            >
              {target.showBrand && (
                <ReportBrandHeader
                  compactMaxWidthPx={columnsPerPage === 2 ? columnContentWidthPx ?? undefined : undefined}
                  hideLogo={columnsPerPage === 2}
                />
              )}
              <div className="report-content-body">
                <ReportContent
                  loading={false}
                  report={report}
                  rows={target.rows}
                  selectedDivisionName={selectedDivisionName}
                  selectedClassName={selectedClassName}
                  startIndex={0}
                  isFirstPage={target.isFirstPage ?? true}
                  isLastPage={target.isLastPage ?? true}
                  resultStats={target.resultStats}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={viewportRef} className="print-preview-viewport">
        <div className="print-area print-pages" style={scaleStyle}>
          {columnsPerPage === 2 && twoColColumns
            ? Array.from({ length: Math.ceil(twoColColumns.length / 2) }, (_, physicalIndex) => {
                const left = twoColColumns[physicalIndex * 2];
                const right = twoColColumns[physicalIndex * 2 + 1];
                const physicalPageCount = Math.ceil(twoColColumns.length / 2);

                return (
                  <section
                    key={left?.[0]?.key ?? `${report.key}-2col-${physicalIndex}`}
                    className="print-page-preview report-print-page bg-white"
                    data-report={report.printable || "table"}
                    data-paper-size={paperSize}
                    data-orientation={orientation}
                    data-density={left?.[0]?.density ?? right?.[0]?.density ?? "comfortable"}
                  >
                    <ReportBackground />
                    <ReportWatermark />
                    <div className="report-page-footer">
                      <span className="report-page-footer-label">পৃষ্ঠা:</span>
                      <span className="report-page-footer-number">
                        {toBanglaDigits(physicalIndex + 1)}/{toBanglaDigits(physicalPageCount)}
                      </span>
                    </div>
                    <div className="report-content-body flex">
                      <div style={{ width: columnContentWidthPx ?? undefined, flex: "none" }}>
                        {left?.map((chunk, chunkIndex) => (
                          <div key={chunk.key}>
                            {chunkIndex > 0 && (
                              <div
                                aria-hidden="true"
                                style={{ height: COLUMN_CLASS_GAP_PX, display: "flex", alignItems: "center" }}
                              >
                                <div style={{ width: "100%", height: 1, background: "#94a3b8" }} />
                              </div>
                            )}
                            {showBrandAtAll && chunk.isFirstPage && (
                              <ReportBrandHeader compactMaxWidthPx={columnContentWidthPx ?? undefined} hideLogo />
                            )}
                            <ReportContent
                              loading={loading}
                              report={report}
                              rows={chunk.rows}
                              selectedDivisionName={selectedDivisionName}
                              selectedClassName={selectedClassName}
                              startIndex={chunk.startIndex}
                              isFirstPage={chunk.isFirstPage}
                              isLastPage={chunk.isLastPage}
                              bodyTextOverride={chunk.bodyTextOverride}
                              resultStats={chunk.resultStats}
                            />
                          </div>
                        ))}
                      </div>
                      <div
                        aria-hidden="true"
                        style={{ width: TWO_COLUMN_GAP_PX, flex: "none", display: "flex", justifyContent: "center" }}
                      >
                        <div style={{ width: 1, alignSelf: "stretch", background: "#94a3b8" }} />
                      </div>
                      <div style={{ width: columnContentWidthPx ?? undefined, flex: "none" }}>
                        {right?.map((chunk, chunkIndex) => (
                          <div key={chunk.key}>
                            {chunkIndex > 0 && (
                              <div
                                aria-hidden="true"
                                style={{ height: COLUMN_CLASS_GAP_PX, display: "flex", alignItems: "center" }}
                              >
                                <div style={{ width: "100%", height: 1, background: "#94a3b8" }} />
                              </div>
                            )}
                            {showBrandAtAll && chunk.isFirstPage && (
                              <ReportBrandHeader compactMaxWidthPx={columnContentWidthPx ?? undefined} hideLogo />
                            )}
                            <ReportContent
                              loading={loading}
                              report={report}
                              rows={chunk.rows}
                              selectedDivisionName={selectedDivisionName}
                              selectedClassName={selectedClassName}
                              startIndex={chunk.startIndex}
                              isFirstPage={chunk.isFirstPage}
                              isLastPage={chunk.isLastPage}
                              bodyTextOverride={chunk.bodyTextOverride}
                              resultStats={chunk.resultStats}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })
            : pages.map((page, pageIndex) => {
                const showsBrandHeader = showBrandAtAll && page.isFirstPageOfGroup;

                return (
                  <section
                    key={page.key}
                    className="print-page-preview report-print-page bg-white"
                    data-report={report.printable || "table"}
                    data-paper-size={paperSize}
                    data-orientation={orientation}
                    data-density={page.density}
                  >
                    <ReportBackground />
                    <ReportWatermark />
                    {showsBrandHeader && <ReportBrandHeader />}
                    <div className="report-page-footer">
                      <span className="report-page-footer-label">পৃষ্ঠা:</span>
                      <span className="report-page-footer-number">
                        {toBanglaDigits(pageIndex + 1)}/{toBanglaDigits(pages.length)}
                      </span>
                    </div>
                    <div className="report-content-body">
                      <ReportContent
                        loading={loading}
                        report={report}
                        rows={page.rows}
                        selectedDivisionName={selectedDivisionName}
                        selectedClassName={selectedClassName}
                        startIndex={page.startIndex}
                        isFirstPage={page.isFirstPage}
                        isLastPage={page.isLastPage}
                        bodyTextOverride={page.bodyTextOverride}
                        resultStats={page.resultStats}
                      />
                    </div>
                  </section>
                );
              })}
        </div>
      </div>
    </>
  );
};

export default PaginatedReportPreview;
