import { useEffect, useMemo } from "react";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { useBrandingStore } from "../../../../store/brandingStore";
import { useIdCardBackStore } from "../../../../store/idCardBackStore";

/** "2026-01-31" → "৩১/০১/২০২৬"; ফাঁকা/ভুল হলে " " (একটি স্পেস - না হলে টোকেন রেন্ডারার "—" দেখায়)। */
export const formatCardDate = (iso: string | null | undefined) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return match ? toBanglaDigits(`${match[3]}/${match[2]}/${match[1]}`) : " ";
};

/**
 * আইডি কার্ডের পিছনের পাতার টোকেন (ইস্যু/মেয়াদ তারিখ, অধ্যক্ষের পদবি ও স্বাক্ষর, হারিয়ে গেলে
 * ফেরতের ঠিকানা) প্রতিটি row-তে যোগ করে - Talimat → সেটিং → "আইডি কার্ড ব্যাক" পেজে সেভ করা
 * মান থেকে। ফেরতের ঠিকানা না দিলে মাদরাসার ঠিকানা ও ফোন ডিফল্ট। `enabled` = false হলে কিছু
 * fetch/যোগ করে না (পিছনের পাতা বন্ধ)।
 */
export const useIdCardBackRows = (rows: Record<string, any>[], enabled: boolean) => {
  const settings = useIdCardBackStore((s) => s.settings);
  const fetchSettings = useIdCardBackStore((s) => s.fetchSettings);
  const branding = useBrandingStore((s) => s.branding);

  useEffect(() => {
    if (enabled) fetchSettings();
  }, [enabled, fetchSettings]);

  return useMemo((): Record<string, any>[] => {
    if (!enabled) return rows;

    const phone = branding?.phones?.filter(Boolean).join(", ");
    const defaultReturn = [branding?.address, phone ? `ফোন: ${phone}` : ""].filter(Boolean).join("\n");
    const extra = {
      id_issue_date: formatCardDate(settings?.issue_date),
      id_expiry_date: formatCardDate(settings?.expiry_date),
      principal_title: settings?.principal_title || "অধ্যক্ষ",
      principal_signature: settings?.principal_signature || "",
      id_lost_return: settings?.lost_return_text || defaultReturn || " ",
    };
    return rows.map((row) => ({ ...row, ...extra }));
  }, [rows, enabled, settings, branding]);
};
