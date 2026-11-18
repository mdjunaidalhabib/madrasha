import { useEffect, useRef, useState, type ReactNode } from "react";
import { SiGooglemaps } from "react-icons/si";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { uiText } from "@madrasha/shared-ui/src/components/ui/ui.text";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { getWebsiteSocialItems, LEGACY_SOCIAL_FIELDS, normalizeWebsiteSocialUrl, type WebsiteSocialLink } from "@madrasha/shared-ui/src/website/socialLinks";
import SectionCard from "../../../components/settings/SectionCard";
import InlineTextField from "../../../components/settings/InlineTextField";
import { getWebsiteSettings, saveWebsiteSettings, type WebsiteSettingsPayload } from "../../../services/websiteApi";
import { useAuthStore } from "../../../store/authStore";
import { useBrandingStore } from "../../../store/brandingStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { hasPermission } from "../../../utils/permissions";
import WebsiteSocialLinksEditor from "../website-builder/WebsiteSocialLinksEditor";
import { websiteText } from "../website-builder/website.text";

export default function WebsiteContactSettings({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  if (!hasPermission(user, permissions, "website.manage")) return <>{children}</>;
  return <WebsiteContactFields key={user?.madrasa_id} madrasaId={user?.madrasa_id}>{children}</WebsiteContactFields>;
}

function WebsiteContactFields({ madrasaId, children }: { madrasaId?: number; children?: ReactNode }) {
  const t = useText(websiteText);
  const ui = useText(uiText);
  const address = useBrandingStore((s) => s.branding?.address);
  const toast = useToastStore((s) => s.show);
  const [settings, setSettings] = useState<WebsiteSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailed(false);
    getWebsiteSettings(madrasaId, true)
      .then((data) => { if (current) setSettings(data?.settings ?? {}); })
      .catch(() => { if (current) setFailed(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [madrasaId, attempt]);

  const save = (patch: Partial<WebsiteSettingsPayload>) => {
    const task = async () => {
      try {
        // This endpoint replaces all website settings. Read the latest values
        // before each queued save so editing contacts preserves the website.
        const data = await getWebsiteSettings(madrasaId, true);
        const next = { ...data.settings, ...patch };
        const madrasa = data.madrasa ?? {};
        await saveWebsiteSettings({
          ...next,
          madrasa_id: madrasaId,
          name: madrasa.name,
          phone: madrasa.phone,
          email: madrasa.email,
          address: madrasa.address,
        });
        setSettings(next);
        toast(t.saved, "success");
      } catch (error) {
        toast(t.saveFailed, "error");
        throw error;
      }
    };
    const result = saveQueue.current.then(task, task);
    saveQueue.current = result.catch(() => {});
    return result;
  };

  if (loading) return <><SkeletonCard lines={2} />{children}</>;
  if (failed || !settings) return (
    <><SectionCard title={t.socialLinks}>
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t.loadFailed}</p>
      <Button className="mt-3" onClick={() => setAttempt((value) => value + 1)}>{ui.retry}</Button>
    </SectionCard>{children}</>
  );

  const mapsUrl = settings.map_url || (address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "");

  return <>
    <SectionCard title={t.socialLinks} hint={t.socialLinksHint}>
      <WebsiteSocialLinksEditor
        values={getWebsiteSocialItems(settings)}
        onSave={(links: WebsiteSocialLink[]) => {
          const legacy = Object.fromEntries(Object.entries(LEGACY_SOCIAL_FIELDS).map(([platform, field]) => [field, links.find((link) => link.platform === platform)?.url || ""]));
          return save({ ...legacy, social_links: links });
        }}
      />
    </SectionCard>
    {children}
    <SectionCard title={t.locationMap} hint={t.locationMapHint}>
      <InlineTextField
        label={t.mapsLink}
        value={settings.map_url || ""}
        placeholder="https://maps.app.goo.gl/..."
        linkPreview={{
          icon: <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#34A853] text-white"><SiGooglemaps size={16} aria-hidden="true" /></span>,
          href: normalizeWebsiteSocialUrl(mapsUrl),
          openLabel: t.openMap,
        }}
        onSave={async (value) => {
          if (value) {
            try {
              const url = new URL(value);
              if (!["http:", "https:"].includes(url.protocol) || value.length > 500) throw new Error();
            } catch {
              toast(t.invalidMapLink, "error");
              throw new Error(t.invalidMapLink);
            }
          }
          await save({ map_url: value });
        }}
      />
    </SectionCard>
  </>;
}
