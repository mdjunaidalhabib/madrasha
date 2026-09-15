import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { notificationApi, type NotificationEventKey, type NotificationSettingItem } from "../../services/phase4Api";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";

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
  RESULT_PUBLISHED: {
    title: "পরীক্ষার ফলাফল প্রকাশের পর",
    hint: "তালিমাত প্যানেলে কোনো পরীক্ষার ফলাফল প্রকাশ করলে সংশ্লিষ্ট শ্রেণির প্রতিটি শিক্ষার্থীর অভিভাবককে স্বয়ংক্রিয়ভাবে SMS যাবে",
    placeholders: "{name} {class} {exam}",
  },
  EXAM_FEE_ACTIVATED: {
    title: "পরীক্ষার ফি চালু হওয়ার পর",
    hint: "কোনো পরীক্ষার ফি চালু (activate) করলে সংশ্লিষ্ট শিক্ষার্থীর অভিভাবককে স্বয়ংক্রিয়ভাবে SMS যাবে",
    placeholders: "{name} {amount} {exam}",
  },
};

const AutoNotificationSettingsPage = () => {
  const [settings, setSettings] = useState<NotificationSettingItem[]>([]);
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  // Inline read-mode/edit-mode for the template field (same pattern as the
  // Pencil -> Check/X edit flow on FeeCategorySettingsPage) - a draft copy so
  // Cancel can discard keystrokes without touching the saved `settings` state.
  const [editingKey, setEditingKey] = useState<NotificationEventKey | null>(null);
  const [draftTemplate, setDraftTemplate] = useState("");
  const [savingTemplateKey, setSavingTemplateKey] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await notificationApi.getSettings();
      setSettings(res.data.data?.items || []);
      setMasterEnabled(res.data.data?.masterEnabled ?? true);
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

  const toggleItemEnabled = async (item: NotificationSettingItem) => {
    if (togglingKey) return;
    const next = !item.isEnabled;

    setTogglingKey(item.eventKey);
    patch(item.eventKey, { isEnabled: next });

    try {
      await notificationApi.updateSetting(item.eventKey, { isEnabled: next });
    } catch (err: any) {
      patch(item.eventKey, { isEnabled: !next });
      const msg = err?.response?.data?.message || "সেভ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setTogglingKey(null);
    }
  };

  const startEditTemplate = (item: NotificationSettingItem) => {
    setEditingKey(item.eventKey);
    setDraftTemplate(item.template);
  };

  const cancelEditTemplate = () => setEditingKey(null);

  const saveTemplate = async (item: NotificationSettingItem) => {
    try {
      setSavingTemplateKey(item.eventKey);
      await notificationApi.updateSetting(item.eventKey, { template: draftTemplate });
      patch(item.eventKey, { template: draftTemplate });
      setEditingKey(null);
      useToastStore.getState().show("বার্তা সেভ হয়েছে", "success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সেভ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSavingTemplateKey(null);
    }
  };

  // Master switch is a pause/resume gate, not a bulk "set everything" action -
  // flipping it never touches any individual item's isEnabled below, so
  // turning it back on resumes sending exactly per each item's own already-
  // configured state instead of forcing them all back on.
  const toggleMaster = async () => {
    if (savingAll) return;
    const next = !masterEnabled;

    setSavingAll(true);
    setMasterEnabled(next);

    try {
      await notificationApi.updateMasterSetting(next);
      useToastStore.getState().show(next ? "সবগুলো চালু হয়েছে" : "সবগুলো বন্ধ হয়েছে", "success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সেভ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
      setMasterEnabled(!next);
    } finally {
      setSavingAll(false);
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
            {settings.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20 sm:p-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200">সবগুলো নোটিফিকেশন</h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                    বন্ধ করলে নিচের সবগুলো অটো SMS সাময়িকভাবে বন্ধ থাকবে (কোনটার সেটিংস বদলাবে না); আবার চালু করলে যার যার আগের অবস্থায় ফিরে যাবে
                  </p>
                </div>
                <ToggleSwitch checked={masterEnabled} onChange={toggleMaster} disabled={savingAll} />
              </div>
            )}
            {settings.map((item) => {
              const meta = EVENT_LABELS[item.eventKey];
              // Master switch off => every lower card is fully locked (toggle,
              // template, edit - none of it does anything) and visibly dimmed,
              // regardless of that item's own on/off state, so it's obvious at
              // a glance that the whole page is paused. Turning the master
              // back on unlocks everything again, unchanged.
              const locked = !masterEnabled;
              const isEditing = editingKey === item.eventKey;
              return (
                <div
                  key={item.eventKey}
                  className={`rounded-xl p-3 shadow-sm transition sm:p-4 ${
                    locked
                      ? "bg-gray-200/80 opacity-60 grayscale dark:bg-slate-800/80"
                      : "bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-200">
                        {meta.title}
                        {locked && (
                          <span className="rounded-full bg-gray-400 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-slate-600">
                            বন্ধ
                          </span>
                        )}
                      </h2>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{meta.hint}</p>
                    </div>
                    <ToggleSwitch
                      checked={item.isEnabled}
                      onChange={() => toggleItemEnabled(item)}
                      disabled={locked || togglingKey === item.eventKey}
                      title={locked ? "আগে উপরের 'সবগুলো নোটিফিকেশন' চালু করুন" : undefined}
                    />
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={draftTemplate}
                        onChange={(e) => setDraftTemplate(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full rounded-md border border-blue-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-blue-800 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <p className="text-xs text-gray-400 dark:text-slate-500">প্লেসহোল্ডার: {meta.placeholders}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingTemplateKey === item.eventKey}
                          onClick={() => saveTemplate(item)}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Check size={14} />
                          {savingTemplateKey === item.eventKey ? "সেভ হচ্ছে..." : "সংরক্ষণ করুন"}
                        </button>
                        <button
                          type="button"
                          disabled={savingTemplateKey === item.eventKey}
                          onClick={cancelEditTemplate}
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          <X size={14} />
                          বাতিল
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group flex items-start justify-between gap-2 rounded-md border border-gray-100 bg-gray-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/40">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-slate-300">
                        {item.template}
                      </p>
                      <button
                        type="button"
                        disabled={locked || !item.isEnabled}
                        title="সম্পাদনা"
                        onClick={() => startEditTemplate(item)}
                        className="shrink-0 rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}
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
