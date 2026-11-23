import { useEffect } from "react";
import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import { useBrandingStore } from "../../store/brandingStore";
import { reportText } from "./report.text";

/** Apply the institution's saved head-signature caption to printed reports. */
export function useReportText() {
  const text = usePrintText(reportText);
  const signature = useBrandingStore((s) => s.branding?.report_brand_layout?.signature_text);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  useEffect(() => { void fetchBranding(); }, [fetchBranding]);
  return signature?.trim()
    ? { ...text, sign: { ...text.sign, head: signature.trim(), headSeal: signature.trim() } }
    : text;
}
