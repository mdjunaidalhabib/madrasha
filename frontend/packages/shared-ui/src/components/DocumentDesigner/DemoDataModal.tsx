import Modal from "../ui/Modal";
import Button from "../ui/Button";
import type { FieldBinding } from "./fieldBindings";

export interface DemoDataModalProps {
  open: boolean;
  onClose: () => void;
  fields: FieldBinding[];
  /** Effective row (base data with any overrides already merged in) - used
   * to show each field's current value. */
  row: Record<string, any>;
  onChangeField: (field: string, value: string) => void;
  onReset: () => void;
  hasOverrides: boolean;
}

/**
 * Lets an admin tweak the sample values used to preview a template in the
 * designer - a very long name to check truncation, a missing photo to check
 * the placeholder, etc. - without needing a matching real student record.
 * Purely local/in-memory: nothing here is sent to the backend or persisted.
 */
export default function DemoDataModal({
  open,
  onClose,
  fields,
  row,
  onChangeField,
  onReset,
  hasOverrides,
}: DemoDataModalProps) {
  if (!open) return null;

  return (
    <Modal open={open} title="ডেমো ডেটা এডিট করুন" onClose={onClose} maxWidthClassName="max-w-lg">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        এখানে যা বদলাবেন তা শুধু এই ডিজাইনারের প্রিভিউতে দেখাবে — কোনো প্রকৃত তথ্য পরিবর্তিত বা সংরক্ষিত হবে না।
      </p>

      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.field}>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{f.label}</label>
            {f.isImage ? (
              <div className="flex items-center gap-2">
                {row[f.field] && (
                  <img
                    src={String(row[f.field])}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                  />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => onChangeField(f.field, reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                  className="flex-1 text-xs"
                />
              </div>
            ) : (
              <input
                type="text"
                value={row[f.field] ?? ""}
                onChange={(e) => onChangeField(f.field, e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onReset}
          disabled={!hasOverrides}
          className="text-xs font-medium text-rose-600 underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-400"
        >
          মূল ডেটায় ফিরিয়ে নিন
        </button>
        <Button type="button" onClick={onClose}>
          বন্ধ করুন
        </Button>
      </div>
    </Modal>
  );
}
