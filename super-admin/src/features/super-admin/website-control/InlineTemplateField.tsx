import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { resolveWebsiteDemoImage } from "../../../services/publicWebsiteUrl";

export const TemplateFieldEditingContext = createContext<(editing: boolean) => void>(() => {});

export default function InlineTemplateField({ label, value, required, max, image, bn, onApply, children }: {
  label: string; value: string; required?: boolean; max: number; image?: boolean; bn: boolean;
  onApply: (value: string) => void;
  children: (draft: string, onChange: (value: string) => void, onBusyChange: (busy: boolean) => void) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useContext(TemplateFieldEditingContext);
  useEffect(() => {
    if (!editing) return;
    notify(true);
    return () => notify(false);
  }, [editing, notify]);
  const apply = () => {
    const next = draft.trim();
    if (required && !next) { setError(bn ? "এই তথ্যটি আবশ্যক।" : "This field is required."); return; }
    if (next.length > max) { setError(bn ? `সর্বোচ্চ ${max} অক্ষর দিন।` : `Use at most ${max} characters.`); return; }
    onApply(next); setEditing(false); setError("");
  };
  if (editing) return <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
    {children(draft, setDraft, setBusy)}
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">{bn ? "প্রয়োগের পর উপরের ‘পরিবর্তন সংরক্ষণ’ বাটনে ক্লিক করুন।" : "After applying, use ‘Save changes’ above to save the demo."}</p>
      <div className="flex gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>{bn ? "বাতিল" : "Cancel"}</Button><Button type="button" disabled={busy} onClick={apply}>{bn ? "প্রয়োগ করুন" : "Apply"}</Button></div>
    </div>
  </div>;
  return <div className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/60">
    <div className="min-w-0 flex-1"><p className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}{required && " *"}</p>
      {image && value && <img src={resolveWebsiteDemoImage(value)} alt={label} className="my-2 h-20 max-w-full rounded-lg bg-slate-50 object-contain dark:bg-slate-800" />}
      <p className="mt-0.5 whitespace-pre-line break-words text-sm text-gray-900 dark:text-slate-100">{value || <span className="text-gray-400 dark:text-slate-500">{bn ? "যোগ করা হয়নি" : "Not added"}</span>}</p>
    </div>
    <button type="button" aria-label={bn ? `${label} সম্পাদনা` : `Edit ${label}`} title={bn ? "সম্পাদনা" : "Edit"} onClick={() => { setDraft(value); setError(""); setEditing(true); }} className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"><Pencil size={14} /></button>
  </div>;
}
