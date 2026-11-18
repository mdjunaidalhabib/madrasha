import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { commonText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { MAX_WEBSITE_SOCIAL_LINKS, WEBSITE_SOCIAL_PLATFORMS, normalizeWebsiteSocialUrl, type WebsiteSocialLink, type WebsiteSocialPlatform } from "@madrasha/shared-ui/src/website/socialLinks";

export default function WebsiteSocialLinksEditor({ values, onSave }: {
  values: WebsiteSocialLink[];
  onSave: (links: WebsiteSocialLink[]) => Promise<void>;
}) {
  const lang = useLang();
  const bn = lang === "bn";
  const c = useText(commonText);
  const [draft, setDraft] = useState(() => values.map(link => ({ ...link })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(values);
  const patch = (index: number, value: Partial<WebsiteSocialLink>) => {
    setDraft(rows => rows.map((row, i) => i === index ? { ...row, ...value } : row));
    setError("");
  };
  const save = async () => {
    const normalized = draft.map(link => ({ ...link, label: link.label?.trim() || "", url: normalizeWebsiteSocialUrl(link.url) }));
    if (normalized.some(link => !link.url)) {
      setError(bn ? "প্রতিটি লিংকে সঠিক ওয়েব ঠিকানা দিন অথবা খালি সারিটি মুছে ফেলুন।" : "Enter a valid web address for each link or delete the empty row.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(normalized as WebsiteSocialLink[]);
      setDraft(normalized as WebsiteSocialLink[]);
    } catch {
      setError(bn ? "সংরক্ষণ হয়নি। আবার চেষ্টা করুন।" : "Could not save. Please try again.");
    } finally { setSaving(false); }
  };
  const fieldClass = "h-10 min-w-0 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  return <fieldset disabled={saving} className="min-w-0 space-y-3">
    {draft.length === 0 && <p className="py-3 text-sm text-gray-500">{bn ? "কোনো সোশ্যাল লিংক নেই। নতুন প্ল্যাটফর্ম যোগ করুন।" : "No social links. Add a platform to get started."}</p>}
    {draft.map((link, index) => {
      const platform = WEBSITE_SOCIAL_PLATFORMS[link.platform];
      const Icon = platform.Icon;
      return <div key={index} className="min-w-0 rounded-xl border border-gray-200 p-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: platform.background }}><Icon size={20} aria-hidden="true" /></span>
          <select aria-label={bn ? "প্ল্যাটফর্ম" : "Platform"} value={link.platform} onChange={event => patch(index, { platform: event.target.value as WebsiteSocialPlatform })} className={fieldClass}>
            {Object.entries(WEBSITE_SOCIAL_PLATFORMS).map(([key, item]) => <option key={key} value={key}>{key === "other" && bn ? "অন্যান্য প্ল্যাটফর্ম" : item.label}</option>)}
          </select>
          <button type="button" onClick={() => { setDraft(rows => rows.filter((_, i) => i !== index)); setError(""); }} aria-label={`${c.delete} ${link.label || platform.label}`} title={c.delete} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={18} /></button>
        </div>
        <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <input className={fieldClass} value={link.label || ""} maxLength={80} aria-label={bn ? "নাম (ঐচ্ছিক)" : "Name (optional)"} placeholder={bn ? "নাম (ঐচ্ছিক)" : "Name (optional)"} onChange={event => patch(index, { label: event.target.value })} />
          <input className={fieldClass} dir="ltr" type="url" value={link.url} maxLength={500} aria-label={`${platform.label} ${bn ? "লিংক" : "link"}`} placeholder={platform.placeholder} onChange={event => patch(index, { url: event.target.value })} />
        </div>
      </div>;
    })}
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button type="button" variant="secondary" disabled={draft.length >= MAX_WEBSITE_SOCIAL_LINKS} onClick={() => setDraft(rows => [...rows, { platform: "facebook", url: "" }])}><Plus size={16} />{bn ? "প্ল্যাটফর্ম যোগ করুন" : "Add platform"}</Button>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={!dirty} onClick={() => { setDraft(values.map(link => ({ ...link }))); setError(""); }}>{c.cancel}</Button>
        <Button type="button" disabled={!dirty} onClick={save}>{saving ? c.saving : c.save}</Button>
      </div>
    </div>
  </fieldset>;
}
