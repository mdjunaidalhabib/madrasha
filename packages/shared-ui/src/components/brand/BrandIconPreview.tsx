import { ImageIcon, Loader2 } from "lucide-react";
import { useText } from "../../i18n";
import { brandIconPreviewText } from "./brandIconPreview.text";

export type BrandIconPreviewItem = {
  /** Icon file name, e.g. "favicon-32.png" - decides the label and the mock-up. */
  file: string;
  /** Anything an <img> can show: a data URI (unsaved preview) or the live icon URL. */
  src: string;
  size?: number;
};

type Props = {
  icons: BrandIconPreviewItem[];
  loading?: boolean;
  error?: boolean;
  /** Short line under the title, e.g. which part of the product uses these icons. */
  note?: string;
  /** Tab title for the browser-tab mock-up (the page / app name). */
  tabTitle?: string;
};

// Same order everywhere, regardless of how the server lists them.
const ORDER = ["favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "maskable-512.png"];

const CHECKER =
  "bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0] bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] dark:opacity-100";

/**
 * Shows every favicon / PWA icon generated from a logo, each in a realistic
 * mock-up (browser tab, iOS tile, transparent app icon, round Android mask), so
 * the person can see what the logo turns into before and after saving.
 */
export default function BrandIconPreview({ icons, loading, error, note, tabTitle }: Props) {
  const t = useText(brandIconPreviewText);
  const byFile = new Map(icons.map((i) => [i.file, i]));
  const items = ORDER.map((f) => byFile.get(f)).filter(Boolean) as BrandIconPreviewItem[];

  const label = (file: string) => (t as unknown as Record<string, { name: string; use: string }>)[file];

  return (
    <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-start gap-2">
        <ImageIcon size={16} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{t.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-slate-400">{t.subtitle}</p>
          {note && <p className="mt-1 text-xs font-medium text-gray-600 dark:text-slate-300">{note}</p>}
        </div>
      </div>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          {t.loading}
        </p>
      ) : error ? (
        <p className="mt-4 text-xs text-red-600 dark:text-red-400">{t.failed}</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-xs text-gray-400 dark:text-slate-500">{t.empty}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((icon) => {
            const info = label(icon.file);
            return (
              <div key={icon.file} className="flex flex-col rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex h-28 items-center justify-center overflow-hidden rounded-md bg-gray-100 dark:bg-slate-800">
                  {icon.file === "favicon-32.png" && (
                    <div className="flex w-40 items-center gap-2 rounded-t-lg border border-b-0 border-gray-300 bg-white px-2.5 py-2 shadow-sm dark:border-slate-600 dark:bg-slate-700">
                      <img src={icon.src} alt="" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" />
                      <span className="truncate text-[11px] text-gray-600 dark:text-slate-200">{tabTitle || t.tabTitle}</span>
                    </div>
                  )}

                  {icon.file === "apple-touch-icon.png" && (
                    <img src={icon.src} alt="" className="h-20 w-20 rounded-[22%] object-contain shadow-md" />
                  )}

                  {(icon.file === "icon-192.png" || icon.file === "icon-512.png") && (
                    <div className={`flex h-20 w-20 items-center justify-center rounded-lg ${CHECKER}`}>
                      <img src={icon.src} alt="" className="h-full w-full object-contain" />
                    </div>
                  )}

                  {icon.file === "maskable-512.png" && (
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <img src={icon.src} alt="" className="h-16 w-16 object-contain shadow" />
                        <span className="text-[10px] text-gray-400 dark:text-slate-500">{t.maskSquare}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <img src={icon.src} alt="" className="h-16 w-16 rounded-full object-cover shadow" />
                        <span className="text-[10px] text-gray-400 dark:text-slate-500">{t.maskCircle}</span>
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs font-bold text-gray-800 dark:text-slate-100">
                  {info?.name ?? icon.file}
                  <span className="ms-1 font-mono text-[10px] font-normal text-gray-400 dark:text-slate-500">
                    {icon.size ? `${icon.size}×${icon.size}` : ""}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-slate-400">{info?.use}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
