import { z } from "zod";

export const websiteSocialLinksSchema = z.array(z.object({
  platform: z.enum(["facebook", "youtube", "instagram", "whatsapp", "telegram", "tiktok", "x", "linkedin", "discord", "website", "other"]),
  label: z.string().trim().max(80).optional(),
  url: z.string().trim().min(1).max(500).transform((value, ctx) => {
    try {
      if (/\s/.test(value)) throw new Error();
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password || url.href.length > 500) throw new Error();
      return url.href;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid social link URL" });
      return z.NEVER;
    }
  }),
}).strict()).max(20);
