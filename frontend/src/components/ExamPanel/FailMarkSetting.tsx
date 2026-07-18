import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../../services/api";
import { useToastStore } from "../../store/toastStore";

export default function FailMarkSetting({
  value,
  reload,
}: {
  value: number;
  reload: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [value, isEditing]);

  const cancelEdit = () => {
    setDraft(String(value));
    setIsEditing(false);
  };

  const update = async () => {
    const failMark = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(failMark) || failMark < 0 || failMark > 100) {
      return useToastStore.getState().show("Enter a fail mark between 0 and 100", "error");
    }

    try {
      setIsSaving(true);
      await api.post("/fail-mark", { value: failMark });
      useToastStore.getState().show("Updated!", "success");
      setIsEditing(false);
      reload();
    } catch {
      useToastStore.getState().show("Failed to update", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">❌ Fail Mark</h2>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            aria-label="Edit fail mark"
            title="Edit fail mark"
          >
            <Pencil size={17} />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <input
            type="number"
            min={0}
            max={100}
            className="border rounded-lg px-3 py-2 w-full"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={update}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={17} />
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={17} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-gray-50 px-4 py-5 text-center">
          <span className="text-3xl font-bold text-gray-900">{value}</span>
          <span className="ml-1 text-sm text-gray-500">marks</span>
        </div>
      )}
    </div>
  );
}
