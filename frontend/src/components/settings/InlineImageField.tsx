import { useState } from "react";
import { Pencil, Images } from "lucide-react";
import Button from "../ui/Button";
import BrandImageBox from "./BrandImageBox";
import { useToastStore } from "../../store/toastStore";
import { CLOUD_NOT_CONFIGURED_MSG, isPendingCloudUpload } from "../../utils/cloudUpload";
import type { UploadFolder } from "../../services/phase4Api";

export default function InlineImageField({
  label,
  hint,
  value,
  folder,
  shape,
  onSave,
}: {
  label: string;
  hint?: string;
  value: string | null | undefined;
  folder?: UploadFolder;
  shape?: "square" | "wide";
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
    if (isPendingCloudUpload(draft)) {
      useToastStore.getState().show(CLOUD_NOT_CONFIGURED_MSG, "error");
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // error toast already shown by onSave
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="group flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 transition hover:border-gray-200 hover:bg-gray-50/60">
        {value ? (
          <img
            src={value}
            alt={label}
            className={`shrink-0 rounded-lg border border-gray-200 bg-white object-contain ${
              shape === "wide" ? "h-14 w-24" : "h-14 w-14"
            }`}
          />
        ) : (
          <div
            className={`flex shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300 ${
              shape === "wide" ? "h-14 w-24" : "h-14 w-14"
            }`}
          >
            <Images size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-sm text-gray-900">
            {value ? "আপলোড করা আছে" : <span className="text-gray-400">যোগ করা হয়নি</span>}
          </p>
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
      <div className="max-w-xs">
        <BrandImageBox
          label={label}
          hint={hint}
          folder={folder}
          shape={shape}
          value={draft}
          onChange={setDraft}
          onRemove={() => setDraft("")}
        />
      </div>
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
