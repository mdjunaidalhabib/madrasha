import { useEffect, useState } from "react";
import { notificationApi, type NotificationEventKey, type NotificationSettingItem } from "../../services/phase4Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";

const EVENT_LABELS: Record<NotificationEventKey, { title: string; hint: string; placeholders: string }> = {
  ADMISSION: {
    title: "ভর্তি অনুমোদনের পর",
    hint: "একজন শিক্ষার্থীর ভর্তি মুহতামিম অনুমোদন করলে অভিভাবককে স্বয়ংক্রিয়ভাবে SMS যাবে",
    placeholders: "{name} {class} {roll}",
  },
  INFO_UPDATE: {
    title: "শিক্ষার্থীর তথ্য আপডেটের পর",
    hint: "কোনো শিক্ষার্থীর তথ্য এডিট করে সেভ করলে অভিভাবককে স্বয়ংক্রিয়ভাবে SMS যাবে",
    placeholders: "{name} {roll}",
  },
  FEE_PAYMENT: {
    title: "ফি জমা নেওয়ার পর",
    hint: "কোনো ইনভয়েসে পেমেন্ট রেকর্ড করলে অভিভাবককে স্বয়ংক্রিয়ভাবে SMS যাবে",
    placeholders: "{name} {amount} {due}",
  },
  SALARY_PAYMENT: {
    title: "শিক্ষক বেতন পরিশোধের পর",
    hint: "পেরোল পেজে কোনো শিক্ষকের বেতন পরিশোধিত হিসেবে চিহ্নিত করলে তাকে স্বয়ংক্রিয়ভাবে SMS যাবে",
    placeholders: "{name} {amount} {month}",
  },
};

const AutoNotificationSettingsPage = () => {
  const [settings, setSettings] = useState<NotificationSettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await notificationApi.getSettings();
      setSettings(res.data.data || []);
    } catch (err) {
      logger.error("LOAD NOTIFICATION SETTINGS ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = (eventKey: NotificationEventKey, changes: Partial<NotificationSettingItem>) => {
    setSettings((prev) => prev.map((s) => (s.eventKey === eventKey ? { ...s, ...changes } : s)));
  };

  const save = async (item: NotificationSettingItem) => {
    try {
      setSavingKey(item.eventKey);
      await notificationApi.updateSetting(item.eventKey, {
        isEnabled: item.isEnabled,
        template: item.template,
      });
      useToastStore.getState().show("সেটিংস সেভ হয়েছে", "success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সেভ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">অটো নোটিফিকেশন</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            নির্দিষ্ট কাজের পর স্বয়ংক্রিয়ভাবে SMS পাঠানো চালু/বন্ধ করুন ও বার্তা কাস্টমাইজ করুন
          </p>
        </div>

        {loading ? (
          <SkeletonList items={3} />
        ) : (
          <div className="flex flex-col gap-3">
            {settings.map((item) => {
              const meta = EVENT_LABELS[item.eventKey];
              return (
                <div key={item.eventKey} className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{meta.title}</h2>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{meta.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => patch(item.eventKey, { isEnabled: !item.isEnabled })}
                      className={`h-7 w-12 shrink-0 rounded-full transition ${
                        item.isEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`block h-5 w-5 rounded-full bg-white transition ${
                          item.isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <textarea
                    value={item.template}
                    onChange={(e) => patch(item.eventKey, { template: e.target.value })}
                    rows={3}
                    disabled={!item.isEnabled}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none disabled:opacity-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">প্লেসহোল্ডার: {meta.placeholders}</p>

                  <button
                    type="button"
                    disabled={savingKey === item.eventKey}
                    onClick={() => save(item)}
                    className="mt-2 h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingKey === item.eventKey ? "সেভ হচ্ছে..." : "সেভ করুন"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoNotificationSettingsPage;
