import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { commonText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { MAX_WEBSITE_SOCIAL_LINKS, WEBSITE_SOCIAL_PLATFORMS, normalizeWebsiteSocialUrl, type WebsiteSocialLink, type WebsiteSocialPlatform } from "@madrasha/shared-ui/src/website/socialLinks";

const platforms = Object.entries(WEBSITE_SOCIAL_PLATFORMS) as [WebsiteSocialPlatform, typeof WEBSITE_SOCIAL_PLATFORMS[WebsiteSocialPlatform]][];

function PlatformIcon({ platform, small = false }: { platform: WebsiteSocialPlatform; small?: boolean }) {
  const item = WEBSITE_SOCIAL_PLATFORMS[platform];
  const Icon = item.Icon;
  return <span style={{ background: item.background }} className={`inline-flex shrink-0 items-center justify-center rounded-lg text-white ${small ? "h-6 w-6" : "h-8 w-8"}`}><Icon size={small ? 12 : 16} aria-hidden="true" /></span>;
}

export default function WebsiteSocialLinksEditor({ values, onSave }: {
  values: WebsiteSocialLink[];
  onSave: (links: WebsiteSocialLink[]) => Promise<void>;
}) {
  const bn = useLang() === "bn";
  const c = useText(commonText);
  const tx = (bnText: string, enText: string) => bn ? bnText : enText;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WebsiteSocialLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const filledDraft = draft.filter((link) => link.url.trim() || link.label?.trim());
  const dirty = JSON.stringify(filledDraft) !== JSON.stringify(values);
  const fieldClass = "h-10 min-w-0 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950";
  const iconButton = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800";

  const startEdit = () => {
    setDraft(values.map((link) => ({ ...link })));
    setError("");
    setEditing(true);
  };
  const patch = (index: number, value: Partial<WebsiteSocialLink>) => {
    setDraft((previous) => previous.map((row, i) => i === index ? { ...row, ...value } : row));
    setError("");
  };
  const move = (index: number, direction: number) => {
    setDraft((previous) => {
      const next = [...previous];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  };
  const addPlatform = (platform: WebsiteSocialPlatform) => {
    setDraft((previous) => {
      const emptyIndex = previous.findIndex((link) => !link.url.trim() && !link.label?.trim());
      if (emptyIndex >= 0) return previous.map((link, index) => index === emptyIndex ? { ...link, platform } : link);
      return previous.length < MAX_WEBSITE_SOCIAL_LINKS ? [...previous, { platform, url: "" }] : previous;
    });
    setError("");
  };
  const save = async () => {
    const normalized = filledDraft.map((link) => ({ ...link, label: link.label?.trim() || "", url: normalizeWebsiteSocialUrl(link.url) }));
    if (normalized.some((link) => !link.url)) {
      setError(tx("প্রতিটি লিংকে সঠিক ওয়েব ঠিকানা দিন অথবা খালি সারিটি মুছে ফেলুন।", "Enter a valid web address for each link or delete the empty row."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(normalized as WebsiteSocialLink[]);
      setEditing(false);
    } catch {
      setError(tx("সংরক্ষণ হয়নি। আবার চেষ্টা করুন।", "Could not save. Please try again."));
    } finally { setSaving(false); }
  };

  return <div className="min-w-0 space-y-4">
    {!editing && <div className="flex justify-end">
      <button type="button" onClick={startEdit} title={tx("সম্পাদনা", "Edit social links")} aria-label={tx("সোশ্যাল লিংক সম্পাদনা", "Edit social links")} className={iconButton}><Pencil size={15} /></button>
    </div>}

    {!editing && <>
      {values.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center dark:border-slate-700">
        <Link2 className="mx-auto mb-2 text-slate-400" size={24} />
        <p className="text-sm text-slate-500 dark:text-slate-400">{tx("প্রতিষ্ঠানের সোশ্যাল লিংক যোগ করুন", "Add your institution’s social links")}</p>
        <button type="button" onClick={startEdit} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400"><Plus size={15} />{tx("লিংক যোগ করুন", "Add a link")}</button>
      </div> : <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        {values.map((link, index) => {
          const href = normalizeWebsiteSocialUrl(link.url);
          return <div key={`${index}-${link.url}`} className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/30 dark:border-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-800/40">
            <PlatformIcon platform={link.platform} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{link.label || WEBSITE_SOCIAL_PLATFORMS[link.platform].label}</p>
              <p dir="ltr" className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={link.url}>{link.url.replace(/^https?:\/\/(www\.)?/, "")}</p>
            </div>
            {href && <a href={href} target="_blank" rel="noopener noreferrer" className={iconButton} aria-label={`${tx("খুলুন", "Open")} ${link.label || WEBSITE_SOCIAL_PLATFORMS[link.platform].label}`}><ExternalLink size={15} /></a>}
          </div>;
        })}
      </div>}
    </>}

    {editing && <fieldset disabled={saving} className="min-w-0 space-y-4">
      <div className="space-y-2">
        {draft.map((link, index) => {
          const platform = WEBSITE_SOCIAL_PLATFORMS[link.platform];
          return <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900 lg:grid-cols-[150px_minmax(0,1fr)_auto]">
            <div className="flex min-w-0 items-center gap-1.5">
              <PlatformIcon platform={link.platform} small />
              <select aria-label={tx("প্ল্যাটফর্ম", "Platform")} value={link.platform} onChange={(event) => patch(index, { platform: event.target.value as WebsiteSocialPlatform })} className="h-9 min-w-0 max-w-32 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">{platforms.map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
            </div>
              <div className="flex shrink-0 items-center gap-0.5 lg:col-start-3 lg:row-start-1">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className={iconButton} aria-label={`${tx("উপরে নিন", "Move up")} ${index + 1}`}><ArrowUp size={15} /></button>
                <button type="button" disabled={index === draft.length - 1} onClick={() => move(index, 1)} className={iconButton} aria-label={`${tx("নিচে নিন", "Move down")} ${index + 1}`}><ArrowDown size={15} /></button>
                <button type="button" onClick={() => { setDraft((previous) => previous.filter((_, i) => i !== index)); setError(""); }} className={`${iconButton} hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950/40`} aria-label={`${c.delete} ${index + 1}`}><Trash2 size={15} /></button>
              </div>
            <div className="col-span-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:col-span-1 lg:col-start-2 lg:row-start-1">
              <input className={fieldClass} value={link.label || ""} maxLength={80} aria-label={tx("নাম (ঐচ্ছিক)", "Name (optional)")} placeholder={tx("নাম (ঐচ্ছিক)", "Name (optional)")} onChange={(event) => patch(index, { label: event.target.value })} />
              <input className={fieldClass} dir="ltr" type="url" value={link.url} maxLength={500} aria-label={`${platform.label} ${tx("লিংক", "link")}`} placeholder={platform.placeholder} onChange={(event) => patch(index, { url: event.target.value })} />
            </div>
          </div>;
        })}
      </div>

      <div className="flex flex-wrap gap-1" aria-label={tx("প্ল্যাটফর্ম বেছে যোগ করুন", "Choose a platform to add")}>
        {platforms.map(([key, item]) => <button key={key} type="button" disabled={filledDraft.length >= MAX_WEBSITE_SOCIAL_LINKS} onClick={() => addPlatform(key)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"><item.Icon size={11} /><span>{key === "other" ? tx("অন্যান্য", "Other") : item.label}</span><Plus size={10} className="text-slate-400" /></button>)}
      </div>

      <button
        type="button"
        disabled={draft.length >= MAX_WEBSITE_SOCIAL_LINKS}
        onClick={() => { setDraft((previous) => [...previous, { platform: "other", url: "" }]); setError(""); }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-blue-600 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-blue-400 dark:hover:bg-blue-950/30"
      ><Plus size={16} />{draft.length ? tx("আরেকটি লিংক যোগ করুন", "Add another link") : tx("লিংক যোগ করুন", "Add a link")}</button>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">{tx("তীর দিয়ে লিংকের ক্রম বদলান", "Use the arrows to reorder links")} · {filledDraft.length}/{MAX_WEBSITE_SOCIAL_LINKS}</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => { setEditing(false); setError(""); }}>{c.cancel}</Button>
          <Button type="button" disabled={!dirty} onClick={save}><Check size={15} />{saving ? c.saving : c.save}</Button>
        </div>
      </div>
    </fieldset>}
  </div>;
}
