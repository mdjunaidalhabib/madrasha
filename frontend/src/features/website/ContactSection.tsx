import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from "lucide-react";
import type { ThemeTokens } from "./themes";
import MapPreview from "./MapPreview";

function waLink(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.82.478 3.53 1.31 5.005L2 22l5.147-1.28A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12.001 2zm0 18.222a8.19 8.19 0 0 1-4.169-1.13l-.299-.177-3.055.76.797-2.981-.194-.306A8.19 8.19 0 0 1 3.778 12c0-4.535 3.688-8.222 8.223-8.222 4.535 0 8.222 3.687 8.222 8.222 0 4.535-3.687 8.222-8.222 8.222z" />
    </svg>
  );
}

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
  const mapsUrl =
    settings.map_url ||
    (madrasa?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(madrasa.address)}`
      : "");

  const socials = [
    settings.facebook_url && {
      href: settings.facebook_url,
      label: "Facebook",
      icon: <Facebook size={16} />,
    },
    settings.youtube_url && {
      href: settings.youtube_url,
      label: "YouTube",
      icon: <Youtube size={16} />,
    },
    settings.instagram_url && {
      href: settings.instagram_url,
      label: "Instagram",
      icon: <Instagram size={16} />,
    },
    settings.whatsapp_channel_url && {
      href: settings.whatsapp_channel_url,
      label: "WhatsApp চ্যানেল",
      icon: <WhatsAppIcon size={16} />,
    },
  ].filter(Boolean) as { href: string; label: string; icon: JSX.Element }[];

  const rows = [
    {
      icon: <Phone size={20} />,
      label: "ফোন",
      value: madrasa?.phone,
      href: madrasa?.phone ? `tel:${madrasa.phone}` : undefined,
    },
    {
      icon: <Mail size={20} />,
      label: "ইমেইল",
      value: madrasa?.email,
      href: madrasa?.email ? `mailto:${madrasa.email}` : undefined,
    },
    {
      icon: <MapPin size={20} />,
      label: "ঠিকানা",
      value: madrasa?.address,
      href: mapsUrl || undefined,
      external: true,
    },
  ].filter((row) => row.value);

  return (
    <main className="bg-slate-50 py-12 md:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-10 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-md"
            style={{ backgroundColor: accentSolid, color: onAccent }}
          >
            <Phone size={24} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">
            {pageMap.contact?.title || "যোগাযোগ"}
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
              <a
                key={row.label}
                href={row.href}
                target={row.external ? "_blank" : undefined}
                rel={row.external ? "noreferrer" : undefined}
                className={`flex items-start gap-4 ${theme.card} border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md`}
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center ${theme.tile}`}
                  style={{ backgroundColor: accentSolid, color: onAccent }}
                >
                  {row.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {row.label}
                  </span>
                  <span className="mt-0.5 block break-words text-base font-bold text-slate-800">
                    {row.value}
                  </span>
                </span>
              </a>
            ))}

            {madrasa?.phone && (
              <a
                href={waLink(madrasa.phone)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
              >
                <WhatsAppIcon size={20} />
                হোয়াটসঅ্যাপে মেসেজ করুন
              </a>
            )}

            {socials.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          {mapsUrl && (
            <MapPreview
              href={mapsUrl}
              title={madrasa?.name}
              address={madrasa?.address}
              label="Google Maps-এ লোকেশন দেখুন"
              className="h-80 rounded-2xl border border-slate-100 shadow-sm lg:col-span-3 lg:h-full lg:min-h-[420px]"
            />
          )}
        </div>
      </div>
    </main>
  );
}
