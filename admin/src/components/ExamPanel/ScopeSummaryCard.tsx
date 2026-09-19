import { useEffect, useState } from "react";
import { Check, Layers, Pencil, RotateCcw, Sparkles, X } from "lucide-react";
import api from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { reportFailMarkSaved } from "./failMarkFeedback";
import { hasOwnGrading, parseFailMarkDraft, type DivisionFailMark } from "./divisionGrading";
import DivisionStatusChip from "./DivisionStatusChip";

const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

const numberInput =
  "w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-lg font-bold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

/** Summary header for the selected grading scope: name, big fail-mark display
 * with inline edit, and the scope's actions (enable own grading / return to
 * default). `division` is null for the default scope. */
export default function ScopeSummaryCard({
  division,
  defaultFailMark,
  reload,
}: {
  division: DivisionFailMark | null;
  defaultFailMark: number;
  reload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const isDefault = division === null;
  const own = hasOwnGrading(division);
  const shown = isDefault ? defaultFailMark : own ? Number(division!.fail_mark) : defaultFailMark;
  const scopeKey = division?.division_id ?? "default";

  // A different scope was selected: drop any half-finished edit.
  useEffect(() => {
    setEditing(false);
    setEnabling(false);
    setDraft("");
  }, [scopeKey]);

  const startEdit = () => {
    setDraft(String(shown));
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setEnabling(false);
    setDraft("");
  };

  const save = async (savedMessage?: string) => {
    const value = parseFailMarkDraft(draft);
    if (value === null) {
      return useToastStore.getState().show("০ থেকে ১০০ এর মধ্যে পূর্ণসংখ্যা ফেল মার্ক দিন", "error");
    }

    try {
      setSaving(true);
      if (isDefault) await api.post("/fail-mark", { value });
      else await api.post(`/fail-mark/divisions/${division!.division_id}`, { value });
      reportFailMarkSaved(savedMessage);
      cancel();
      reload();
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || "আপডেট করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (!division) return;
    useConfirmStore.getState().show({
      title: "ডিফল্টে ফিরে যাবেন?",
      message: `"${division.name}" বিভাগের আলাদা ফেল মার্ক ও এই বিভাগের নিজস্ব সব গ্রেড মুছে যাবে। বিভাগটি সাধারণ ফেল মার্ক (${toBanglaDigits(defaultFailMark)}) ও ডিফল্ট গ্রেড ব্যবহার করবে।`,
      confirmText: "ডিফল্টে ফিরুন",
      danger: true,
      onConfirm: async () => {
        try {
          await api.post(`/fail-mark/divisions/${division.division_id}`, { value: null });
          reportFailMarkSaved("ডিফল্টে ফিরে গেছে");
          reload();
        } catch (err: any) {
          useToastStore.getState().show(err?.response?.data?.message || "ডিফল্টে ফেরানো যায়নি", "error");
        }
      },
    });
  };

  const onKeyDown = (savedMessage?: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save(savedMessage);
    if (e.key === "Escape") cancel();
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <Layers size={14} />
            নির্বাচিত স্কোপ
          </div>
          <h2 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
            {isDefault ? "ডিফল্ট (সব বিভাগের জন্য)" : division!.name}
          </h2>
          {isDefault ? (
            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              সাধারণ গ্রেডিং
            </span>
          ) : (
            <DivisionStatusChip failMark={division!.fail_mark} />
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 sm:min-w-[13rem]">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">ফেল মার্ক</div>
          {editing || enabling ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                aria-label="ফেল মার্ক"
                className={numberInput}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown(enabling ? "নিজস্ব গ্রেডিং চালু হয়েছে" : undefined)}
                autoFocus
              />
              {editing && (
                <>
                  <button
                    type="button"
                    onClick={() => save()}
                    disabled={saving}
                    className={`${iconBtn} bg-emerald-600 text-white hover:bg-emerald-700`}
                    aria-label="সংরক্ষণ করুন"
                    title="সংরক্ষণ করুন"
                  >
                    <Check size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={saving}
                    className={`${iconBtn} border border-slate-200 text-slate-500 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700`}
                    aria-label="বাতিল করুন"
                    title="বাতিল করুন"
                  >
                    <X size={17} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="mt-0.5 flex items-center gap-2">
              <span
                className={`text-4xl font-extrabold leading-none tabular-nums ${
                  isDefault || own ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {toBanglaDigits(shown)}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">নম্বর</span>
              {(isDefault || own) && (
                <button
                  type="button"
                  onClick={startEdit}
                  className={`${iconBtn} ml-auto border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100`}
                  aria-label="ফেল মার্ক পরিবর্তন করুন"
                  title="ফেল মার্ক পরিবর্তন করুন"
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
          )}
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {(enabling || editing ? parseFailMarkDraft(draft) ?? shown : shown) > 0
              ? `${toBanglaDigits(0)}–${toBanglaDigits((enabling || editing ? parseFailMarkDraft(draft) ?? shown : shown) - 1)} ফেল · `
              : ""}
            পাস শুরু {toBanglaDigits(enabling || editing ? parseFailMarkDraft(draft) ?? shown : shown)} থেকে
          </p>
        </div>
      </div>

      {isDefault && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          যে বিভাগের নিজস্ব গ্রেডিং চালু নেই, সেগুলো এই ফেল মার্ক ও নিচের ডিফল্ট গ্রেড ব্যবহার করে। ফেল মার্ক বদলালে সর্বনিম্ন
          গ্রেডের সীমা স্বয়ংক্রিয়ভাবে মিলে যায়।
        </p>
      )}

      {!isDefault && !own && !enabling && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            এই বিভাগ ডিফল্ট গ্রেডিং ব্যবহার করছে (ফেল মার্ক {toBanglaDigits(defaultFailMark)})
          </p>
          <Button
            className="shrink-0 gap-2"
            onClick={() => {
              setDraft(String(defaultFailMark));
              setEnabling(true);
            }}
          >
            <Sparkles size={16} />
            এই বিভাগের জন্য নিজস্ব গ্রেডিং চালু করুন
          </Button>
        </div>
      )}

      {!isDefault && !own && enabling && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            ওপরের ঘরে এই বিভাগের ফেল মার্ক দিন (ডিফল্ট: {toBanglaDigits(defaultFailMark)})। চালু করলে ডিফল্ট গ্রেডগুলোর একটি কপি এই
            বিভাগের জন্য তৈরি হবে এবং সর্বনিম্ন গ্রেড নতুন ফেল মার্কের সাথে মিলিয়ে নেওয়া হবে। এরপর গ্রেডগুলো আলাদাভাবে সম্পাদনা করা যাবে।
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save("নিজস্ব গ্রেডিং চালু হয়েছে")} disabled={saving} className="gap-2">
              <Check size={16} />
              {saving ? "চালু হচ্ছে..." : "চালু করুন"}
            </Button>
            <Button variant="secondary" onClick={cancel} disabled={saving}>
              বাতিল
            </Button>
          </div>
        </div>
      )}

      {!isDefault && own && (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            এই বিভাগের নিজস্ব গ্রেড ও ফেল মার্ক ব্যবহার হচ্ছে। ডিফল্টে ফিরলে নিজস্ব সব গ্রেড মুছে যাবে।
          </p>
          <Button variant="danger" className="shrink-0 gap-2" onClick={resetToDefault}>
            <RotateCcw size={15} />
            ডিফল্টে ফিরুন
          </Button>
        </div>
      )}

    </section>
  );
}
