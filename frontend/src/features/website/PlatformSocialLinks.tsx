import { getWebsiteSocialItems, normalizeWebsiteSocialUrl, WEBSITE_SOCIAL_PLATFORMS } from "@madrasha/shared-ui/src/website/socialLinks";
import type { IconType } from "react-icons";

type SocialLink = { href: string; label: string; Icon: IconType; background: string };

export function getWebsiteSocialLinks(
  settings: Record<string, any>,
  whatsappLabel: string,
): SocialLink[] {
  return getWebsiteSocialItems(settings).flatMap(link => {
    const href = normalizeWebsiteSocialUrl(link.url);
    if (!href) return [];
    const platform = WEBSITE_SOCIAL_PLATFORMS[link.platform];
    return [{ href, label: link.label || (link.platform === "whatsapp" ? whatsappLabel : platform.label), Icon: platform.Icon, background: platform.background }];
  });
}

export default function PlatformSocialLinks({
  links,
  compact = false,
  className = "",
}: {
  links: SocialLink[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {links.map(({ href, label, Icon, background }, index) => (
        <a
          key={`${index}-${href}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`inline-flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 ${compact ? "h-8 w-8" : "h-10 w-10"}`}
          style={{ background }}
        >
          <Icon size={compact ? 16 : 20} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
