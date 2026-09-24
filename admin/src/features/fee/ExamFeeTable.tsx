import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Lock, RotateCcw, Save, Settings2, X } from "lucide-react";
import { examFeeApi, type ExamFeeExam, type ExamFeeOverview } from "../../services/phase2Api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { normalizeBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";

const toBn = (n: number) => n.toLocaleString("bn-BD");

/** Draft input values keyed "examId:classId" - only cells the user touched. */
type Drafts = Record<string, string>;
const cellKey = (examId: number, classId: number) => `${examId}:${classId}`;

/**
 * পরীক্ষার ফি - one card per exam, one amount per class the exam is held for.
 * The class list comes from the exam's বিভাগ scope, so changing an exam's
 * divisions (পরীক্ষা ব্যবস্থাপনা) reshapes this table by itself; the rows
 * behind it are kept in step by the backend (ExamFeeService).
 */
export default function ExamFeeTable() {
  const [data, setData] = useState<ExamFeeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [savingExamId, setSavingExamId] = useState<number | null>(null);
  /** Bulk-fill inputs: key `${examId}` = the whole exam, `${examId}:${division}` = one বিভাগ. */
  const [bulkValue, setBulkValue] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await examFeeApi.overview();
      setData(res.data?.data ?? null);
    } catch (err) {
      logger.error("LOAD EXAM FEES ERROR:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const classById = useMemo(() => new Map((data?.classes ?? []).map((c) => [c.class_id, c])), [data]);

  const isDirty = (examId: number, cell: ExamFeeExam["cells"][number]) => {
    const draft = drafts[cellKey(examId, cell.class_id)];
    if (draft === undefined) return false;
    const next = draft.trim() === "" ? null : Number(draft);
    return next !== (cell.amount ?? null) && !(next === 0 && cell.amount === null);
  };

  const dirtyCells = (exam: ExamFeeExam) => exam.cells.filter((cell) => isDirty(exam.id, cell));

  /** Drops unsaved edits of the given cells (default: the whole exam) and
   * empties the matching bulk input, so the cells show their saved amounts. */
  const clearDrafts = (exam: ExamFeeExam, cells = exam.cells, bulkKey?: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const cell of cells) delete next[cellKey(exam.id, cell.class_id)];
      return next;
    });
    setBulkValue((prev) => {
      const next = { ...prev };
      if (bulkKey && bulkKey !== String(exam.id)) delete next[bulkKey];
      // Whole-exam clear: the exam's own and every বিভাগ bulk input.
      else
        for (const key of Object.keys(next))
          if (key === String(exam.id) || key.startsWith(`${exam.id}:`)) delete next[key];
      return next;
    });
  };

  const save = async (exam: ExamFeeExam) => {
    const cells = dirtyCells(exam);
    if (!cells.length) return;

    const amounts = cells.map((cell) => {
      const raw = drafts[cellKey(exam.id, cell.class_id)].trim();
      return { class_id: cell.class_id, amount: raw === "" ? null : Number(raw) };
    });
    if (amounts.some((a) => a.amount !== null && (!Number.isFinite(a.amount) || a.amount < 0))) {
      useToastStore.getState().show("সঠিক পরিমাণ লিখুন", "error");
      return;
    }

    try {
      setSavingExamId(exam.id);
      const res = await examFeeApi.setAmounts(exam.id, amounts);
      const result = res.data?.data;
      useToastStore
        .getState()
        .show(
          result?.invoicesCreated
            ? `"${exam.name}" এর ফি সংরক্ষণ হয়েছে — ${toBn(result.invoicesCreated)}টি ইনভয়েস তৈরি হয়েছে`
            : `"${exam.name}" এর ফি সংরক্ষণ হয়েছে`,
          "success",
        );
      clearDrafts(exam);
      await load();
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || "ফি সংরক্ষণ করা যায়নি", "error");
    } finally {
      setSavingExamId(null);
    }
  };

  /** Fills the given cells (the whole exam, or one বিভাগ of it) with the
   * bulk input's value - only drafted, saved with the exam's other edits. */
  const fillCells = (exam: ExamFeeExam, cells: ExamFeeExam["cells"], bulkKey: string) => {
    const value = (bulkValue[bulkKey] ?? "").trim();
    if (value === "") return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const cell of cells) next[cellKey(exam.id, cell.class_id)] = value;
      return next;
    });
  };

  /** "৳ [পরিমাণ] [প্রয়োগ] [✕]" input group, used for both exam- and বিভাগ-wide
   * fills. ✕ shows once there is something to clear - typed amount or unsaved
   * edits in these cells - and puts the cells back to their saved amounts. */
  const renderBulkFill = (
    exam: ExamFeeExam,
    cells: ExamFeeExam["cells"],
    bulkKey: string,
    label: string,
    scopeName: string,
    compact = false,
  ) => {
    const canClear = !!(bulkValue[bulkKey] ?? "").trim() || cells.some((cell) => isDirty(exam.id, cell));
    return (
      <div className="flex shrink-0 items-center gap-1">
        <div
          className={`flex items-stretch overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:ring-blue-950 ${
            compact ? "h-7" : "h-8"
          }`}
        >
          <span className="flex items-center bg-gray-50 px-2 text-xs text-gray-500 dark:bg-slate-800 dark:text-slate-400">
            ৳
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="পরিমাণ"
            value={bulkValue[bulkKey] ?? ""}
            onChange={(e) => setBulkValue((prev) => ({ ...prev, [bulkKey]: normalizeBanglaDigits(e.target.value) }))}
            onKeyDown={(e) => e.key === "Enter" && fillCells(exam, cells, bulkKey)}
            className={`bg-transparent px-2 text-right tabular-nums outline-none dark:text-slate-100 ${
              compact ? "w-16 text-xs" : "w-24 text-sm"
            }`}
            aria-label={label}
          />
          <button
            type="button"
            onClick={() => fillCells(exam, cells, bulkKey)}
            disabled={!(bulkValue[bulkKey] ?? "").trim()}
            title={label}
            className="border-l border-gray-300 bg-gray-50 px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            প্রয়োগ
          </button>
        </div>
        {canClear && (
          <button
            type="button"
            disabled={savingExamId === exam.id}
            onClick={() => clearDrafts(exam, cells, bulkKey)}
            title={`${scopeName} পরিবর্তন মুছুন (আগের সংরক্ষিত ফি ফিরে আসবে)`}
            aria-label={`${scopeName} পরিবর্তন মুছুন`}
            className={`flex shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-400 dark:hover:border-rose-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 ${
              compact ? "h-7 w-7" : "h-8 w-8"
            }`}
          >
            <X size={13} />
          </button>
        )}
      </div>
    );
  };

  const exams = data?.exams ?? [];
  const activeCount = exams.filter((e) => e.fee_active).length;

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="shrink-0 text-gray-400 dark:text-slate-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">পরীক্ষার ফি</h2>
          {exams.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {toBn(exams.length)}টি পরীক্ষা · {toBn(activeCount)}টির ফি চালু
            </span>
          )}
        </div>
        <Link
          to="/talimat/settings/exam"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
        >
          <Settings2 size={14} />
          পরীক্ষা ও বিভাগ ব্যবস্থাপনা
        </Link>
      </div>
      <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
        পরীক্ষার বিভাগের শ্রেণিগুলো নিজে থেকেই আসে। পরীক্ষা চালু না হওয়া পর্যন্ত বিল হয় না, চালু হলে সব ছাত্রের
        ইনভয়েস তৈরি হয়।
      </p>

      {loading && !data ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-xs text-gray-500 dark:border-slate-700 dark:text-slate-400">
          এখনো কোনো পরীক্ষা তৈরি করা হয়নি — পরীক্ষা তৈরি করলে এখানে তার ফি নির্ধারণ করা যাবে।
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => {
            const dirty = dirtyCells(exam).length;
            const saving = savingExamId === exam.id;
            const legacyLocked = exam.legacy_all_classes_amount !== null;
            const setCount = exam.cells.filter((c) => c.amount !== null).length;

            // Cells grouped under their division, in table order.
            const groups: { divisionName: string; cells: typeof exam.cells }[] = [];
            for (const cell of exam.cells) {
              const name = classById.get(cell.class_id)?.division_name_bn || "অন্যান্য";
              const last = groups[groups.length - 1];
              if (last && last.divisionName === name) last.cells.push(cell);
              else groups.push({ divisionName: name, cells: [cell] });
            }

            return (
              <section
                key={exam.id}
                className={`overflow-hidden rounded-xl border ${
                  dirty > 0 ? "border-amber-300 dark:border-amber-800" : "border-gray-200 dark:border-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-4 w-1 shrink-0 rounded-full bg-purple-500" />
                    <h3 className="truncate text-sm font-bold text-gray-800 dark:text-slate-100">
                      {exam.name} <span className="font-normal text-gray-500 dark:text-slate-400">({exam.year})</span>
                    </h3>
                    {!legacyLocked && exam.cells.length > 0 && (
                      <span className="shrink-0 text-xs text-gray-500 dark:text-slate-400">
                        {toBn(setCount)}/{toBn(exam.cells.length)} শ্রেণি
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        exam.fee_active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      }`}
                      title={
                        exam.fee_active
                          ? "ফি চালু — নতুন ভর্তি ও বিদ্যমান ছাত্রদের বিল হচ্ছে"
                          : "পরীক্ষা চালু না হওয়া পর্যন্ত ফি বিল হবে না"
                      }
                    >
                      {exam.fee_active ? "ফি চালু" : "অপেক্ষমাণ"}
                    </span>
                  </div>

                  {!legacyLocked && exam.cells.length > 0 && (
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {groups.length > 1 &&
                        renderBulkFill(
                          exam,
                          exam.cells,
                          String(exam.id),
                          "সব শ্রেণির জন্য একই পরিমাণ",
                          "সব শ্রেণির",
                          true,
                        )}
                      {dirty > 0 && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => clearDrafts(exam)}
                          title="পরিবর্তন বাতিল"
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <RotateCcw size={12} />
                          বাতিল
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={saving || dirty === 0}
                        onClick={() => save(exam)}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Save size={12} />
                        {saving ? "সংরক্ষণ হচ্ছে..." : dirty > 0 ? `সংরক্ষণ (${toBn(dirty)})` : "সংরক্ষণ"}
                      </button>
                    </div>
                  )}
                </div>

                {legacyLocked ? (
                  <div className="flex items-start gap-2 px-3 py-4 text-xs text-amber-700 dark:text-amber-400">
                    <Lock size={14} className="mt-0.5 shrink-0" />
                    <span>
                      পুরনো নিয়মে এই পরীক্ষার ফি সব শ্রেণির জন্য ৳{toBn(exam.legacy_all_classes_amount!)} হিসেবে বিল
                      হয়ে গেছে, তাই শ্রেণিভিত্তিক ফি বসানো যাবে না। এই ফি শুধু পরীক্ষার নিজের বিভাগের ছাত্রদের বিল হয়।
                    </span>
                  </div>
                ) : exam.cells.length === 0 ? (
                  <div className="px-3 py-5 text-center text-xs text-gray-400 dark:text-slate-500">
                    এই পরীক্ষার বিভাগে কোনো সক্রিয় শ্রেণি নেই
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start gap-2 p-2">
                    {groups.map((group) => (
                      <div
                        key={group.divisionName}
                        className="w-full rounded-lg border border-gray-200 p-2 dark:border-slate-700 sm:w-64"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-1.5">
                          <h4 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-slate-200">
                            <span className="truncate">{group.divisionName}</span>
                            <span className="shrink-0 rounded-full bg-gray-100 px-1.5 text-[10px] font-medium text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                              {toBn(group.cells.length)}টি
                            </span>
                          </h4>
                          {renderBulkFill(
                            exam,
                            group.cells,
                            `${exam.id}:${group.divisionName}`,
                            `${group.divisionName} বিভাগের সব শ্রেণির জন্য একই পরিমাণ`,
                            `${group.divisionName} বিভাগের`,
                            true,
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {group.cells.map((cell) => {
                            const key = cellKey(exam.id, cell.class_id);
                            const value = drafts[key] ?? (cell.amount !== null ? String(cell.amount) : "");
                            const billed = cell.invoice_count > 0;
                            const changed = isDirty(exam.id, cell);
                            return (
                              <label
                                key={cell.class_id}
                                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm transition ${
                                  changed
                                    ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20"
                                    : "border-gray-100 hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-800"
                                }`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium text-gray-800 dark:text-slate-200">
                                    {classById.get(cell.class_id)?.class_name_bn || `শ্রেণি #${cell.class_id}`}
                                  </span>
                                  {billed && (
                                    <span className="block text-[10px] text-gray-400 dark:text-slate-500">
                                      {toBn(cell.invoice_count)}টি ইনভয়েস
                                    </span>
                                  )}
                                </span>
                                <span className="relative shrink-0">
                                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-gray-400 dark:text-slate-500">
                                    ৳
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="—"
                                    value={value}
                                    onChange={(e) =>
                                      setDrafts((prev) => ({ ...prev, [key]: normalizeBanglaDigits(e.target.value) }))
                                    }
                                    onKeyDown={(e) => e.key === "Enter" && save(exam)}
                                    disabled={saving}
                                    className="h-7 w-20 rounded-md border border-gray-200 bg-white pl-5 pr-2 text-right text-sm tabular-nums outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-950 dark:disabled:bg-slate-900"
                                    title={
                                      billed
                                        ? "ইনভয়েস হয়ে গেছে — পরিমাণ বদলালে শুধু নতুন ইনভয়েসে প্রযোজ্য হবে"
                                        : undefined
                                    }
                                  />
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
