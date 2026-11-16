import { ExternalLink } from "lucide-react";
import { useLang } from "@madrasha/shared-ui/src/i18n";

export default function InstitutionWebsiteLink({ slug, iconOnly = false }: { slug: string; iconOnly?: boolean }) {
  const lang = useLang();
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  const baseUrl = configuredUrl || (
    import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:5183`
      : "https://ems.hikmahit.com"
  );

  if (!slug) return null;
  const label = lang === "bn" ? "ওয়েবসাইট দেখুন" : "View website";

  return (
    <a
      href={`${baseUrl.replace(/\/+$/, "")}/m/${encodeURIComponent(slug)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${iconOnly ? "h-7 w-7" : "px-2 py-1.5"}`}
    >
      {!iconOnly && label}
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}
