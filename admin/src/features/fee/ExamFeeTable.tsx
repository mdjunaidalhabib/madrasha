import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Lock, Pencil, RotateCcw, Save, Settings2, X } from "lucide-react";
import { examFeeApi, type ExamFeeExam, type ExamFeeOverview } from "../../services/phase2Api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { normalizeBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";

const toBn = (n: number) => n.toLocaleString("bn-BD");

/** One tint per বিভাগ (by the madrasa's division order), so the same বিভাগ
 * looks the same on every exam card. Full class strings for Tailwind. */
const DIVISION_TINTS = [
  {
    box: "border-sky-200 dark:border-sky-900",
    head: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  {
    box: "border-violet-200 dark:border-violet-900",
    head: "bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  {
    box: "border-teal-200 dark:border-teal-900",
    head: "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  {
    box: "border-rose-200 dark:border-rose-900",
    head: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  {
    box: "border-orange-200 dark:border-orange-900",
    head: "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  {
    box: "border-indigo-200 dark:border-indigo-900",
    head: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
];
const LOCKED_TINT = {
  box: "border-gray-200 dark:border-slate-700",
  head: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400",
  dot: "bg-gray-400 dark:bg-slate-500",
};

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
  const [togglingExamId, setTogglingExamId] = useState<number | null>(null);
  /** Amounts are read-only until the ✎ of an exam is pressed - one exam at a time. */
  const [editingExamId, setEditingExamId] = useState<number | null>(null);
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

  const classById = useMemo(
    () => new Map((data?.classes ?? []).map((c) => [c.class_id, c])),
    [data],
  );

  const divisionTint = useMemo(() => {
    const order = new Map<string, number>();
    for (const c of data?.classes ?? []) {
      const name = c.division_name_bn || "অন্যান্য";
      if (!order.has(name)) order.set(name, order.size);
    }
    return (name: string) => DIVISION_TINTS[(order.get(name) ?? 0) % DIVISION_TINTS.length];
  }, [data]);

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

  const startEdit = (exam: ExamFeeExam) => {
    const current = data?.exams.find((e) => e.id === editingExamId);
    if (current && current.id !== exam.id && dirtyCells(current).length) {
      useToastStore
        .getState()
        .show(`আগে "${current.name}" এর পরিবর্তন সংরক্ষণ বা বাতিল করুন`, "error");
      return;
    }
    if (current) clearDrafts(current);
    setEditingExamId(exam.id);
  };

  const cancelEdit = (exam: ExamFeeExam) => {
    clearDrafts(exam);
    setEditingExamId(null);
  };

  const save = async (exam: ExamFeeExam) => {
    const cells = dirtyCells(exam);
    if (!cells.length) {
      cancelEdit(exam);
      return;
    }

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
      setEditingExamId(null);
      await load();
    } catch (err: any) {
      useToastStore
        .getState()
        .show(err?.response?.data?.message || "ফি সংরক্ষণ করা যায়নি", "error");
    } finally {
      setSavingExamId(null);
    }
  };

  /** ইহতেমাম's per-exam fee switch, like বেতন / বোর্ডিং ফি. On needs the exam
   * itself to be on (তা'লীমাত); it bills every student and texts guardians,
   * so both directions are confirmed first. */
  const toggleFee = (exam: ExamFeeExam) => {
    const next = !exam.fee_active;
    if (next && !exam.is_active) {
      useToastStore
        .getState()
        .show(
          `"${exam.name}" পরীক্ষাটি বন্ধ আছে — তা'লীমাত পরীক্ষা চালু করলে তবেই ফি চালু করা যাবে`,
          "error",
        );
      return;
    }
    if (next && dirtyCells(exam).length) {
      useToastStore.getState().show("আগে অসংরক্ষিত ফি সংরক্ষণ বা বাতিল করুন", "error");
      return;
    }

    useConfirmStore.getState().show({
      title: next ? "পরীক্ষার ফি চালু করবেন?" : "পরীক্ষার ফি বন্ধ করবেন?",
      message: next
        ? `"${exam.name}" পরীক্ষার ফি চালু হবে: বিদ্যমান সব ছাত্রের ইনভয়েস তৈরি হবে এবং অভিভাবকদের এসএমএস পাঠানো হবে।`
        : `"${exam.name}" পরীক্ষার ফি বন্ধ হবে — ছাত্রদের যে ইনভয়েস এখনো পরিশোধ হয়নি সেগুলো বাতিল হয়ে যাবে। যেসব ইনভয়েসে টাকা জমা বা মওকুফ হয়েছে সেগুলো থাকবে। আবার চালু করলে ইনভয়েস নতুন করে তৈরি হবে।`,
      confirmText: next ? "চালু করুন" : "বন্ধ করুন",
      danger: !next,
      onConfirm: async () => {
        try {
          setTogglingExamId(exam.id);
          const res = await examFeeApi.setStatus(exam.id, next);
          const result = res.data?.data;
          useToastStore
            .getState()
            .show(
              next
                ? `ফি চালু হয়েছে — ${toBn(result?.invoicesCreated ?? 0)}টি ইনভয়েস তৈরি, ${toBn(
                    result?.studentsNotified ?? 0,
                  )} জন অভিভাবককে এসএমএস`
                : `"${exam.name}" পরীক্ষার ফি বন্ধ হয়েছে — ${toBn(result?.invoicesRemoved ?? 0)}টি ইনভয়েস বাতিল${
                    result?.invoicesKept
                      ? `, টাকা জমা/মওকুফ থাকায় ${toBn(result.invoicesKept)}টি রাখা হয়েছে`
                      : ""
                  }`,
              "success",
            );
          await load();
        } catch (err: any) {
          useToastStore
            .getState()
            .show(
              err?.response?.data?.message || (next ? "ফি চালু করা যায়নি" : "ফি বন্ধ করা যায়নি"),
              "error",
            );
        } finally {
          setTogglingExamId(null);
        }
      },
    });
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
    const canClear =
      !!(bulkValue[bulkKey] ?? "").trim() || cells.some((cell) => isDirty(exam.id, cell));
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
            onChange={(e) =>
              setBulkValue((prev) => ({
                ...prev,
                [bulkKey]: normalizeBanglaDigits(e.target.value),
              }))
            }
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
        পরীক্ষার বিভাগের শ্রেণিগুলো নিজে থেকেই আসে। প্রতিটি পরীক্ষার ফি এখান থেকে আলাদাভাবে
        চালু/বন্ধ করুন — চালু করলে সব ছাত্রের ইনভয়েস তৈরি হয় ও অভিভাবকদের এসএমএস যায়। তা'লীমাত
        পরীক্ষা বন্ধ করলে তার ফি-ও বন্ধ হয়ে যায়, আবার চালু হলে এখান থেকে ফি চালু করতে হয়।
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
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {exams.map((exam) => {
            const dirty = dirtyCells(exam).length;
            const saving = savingExamId === exam.id;
            const editing = editingExamId === exam.id;
            // live = billing · off = exam on, fee can be switched on · locked = তা'লীমাত has the exam off
            const feeState = exam.fee_active ? "live" : exam.is_active ? "off" : "locked";
            const legacyLocked = exam.legacy_all_classes_amount !== null;
            const setCount = exam.cells.filter((c) => c.amount !== null).length;
            const canEdit = !legacyLocked && exam.cells.length > 0;

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
                className={`overflow-hidden rounded-xl border bg-white dark:bg-slate-900 ${
                  dirty > 0
                    ? "border-amber-300 dark:border-amber-800"
                    : editing
                      ? "border-blue-300 ring-2 ring-blue-100 dark:border-blue-800 dark:ring-blue-950"
                      : feeState === "live"
                        ? "border-emerald-200 dark:border-emerald-900"
                        : "border-gray-200 dark:border-slate-700"
                }`}
              >
                {/* Header: name + meta on the left, ✎ and the fee control on the right. */}
                <div
                  className={`flex items-center gap-2 border-b px-3 py-2 ${
                    feeState === "live"
                      ? "border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                      : feeState === "locked"
                        ? "border-gray-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-800"
                        : "border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800/60"
                  }`}
                >
                  <span
                    className={`h-8 w-1 shrink-0 rounded-full ${
                      feeState === "live"
                        ? "bg-emerald-500"
                        : feeState === "off"
                          ? "bg-amber-400"
                          : "bg-gray-300 dark:bg-slate-600"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`truncate text-sm font-bold leading-tight ${
                        feeState === "locked"
                          ? "text-gray-500 dark:text-slate-400"
                          : "text-gray-800 dark:text-slate-100"
                      }`}
                      title={`${exam.name} (${exam.year})`}
                    >
                      {exam.name}
                    </h3>
                    <p className="truncate text-[11px] text-gray-500 dark:text-slate-400">
                      {exam.year}
                      {canEdit &&
                        ` · ${toBn(setCount)}/${toBn(exam.cells.length)} শ্রেণির ফি নির্ধারিত`}
                    </p>
                  </div>

                  {canEdit && !editing && (
                    <button
                      type="button"
                      onClick={() => startEdit(exam)}
                      title={`"${exam.name}" এর ফি সম্পাদনা করুন`}
                      aria-label={`"${exam.name}" এর ফি সম্পাদনা করুন`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-600 transition hover:bg-blue-100/70 dark:text-blue-400 dark:hover:bg-blue-950/40"
                    >
                      <Pencil size={14} />
                    </button>
                  )}

                  {feeState === "locked" ? (
                    <span
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-gray-300 bg-white px-2 text-[11px] font-medium text-gray-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400"
                      title="তা'লীমাত পরীক্ষাটি বন্ধ রেখেছে — পরীক্ষা চালু হলে ফি চালু করা যাবে"
                    >
                      <Lock size={11} />
                      পরীক্ষা বন্ধ
                    </span>
                  ) : (
                    <label
                      className={`inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-[11px] font-semibold transition ${
                        feeState === "live"
                          ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                      }`}
                    >
                      {feeState === "live" ? "ফি চালু" : "ফি বন্ধ"}
                      <ToggleSwitch
                        size="sm"
                        checked={exam.fee_active}
                        disabled={togglingExamId === exam.id}
                        onChange={() => toggleFee(exam)}
                        title={
                          feeState === "live"
                            ? "ফি বন্ধ করুন"
                            : "ফি চালু করুন (অভিভাবকদের এসএমএস যাবে)"
                        }
                      />
                    </label>
                  )}
                </div>

                {feeState === "locked" && (
                  <div className="flex items-start gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] leading-snug text-gray-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                    <Lock size={11} className="mt-0.5 shrink-0" />
                    তা'লীমাত পরীক্ষা চালু করলে ফি চালু করা যাবে — পরিমাণ আগেই ঠিক রাখতে পারেন।
                  </div>
                )}

                {legacyLocked ? (
                  <div className="flex items-start gap-2 px-3 py-3 text-xs text-amber-700 dark:text-amber-400">
                    <Lock size={14} className="mt-0.5 shrink-0" />
                    <span>
                      পুরনো নিয়মে এই পরীক্ষার ফি সব শ্রেণির জন্য ৳
                      {toBn(exam.legacy_all_classes_amount!)} হিসেবে বিল হয়ে গেছে, তাই
                      শ্রেণিভিত্তিক ফি বসানো যাবে না। এই ফি শুধু পরীক্ষার নিজের বিভাগের ছাত্রদের বিল
                      হয়।
                    </span>
                  </div>
                ) : exam.cells.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-slate-500">
                    এই পরীক্ষার বিভাগে কোনো সক্রিয় শ্রেণি নেই
                  </div>
                ) : (
                  <div className="space-y-2 p-2">
                    {groups.map((group) => {
                      const tint =
                        feeState === "locked" ? LOCKED_TINT : divisionTint(group.divisionName);
                      return (
                        <div
                          key={group.divisionName}
                          className={`overflow-hidden rounded-lg border ${tint.box}`}
                        >
                          {/* বিভাগ sub-header - its bulk fill only while editing. */}
                          <div
                            className={`flex min-h-[1.75rem] items-center justify-between gap-2 px-2.5 py-1 ${tint.head}`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tint.dot}`} />
                              <span className="truncate">{group.divisionName}</span>
                              <span className="shrink-0 font-normal opacity-70">
                                {toBn(group.cells.length)}টি
                              </span>
                            </span>
                            {editing &&
                              groups.length > 1 &&
                              renderBulkFill(
                                exam,
                                group.cells,
                                `${exam.id}:${group.divisionName}`,
                                `${group.divisionName} বিভাগের সব শ্রেণির জন্য একই পরিমাণ`,
                                `${group.divisionName} বিভাগের`,
                                true,
                              )}
                          </div>
                          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                            {group.cells.map((cell) => {
                              const key = cellKey(exam.id, cell.class_id);
                              const value =
                                drafts[key] ?? (cell.amount !== null ? String(cell.amount) : "");
                              const billed = cell.invoice_count > 0;
                              const changed = isDirty(exam.id, cell);
                              const className =
                                classById.get(cell.class_id)?.class_name_bn ||
                                `শ্রেণি #${cell.class_id}`;
                              return (
                                <li
                                  key={cell.class_id}
                                  className={`flex items-center gap-2 px-2.5 text-sm ${
                                    editing ? "py-1" : "py-1.5"
                                  } ${changed ? "bg-amber-50/70 dark:bg-amber-950/20" : ""}`}
                                >
                                  <span
                                    className={`min-w-0 flex-1 truncate ${
                                      feeState === "locked"
                                        ? "text-gray-500 dark:text-slate-400"
                                        : "text-gray-700 dark:text-slate-200"
                                    }`}
                                  >
                                    {className}
                                  </span>
                                  {billed && (
                                    <span
                                      className="shrink-0 text-[10px] text-gray-400 dark:text-slate-500"
                                      title="এই ফি থেকে তৈরি ইনভয়েস"
                                    >
                                      {toBn(cell.invoice_count)} ইনভয়েস
                                    </span>
                                  )}
                                  {!editing ? (
                                    <span
                                      className={`shrink-0 text-right tabular-nums ${
                                        cell.amount !== null
                                          ? feeState === "locked"
                                            ? "font-medium text-gray-500 dark:text-slate-400"
                                            : "font-semibold text-gray-800 dark:text-slate-100"
                                          : "text-gray-300 dark:text-slate-600"
                                      }`}
                                      title={
                                        cell.amount === null ? "ফি নির্ধারণ করা নেই" : undefined
                                      }
                                    >
                                      {cell.amount !== null ? `৳${toBn(cell.amount)}` : "—"}
                                    </span>
                                  ) : (
                                    <span className="relative shrink-0">
                                      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-gray-400 dark:text-slate-500">
                                        ৳
                                      </span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="—"
                                        value={value}
                                        aria-label={`${className} — ফি`}
                                        onChange={(e) =>
                                          setDrafts((prev) => ({
                                            ...prev,
                                            [key]: normalizeBanglaDigits(e.target.value),
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") save(exam);
                                          else if (e.key === "Escape") cancelEdit(exam);
                                        }}
                                        disabled={saving}
                                        className={`h-7 w-[4.5rem] rounded-md border bg-white pl-5 pr-2 text-right text-sm tabular-nums outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-950 dark:disabled:bg-slate-900 ${
                                          changed
                                            ? "border-amber-400 dark:border-amber-700"
                                            : "border-gray-200 dark:border-slate-700"
                                        }`}
                                        title={
                                          billed
                                            ? "ইনভয়েস হয়ে গেছে — পরিমাণ বদলালে শুধু নতুন ইনভয়েসে প্রযোজ্য হবে"
                                            : undefined
                                        }
                                      />
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Edit footer: whole-exam fill + বাতিল / সংরক্ষণ. */}
                {canEdit && editing && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                    {renderBulkFill(
                      exam,
                      exam.cells,
                      String(exam.id),
                      "সব শ্রেণির জন্য একই পরিমাণ",
                      "সব শ্রেণির",
                      true,
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => cancelEdit(exam)}
                        title="সম্পাদনা বাতিল — আগের সংরক্ষিত ফি থাকবে"
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <RotateCcw size={12} />
                        বাতিল
                      </button>
                      <button
                        type="button"
                        disabled={saving || dirty === 0}
                        onClick={() => save(exam)}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Save size={12} />
                        {saving
                          ? "সংরক্ষণ হচ্ছে..."
                          : dirty > 0
                            ? `সংরক্ষণ (${toBn(dirty)})`
                            : "সংরক্ষণ"}
                      </button>
                    </div>
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
