import { useEffect, useMemo } from "react";
import type { BackendDocumentType } from "@madrasha/shared-ui/src/components/DocumentDesigner/documentTypeMap";
import { DOCUMENT_TYPE_TO_KIND } from "@madrasha/shared-ui/src/components/DocumentDesigner/documentTypeMap";
import type { DocumentLayout } from "@madrasha/shared-ui/src/components/DocumentDesigner/types";
import {
  DEFAULT_ID_CARD_BACK_ID,
  getBuiltinDesign,
  getDefaultBuiltinDesign,
  isBuiltinDesignId,
} from "@madrasha/shared-ui/src/components/DocumentDesigner/builtin/registry";
import { useDocumentTemplateDetailStore } from "../../../../store/documentTemplateDetailStore";
import { useBrandingStore } from "../../../../store/brandingStore";

export type ResolvedDocumentLayout = {
  layout: DocumentLayout | null;
  /** false = নির্বাচিত DB টেমপ্লেট এখনো আসছে - এই পাসে কিছু রেন্ডার না করাই ভালো। */
  loaded: boolean;
};

/**
 * একটি ডকুমেন্টের ডিজাইন ঠিক করে:
 *   - templateId নেই (null)  → ডিফল্ট "সাধারণ" বিল্ট-ইন ডিজাইন (আইডি কার্ড/প্রবেশপত্র);
 *                              লেটার-ধাঁচের ডকুমেন্টে layout = null, মানে কলার সাধারণ
 *                              রিপোর্ট-ধাঁচের ফলব্যাক দেখাবে।
 *   - templateId < 0         → বিল্ট-ইন ডিজাইন (কোডে লেখা)।
 *   - templateId > 0         → DB টেমপ্লেট (নিজস্ব/সিস্টেম), একবার এনে ক্যাশ।
 *
 * আগে "ডিফল্ট" মানে ছিল ট্যানেন্টের auto-migrate হওয়া DB ডিফল্ট টেমপ্লেট;
 * এখন ডিফল্ট সবসময় সাধারণ ডিজাইন, আর অন্য ডিজাইন ব্যবহারকারী নিজে বেছে নেয়।
 */
export const useDocumentLayout = (
  type: BackendDocumentType,
  templateId: number | null | undefined,
): ResolvedDocumentLayout => {
  const dbId = typeof templateId === "number" && templateId > 0 ? templateId : 0;
  const isDbTemplate = dbId > 0;
  const detail = useDocumentTemplateDetailStore((s) => (dbId ? s.details[dbId] : undefined));
  const ensure = useDocumentTemplateDetailStore((s) => s.ensure);

  useEffect(() => {
    if (dbId) ensure(dbId);
  }, [dbId, ensure]);

  return useMemo(() => {
    const builtin = isBuiltinDesignId(templateId) ? getBuiltinDesign(templateId) : null;
    const design = builtin ?? (templateId ? null : getDefaultBuiltinDesign(type));

    if (design) {
      return {
        loaded: true,
        layout: {
          id: `builtin-${design.key}`,
          kind: DOCUMENT_TYPE_TO_KIND[type],
          width: design.width,
          height: design.height,
          background: design.background,
          layers: design.layers,
        },
      };
    }

    if (!isDbTemplate) return { layout: null, loaded: true };
    if (detail === undefined) return { layout: null, loaded: false };

    const version = detail?.published || detail?.draft;
    if (!detail || !version) return { layout: null, loaded: true };

    return {
      loaded: true,
      layout: {
        id: String(detail.id),
        kind: DOCUMENT_TYPE_TO_KIND[type],
        width: version.width,
        height: version.height,
        background: version.background || undefined,
        layers: version.layers,
      },
    };
  }, [type, templateId, isDbTemplate, detail]);
};

/**
 * আইডি কার্ডের পিছনের পাতার লেআউট: ঋণাত্মক id = বিল্ট-ইন (ডিফল্ট/রেডিমেড), ধনাত্মক id = নিজস্ব/সিস্টেম
 * টেমপ্লেট (ID_CARD টাইপের যেকোনো টেমপ্লেট পিছনের পাতা হিসেবে বাছা যায়)। অজানা id → ডিফল্ট পিছন।
 * backId = null → পিছনের পাতা নেই (null)।
 */
export const useBackLayout = (backId: number | null): DocumentLayout | null => {
  const known = backId !== null && (backId > 0 || getBuiltinDesign(backId)?.side === "back");
  const { layout } = useDocumentLayout("ID_CARD", known ? backId : DEFAULT_ID_CARD_BACK_ID);
  return backId === null ? null : layout;
};

/**
 * প্রতিটি row-তে মাদরাসার নাম/ঠিকানা/ফোন/লোগো যোগ করে - ডিজাইনের
 * {{madrasa_name}} ইত্যাদি টোকেন ও `madrasa_logo` ছবি-ফিল্ড এখান থেকেই ভরে।
 * ফাঁকা মান " " (একটি স্পেস) - না হলে টোকেন রেন্ডারার ফাঁকাকে "—" দেখাত।
 */
export const useBrandedRows = (rows: Record<string, any>[]) => {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return useMemo((): Record<string, any>[] => {
    const extra = {
      madrasa_name: branding?.name || " ",
      madrasa_address: branding?.address || " ",
      madrasa_phone: branding?.phones?.filter(Boolean).join(", ") || " ",
      madrasa_logo: branding?.report_logo || "",
    };
    return rows.map((row) => ({ ...row, ...extra }));
  }, [rows, branding]);
};
