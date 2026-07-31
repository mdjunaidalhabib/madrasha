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
      return useToastStore.getState().show("০ থেকে ১০০ এর মধ্যে ফেল মার্ক দিন", "error");
    }

    try {
      setIsSaving(true);
      await api.post("/fail-mark", { value: failMark });
      useToastStore.getState().show("আপডেট হয়েছে!", "success");
      setIsEditing(false);
      reload();
    } catch {
      useToastStore.getState().show("আপডেট করা যায়নি", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900">ফেল মার্ক</h2>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="ফেল মার্ক পরিবর্তন করুন"
            title="ফেল মার্ক পরিবর্তন করুন"
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
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={update}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={17} />
              {isSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={17} />
              বাতিল
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
          <span className="text-3xl font-bold text-slate-900">{value}</span>
          <span className="ml-1 text-sm text-slate-500">নম্বর</span>
        </div>
      )}
    </div>
  );
}
