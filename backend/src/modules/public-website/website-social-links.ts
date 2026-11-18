import { z } from "zod";

export const websiteSocialLinksSchema = z.array(z.object({
  platform: z.enum(["facebook", "facebook_page", "facebook_group", "youtube", "instagram", "whatsapp", "telegram", "tiktok", "x", "linkedin", "discord", "website", "other"]),
  label: z.string().trim().max(80).optional(),
  url: z.string().trim().min(1).max(500),
}).strict().transform((link, ctx) => {
    let value = link.url;
    if (link.platform === "whatsapp") {
      const phone = value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
      if (/^\+?[\d\s()-]+$/.test(phone)) {
        let digits = phone.replace(/\D/g, "");
        if (/^01[3-9]\d{8}$/.test(digits)) digits = `88${digits}`;
        if (!/^[1-9]\d{6,14}$/.test(digits)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "Invalid WhatsApp number" });
          return z.NEVER;
        }
        value = `https://wa.me/${digits}`;
      }
    }
    try {
      if (/\s/.test(value)) throw new Error();
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password || url.href.length > 500) throw new Error();
      return { ...link, url: url.href };
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid social link URL" });
      return z.NEVER;
    }
})).max(20);
