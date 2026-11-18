import { normalizeWebsiteSocialUrl } from "@madrasha/shared-ui/src/website/socialLinks";

export function getBrandingContact(madrasa: Record<string, any> | null | undefined) {
  const phones: string[] = madrasa?.phones || [];
  const emails: string[] = madrasa?.emails || [];
  const whatsapp = madrasa?.social_links?.find((link: any) => link.platform === "whatsapp");
  const digits = (phones[0] || "").replace(/\D/g, "");
  return {
    phones,
    emails,
    whatsappUrl: (whatsapp && normalizeWebsiteSocialUrl(whatsapp.url)) || (digits ? `https://wa.me/${digits}` : ""),
  };
}
