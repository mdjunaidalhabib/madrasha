import type { IconType } from "react-icons";
import { SiDiscord, SiFacebook, SiInstagram, SiTelegram, SiTiktok, SiWhatsapp, SiX, SiYoutube } from "react-icons/si";
import { FaFlag, FaLinkedinIn, FaUsers } from "react-icons/fa6";
import { Globe, Link2 } from "lucide-react";

export const WEBSITE_SOCIAL_PLATFORMS = {
  facebook: { label: "Facebook", Icon: SiFacebook, background: "#1877F2", placeholder: "https://facebook.com/yourpage" },
  facebook_page: { label: "Facebook Page", Icon: FaFlag, background: "#1877F2", placeholder: "https://facebook.com/yourpage" },
  facebook_group: { label: "Facebook Group", Icon: FaUsers, background: "#1877F2", placeholder: "https://facebook.com/groups/yourgroup" },
  youtube: { label: "YouTube", Icon: SiYoutube, background: "#FF0000", placeholder: "https://youtube.com/@yourchannel" },
  instagram: { label: "Instagram", Icon: SiInstagram, background: "linear-gradient(135deg, #833AB4, #E1306C, #FCAF45)", placeholder: "https://instagram.com/yourname" },
  whatsapp: { label: "WhatsApp", Icon: SiWhatsapp, background: "#25D366", placeholder: "01712345678 / https://whatsapp.com/channel/..." },
  telegram: { label: "Telegram", Icon: SiTelegram, background: "#168ACD", placeholder: "https://t.me/yourchannel" },
  tiktok: { label: "TikTok", Icon: SiTiktok, background: "#111111", placeholder: "https://tiktok.com/@yourname" },
  x: { label: "X", Icon: SiX, background: "#111111", placeholder: "https://x.com/yourname" },
  linkedin: { label: "LinkedIn", Icon: FaLinkedinIn, background: "#0A66C2", placeholder: "https://linkedin.com/company/yourname" },
  discord: { label: "Discord", Icon: SiDiscord, background: "#5865F2", placeholder: "https://discord.gg/yourinvite" },
  website: { label: "Website", Icon: Globe as IconType, background: "#0F766E", placeholder: "https://example.com" },
  other: { label: "Other", Icon: Link2 as IconType, background: "#475569", placeholder: "https://example.com" },
};

export type WebsiteSocialPlatform = keyof typeof WEBSITE_SOCIAL_PLATFORMS;
export type WebsiteSocialLink = { platform: WebsiteSocialPlatform; label?: string; url: string };
export const MAX_WEBSITE_SOCIAL_LINKS = 20;

export const LEGACY_SOCIAL_FIELDS = {
  facebook: "facebook_url", youtube: "youtube_url", instagram: "instagram_url", whatsapp: "whatsapp_channel_url",
} as const;

export function getWebsiteSocialItems(settings: Record<string, any>): WebsiteSocialLink[] {
  // An explicitly empty list must stay empty after deleting the last link.
  if (Array.isArray(settings.social_links)) return settings.social_links.filter((link: WebsiteSocialLink) =>
    link && Object.prototype.hasOwnProperty.call(WEBSITE_SOCIAL_PLATFORMS, link.platform) && typeof link.url === "string",
  );
  return Object.entries(LEGACY_SOCIAL_FIELDS).flatMap(([platform, field]) =>
    settings[field] ? [{ platform: platform as WebsiteSocialPlatform, url: settings[field] }] : [],
  );
}

export function normalizeWebsiteSocialUrl(value: string, platform?: WebsiteSocialPlatform): string | null {
  const trimmed = value.trim();
  if (platform === "whatsapp") {
    const phone = trimmed.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
    if (/^\+?[\d\s()-]+$/.test(phone)) {
      let digits = phone.replace(/\D/g, "");
      if (/^01[3-9]\d{8}$/.test(digits)) digits = `88${digits}`;
      return /^[1-9]\d{6,14}$/.test(digits) ? `https://wa.me/${digits}` : null;
    }
  }
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".") && !url.username && !url.password && url.href.length <= 500 ? url.href : null;
  } catch { return null; }
}
