import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Button from "../ui/Button";
import Input from "../ui/Input";

/**
 * Same read-only/click-to-edit pattern as InlineTextField, but for a small
 * repeatable list of values (e.g. multiple phone numbers/emails) instead of
 * a single string.
 */
export default function InlineListField({
  label,
  values,
  placeholder,
  hint,
  type = "text",
  maxItems = 5,
  onSave,
}: {
  label: string;
  values: string[];
  placeholder?: string;
  hint?: string;
  type?: "text" | "tel" | "email";
  maxItems?: number;
  onSave: (values: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(values.length ? values : [""]);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(values.length ? values : [""]);
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const updateAt = (index: number, value: string) => {
    setDraft((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeAt = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => setDraft((prev) => (prev.length >= maxItems ? prev : [...prev, ""]));

  const save = async () => {
    const cleaned = draft.map((v) => v.trim()).filter(Boolean);
    setSaving(true);
    try {
      await onSave(cleaned);
      setEditing(false);
    } catch {
      // error toast already shown by onSave — stay in edit mode so the user can retry
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
          {values.length ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {values.map((v, i) => (
                <span
                  key={i}
                  className="rounded-md bg-gray-100 px-2 py-0.5 text-sm text-gray-900 dark:bg-slate-800 dark:text-slate-100"
                >
                  {v}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-0.5 text-sm text-gray-400 dark:text-slate-500">যোগ করা হয়নি</p>
          )}
        </div>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 sm:opacity-0 sm:group-hover:opacity-100"
          title="সম্পাদনা"
        >
          <Pencil size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
      <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
      {hint && <p className="mb-2 text-xs text-gray-500 dark:text-slate-400">{hint}</p>}

      <div className="space-y-2">
        {draft.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              autoFocus={index === draft.length - 1}
              type={type}
              value={value}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              disabled={draft.length <= 1}
              className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              title="মুছুন"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {draft.length < maxItems && (
        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <Plus size={13} /> আরেকটি যোগ করুন
        </button>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={saving} onClick={cancel}>
          বাতিল
        </Button>
        <Button type="button" disabled={saving} onClick={save}>
          {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
        </Button>
      </div>
    </div>
  );
}
