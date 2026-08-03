import { useState } from "react";
import { Pencil } from "lucide-react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useToastStore } from "../../store/toastStore";

export const textAreaClass =
  "w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

/**
 * Read-only by default; click the pencil to edit that one field in place and
 * save it — the rest of the section stays read-only.
 */
export default function InlineTextField({
  label,
  value,
  placeholder,
  hint,
  multiline,
  rows = 3,
  type = "text",
  required,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  type?: "text" | "color";
  required?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(value || "");
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    if (required && !draft.trim()) {
      useToastStore.getState().show(`${label} খালি রাখা যাবে না।`, "error");
      return;
    }
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch {
      // error toast already shown by onSave — stay in edit mode so the user can retry
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 transition hover:border-gray-200 hover:bg-gray-50/60">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          {type === "color" ? (
            <span className="mt-1 inline-flex items-center gap-2">
              <span
                className="h-5 w-5 rounded border border-gray-200"
                style={{ backgroundColor: value || "#2563eb" }}
              />
              <span className="text-sm text-gray-900">{value || "#2563eb"}</span>
            </span>
          ) : (
            <p className="mt-0.5 whitespace-pre-line break-words text-sm text-gray-900">
              {value?.trim() ? value : <span className="text-gray-400">যোগ করা হয়নি</span>}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100"
          title="সম্পাদনা"
        >
          <Pencil size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <p className="mb-1.5 text-xs font-medium text-gray-500">{label}</p>
      {hint && <p className="mb-2 text-xs text-gray-500">{hint}</p>}
      {multiline ? (
        <textarea
          autoFocus
          rows={rows}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className={textAreaClass}
        />
      ) : type === "color" ? (
        <input
          type="color"
          autoFocus
          value={draft || "#2563eb"}
          onChange={(e) => setDraft(e.target.value)}
          className="h-10 w-24 cursor-pointer rounded-lg border border-gray-300 p-1"
        />
      ) : (
        <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
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
