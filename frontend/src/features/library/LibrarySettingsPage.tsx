import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { librarySettingsApi } from "../../services/phase2Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";

const LibrarySettingsPage = () => {
  const [value, setValue] = useState("5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await librarySettingsApi.getFinePerDay();
        const v = res?.data?.data?.value;
        if (v !== undefined && v !== null) setValue(String(v));
      } catch (err) {
        logger.error("LOAD FINE PER DAY ERROR:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) {
      useToastStore.getState().show("সঠিক পরিমাণ দিন", "error");
      return;
    }
    try {
      setSaving(true);
      await librarySettingsApi.setFinePerDay(num);
      useToastStore.getState().show("জরিমানার হার সংরক্ষণ করা হয়েছে", "success");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-md">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">লাইব্রেরি সেটিংস</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">দেরিতে বই ফেরত দিলে প্রতিদিনের জরিমানার হার নির্ধারণ করুন</p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
            প্রতিদিনের জরিমানা (৳)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={value}
              disabled={loading}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              disabled={saving || loading}
              onClick={handleSave}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={14} />
              {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
            নির্ধারিত তারিখের পর প্রতিদিনের জন্য এই হারে জরিমানা যোগ হবে। হার পরিবর্তন করলে আগে ফেরত দেওয়া বইয়ের জরিমানায় কোনো প্রভাব পড়বে না।
          </p>
        </div>
      </div>
    </div>
  );
};

export default LibrarySettingsPage;
