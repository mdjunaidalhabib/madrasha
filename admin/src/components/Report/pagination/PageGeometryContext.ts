import { createContext, useContext } from "react";
import type { PaperSize, Orientation, PageMargins } from "../../common/DataExportPrintActions";
import { getPaperHeightMm, getPaperWidthMm } from "./pageGeometry";
import { getFooterBandReserveMm } from "../ReportBranding";
import { useBrandingStore } from "../../../store/brandingStore";

export type PageGeometry = {
  paperSize: PaperSize;
  orientation: Orientation;
  margins: PageMargins;
};

/**
 * PaginatedReportPreview যে কাগজ/মার্জিনে পাতা আঁকছে সেটা ভেতরের ডকুমেন্ট
 * কম্পোনেন্টগুলোকে (কার্ড শিট, ফিট-টু-পেজ ক্যানভাস) জানায় - যাতে কার্ড বা
 * সনদ কনটেন্ট-বক্সের মধ্যে ঠিক মাপে বসে। ReportContent-এর প্রপ ড্রিলিং ছাড়াই।
 */
export const PageGeometryContext = createContext<PageGeometry | null>(null);

export type ContentBoxMm = { width: number; height: number };

/** পাতার ব্যবহারযোগ্য কনটেন্ট-বক্স (mm) - কাগজ − মার্জিন − ফুটার-ব্যান্ড। Provider না থাকলে null। */
export const usePageContentBoxMm = (): ContentBoxMm | null => {
  const geometry = useContext(PageGeometryContext);
  const branding = useBrandingStore((s) => s.branding);
  if (!geometry) return null;

  const { paperSize, orientation, margins } = geometry;
  return {
    width: getPaperWidthMm(paperSize, orientation) - margins.left - margins.right,
    // 0.5mm সেফটি: পূর্ণ উচ্চতার বক্স কখনো পাতা ছাপিয়ে বাড়তি ফাঁকা পাতা না বানায়।
    height:
      getPaperHeightMm(paperSize, orientation) -
      margins.top -
      margins.bottom -
      getFooterBandReserveMm(branding) -
      0.5,
  };
};
