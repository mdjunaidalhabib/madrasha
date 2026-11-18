import { Mail, MapPin, Phone } from "lucide-react";
import { SiWhatsapp as WhatsAppIcon } from "react-icons/si";
import PlatformSocialLinks, { getWebsiteSocialLinks } from "./PlatformSocialLinks";
import type { ThemeTokens } from "./themes";
import MapPreview from "./MapPreview";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { websiteText } from "./website.text";
import { getBrandingContact } from "./brandingContact";




/**
 * যোগাযোগ page body. Rendered inside PublicWebsitePage (view="contact") so the
 * site's navbar, notice bar and footer stay put and only this content swaps.
 */
export default function ContactSection({
  madrasa,
  settings,
  pageMap,
  theme,
  accentSolid,
  onAccent,
}: {
  madrasa: any;
  settings: any;
  pageMap: Record<string, any>;
  theme: ThemeTokens;
  accentSolid: string;
  onAccent: string;
}) {
  const t = useText(websiteText);
  const mapsUrl =
    settings.map_url ||
    (madrasa?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(madrasa.address)}`
      : "");

  const socials = getWebsiteSocialLinks(madrasa || {}, t.whatsappChannel);
  const { phones, emails, whatsappUrl } = getBrandingContact(madrasa);

  const rows = [
    ...(phones.length ? phones : [""]).map((phone) => ({
      icon: <Phone size={20} />,
      label: t.phone,
      value: phone,
      href: phone ? `tel:${phone}` : undefined,
      external: false,
    })),
    ...(emails.length ? emails : [""]).map((email) => ({
      icon: <Mail size={20} />,
      label: t.email,
      value: email,
      href: email ? `mailto:${email}` : undefined,
      external: false,
    })),
    {
      icon: <MapPin size={20} />,
      label: t.address,
      value: madrasa?.address,
      href: mapsUrl || undefined,
      external: true,
    },
  ];

  return (
    <main className="bg-slate-50 py-12 md:py-16">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="mb-10 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-md"
            style={{ backgroundColor: accentSolid, color: onAccent }}
          >
            <Phone size={24} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">
            {pageMap.contact?.title || t.contact}
          </h1>
          {pageMap.contact?.content && (
            <p className="mx-auto mt-3 max-w-2xl whitespace-pre-line text-sm leading-7 text-slate-600">
              {pageMap.contact.content}
            </p>
          )}
        </div>

        <div className={`grid gap-6 ${mapsUrl ? "lg:grid-cols-5" : ""}`}>
          <div className={`space-y-4 ${mapsUrl ? "lg:col-span-2" : "mx-auto w-full max-w-xl"}`}>
            {rows.map((row) => (
              <div
                key={`${row.label}-${row.value}`}
                className={`flex items-start gap-4 ${theme.card} border border-slate-200/70 bg-white p-5 shadow-sm`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50`}
                  style={{ color: accentSolid }}
                >
                  {row.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {row.label}
                  </span>
                  {row.value && row.href ? (
                    <a href={row.href} target={row.external ? "_blank" : undefined} rel={row.external ? "noopener noreferrer" : undefined} className="mt-1 block break-words text-sm font-medium leading-6 text-slate-800 transition hover:text-blue-700">
                      {row.value}
                    </a>
                  ) : <span className="mt-1 block break-words text-sm leading-6 text-slate-500">{row.value || t.contactDetailsPending}</span>}
                </span>
              </div>
            ))}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
              >
                <WhatsAppIcon size={20} />
                {t.messageOnWhatsApp}
              </a>
            )}

            {socials.length > 0 && (
              <PlatformSocialLinks links={socials} className="justify-center pt-2" />
            )}
          </div>

          {mapsUrl && (
            <MapPreview
              href={mapsUrl}
              title={madrasa?.name}
              address={madrasa?.address}
              label={t.viewOnGoogleMaps}
              className="h-80 rounded-2xl border border-slate-100 shadow-sm lg:col-span-3 lg:h-full lg:min-h-[420px]"
            />
          )}
        </div>
      </div>
    </main>
  );
}
