import { getWebsiteSocialItems, normalizeWebsiteSocialUrl } from "@madrasha/shared-ui/src/website/socialLinks";

export function getBrandingContact(madrasa: Record<string, any> | null | undefined, settings: Record<string, any> = {}) {
  const phones: string[] = madrasa?.phones || [];
  const emails: string[] = madrasa?.emails || [];
  const whatsapp = getWebsiteSocialItems(settings).find((link) => link.platform === "whatsapp");
  const digits = (phones[0] || "").replace(/\D/g, "");
  return {
    phones,
    emails,
    whatsappUrl: (whatsapp && normalizeWebsiteSocialUrl(whatsapp.url, "whatsapp")) || (digits ? `https://wa.me/${digits}` : ""),
  };
}
