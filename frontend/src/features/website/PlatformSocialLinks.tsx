import { SiFacebook, SiInstagram, SiWhatsapp, SiYoutube } from "react-icons/si";
import type { IconType } from "react-icons";

type SocialLink = { href: string; label: string; Icon: IconType; background: string };

export function getWebsiteSocialLinks(
  settings: Record<string, any>,
  whatsappLabel: string,
): SocialLink[] {
  return [
    { href: settings.facebook_url, label: "Facebook", Icon: SiFacebook, background: "#1877F2" },
    { href: settings.youtube_url, label: "YouTube", Icon: SiYoutube, background: "#FF0000" },
    {
      href: settings.instagram_url,
      label: "Instagram",
      Icon: SiInstagram,
      background: "linear-gradient(135deg, #833AB4, #E1306C, #FCAF45)",
    },
    {
      href: settings.whatsapp_channel_url,
      label: whatsappLabel,
      Icon: SiWhatsapp,
      background: "#25D366",
    },
  ].filter((link) => Boolean(link.href));
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
      {links.map(({ href, label, Icon, background }) => (
        <a
          key={label}
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
