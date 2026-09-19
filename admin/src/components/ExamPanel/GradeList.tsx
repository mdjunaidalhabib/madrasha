import { useState, type ReactNode } from "react";
import { Check, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import api from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { recomputeChain, recomputeChainAfterDelete, type ChainGrade } from "./gradeChain";
import { isFailGrade, withoutFailGrades, type GradeKind } from "./failGrade";

export type GradeItem = {
  id: string | number;
  name: string;
  minMark?: number;
  maxMark?: number;
  min_mark?: number;
  max_mark?: number;
  point?: number | string | null;
};

export type GradeListProps = {
  grades: GradeItem[];
  reload: () => void;
  failMark: number;
  /** Set when editing a division's own grade scale; omitted for the default scale. */
  divisionId?: number | null;
  /** Display only: no add form, no edit/delete actions (used for the inherited default scale). */
  readOnly?: boolean;
};

export type GradeListConfig = {
  /** REST resource, e.g. "/madrasa-grades". */
  endpoint: string;
  title: string;
  icon: ReactNode;
  namePlaceholder: string;
  /** Which fail grade this scale uses (রাসিব for madrasa, F for general). */
  kind: GradeKind;
  /** Name of the automatic fail grade shown on the red row, e.g. "রাসিব" / "F". */
  failLabel: string;
};

export const getGradeRange = (grade: GradeItem) => ({
  min: grade.minMark ?? grade.min_mark,
  max: grade.maxMark ?? grade.max_mark,
});

const toChainGrade = (grade: GradeItem): ChainGrade => {
  const { min, max } = getGradeRange(grade);
  return { id: grade.id, name: grade.name, minMark: Number(min), maxMark: Number(max) };
};

const hasPoint = (g: GradeItem) => g.point !== undefined && g.point !== null && g.point !== "";

const actionBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

/** Shared implementation behind MadrasaGradeList / GeneralGradeList - the two
 * differ only by endpoint, title and placeholder. The lowest band's minimum is
 * always the fail mark itself (a mark equal to it passes; fail is strictly
 * below) and every other minimum chains off the band below it
 * (see gradeChain.ts), so users only ever type a band's maximum. */
export default function GradeList({
  config,
  grades: allGrades,
  reload,
  failMark,
  divisionId,
  readOnly = false,
}: GradeListProps & { config: GradeListConfig }) {
  const { endpoint, kind, failLabel } = config;
  // A legacy fail-named row (রাসিব / F) is the automatic fail grade, not a band:
  // keep it out of the list, the count and the chain so it never becomes the
  // "lowest band".
  const grades = withoutFailGrades(kind, allGrades);
  const failSuffix = kind === "madrasa" ? "কে" : "-কে";
  const [name, setName] = useState("");
  const [max, setMax] = useState("");
  const [point, setPoint] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPoint, setEditPoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState(false);

  const applyChainUpdates = async (chained: ChainGrade[], skipId?: string | number) => {
    const updates = chained.filter((row) => {
      if (row.id === "new" || row.id === skipId) return false;
      const original = grades.find((g) => g.id === row.id);
      return original && getGradeRange(original).min !== row.minMark;
    });
    await Promise.all(
      updates.map((row) => {
        const original = grades.find((g) => g.id === row.id);
        return api.put(`${endpoint}/${row.id}`, {
          name: row.name,
          min_mark: row.minMark,
          max_mark: row.maxMark,
          point: original?.point ?? undefined,
        });
      }),
    );
  };

  // Stored band minimums can drift from the fail mark (e.g. the fail mark was
  // changed while a fail-named row was still the "lowest band"), leaving marks
  // that no band covers. Re-chaining from the fail mark up is the fix.
  const rechained = grades.length ? recomputeChainAfterDelete(grades.map(toChainGrade), "__none__", failMark) : [];
  const mismatched = rechained.filter((row) => {
    const original = grades.find((g) => g.id === row.id);
    return original && Number(getGradeRange(original).min) !== row.minMark;
  });

  const fixScale = async () => {
    try {
      setFixing(true);
      await applyChainUpdates(rechained);
      useToastStore.getState().show("গ্রেডের সীমা ঠিক করা হয়েছে", "success");
      reload();
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || "গ্রেডের সীমা ঠিক করা যায়নি", "error");
    } finally {
      setFixing(false);
    }
  };

  const add = async () => {
    if (!name.trim() || !max) {
      return useToastStore.getState().show("সব ঘর পূরণ করুন", "error");
    }

    if (isFailGrade(kind, name)) {
      return useToastStore
        .getState()
        .show(`"${failLabel}" আলাদা গ্রেড নয় — নম্বর ফেল মার্কের কম হলে শিক্ষার্থী স্বয়ংক্রিয়ভাবে ${failLabel} (ফেল) হয়`, "error");
    }

    try {
      setAdding(true);
      const chained = recomputeChain(grades.map(toChainGrade), { name: name.trim(), maxMark: Number(max) }, failMark);
      const newRow = chained.find((g) => g.id === "new")!;

      await api.post(endpoint, {
        name: newRow.name,
        min_mark: newRow.minMark,
        max_mark: newRow.maxMark,
        point: point ? Number(point) : undefined,
        ...(divisionId != null ? { division_id: divisionId } : {}),
      });
      await applyChainUpdates(chained);

      setName("");
      setMax("");
      setPoint("");
      reload();
    } catch {
      useToastStore.getState().show("গ্রেড যোগ করা যায়নি", "error");
    } finally {
      setAdding(false);
    }
  };

  const del = (id: string | number, gradeName: string) => {
    useConfirmStore.getState().show({
      title: "গ্রেড মুছবেন?",
      message: `"${gradeName}" গ্রেডটি মুছে ফেলতে চান?`,
      confirmText: "মুছে ফেলুন",
      danger: true,
      onConfirm: async () => {
        const chained = recomputeChainAfterDelete(grades.map(toChainGrade), id, failMark);
        await applyChainUpdates(chained, id);
        await api.delete(`${endpoint}/${id}`);
        reload();
      },
    });
  };

  const startEdit = (grade: GradeItem) => {
    setEditingId(grade.id);
    setEditName(grade.name);
    setEditPoint(grade.point === undefined || grade.point === null ? "" : String(grade.point));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPoint("");
  };

  const saveEdit = async (grade: GradeItem) => {
    if (!editName.trim()) {
      return useToastStore.getState().show("গ্রেডের নাম দিন", "error");
    }
    if (isFailGrade(kind, editName)) {
      return useToastStore
        .getState()
        .show(`"${failLabel}" আলাদা গ্রেডের নাম হিসেবে ব্যবহার করা যাবে না — এটি ফেলের স্বয়ংক্রিয় গ্রেড`, "error");
    }

    const { min, max: maxMark } = getGradeRange(grade);
    try {
      setSaving(true);
      await api.put(`${endpoint}/${grade.id}`, {
        name: editName.trim(),
        min_mark: min,
        max_mark: maxMark,
        point: editPoint ? Number(editPoint) : undefined,
      });
      useToastStore.getState().show("গ্রেড আপডেট হয়েছে", "success");
      cancelEdit();
      reload();
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || "গ্রেড আপডেট করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...grades].sort((a, b) => Number(getGradeRange(b).max) - Number(getGradeRange(a).max));

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            {config.icon}
          </span>
          <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{config.title}</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {toBanglaDigits(grades.length)}টি
          </span>
        </div>
        {readOnly && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Lock size={13} /> শুধু দেখার জন্য
          </span>
        )}
      </div>

      {!readOnly && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder={config.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex gap-2">
              <Input
                className="w-full sm:w-24"
                placeholder="সর্বোচ্চ"
                type="number"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
              <Input
                className="w-full sm:w-24"
                placeholder="পয়েন্ট"
                type="number"
                step="0.01"
                value={point}
                onChange={(e) => setPoint(e.target.value)}
              />
              <Button
                onClick={add}
                disabled={adding}
                className="shrink-0 px-3"
                aria-label="গ্রেড যোগ করুন"
                title="গ্রেড যোগ করুন"
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            শুধু সর্বোচ্চ নম্বর দিন — সর্বনিম্ন নম্বর স্বয়ংক্রিয়ভাবে আগের গ্রেড থেকে হিসাব হয়ে যাবে। পয়েন্ট ঐচ্ছিক।
          </p>
        </>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm dark:border-rose-900 dark:bg-rose-950/30">
        <span className="inline-flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-400">
          <span className="rounded-lg bg-rose-600 px-2.5 py-0.5 text-sm font-bold text-white">{failLabel}</span>
          <span className="rounded-md bg-white/70 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {failMark > 0 ? `${toBanglaDigits(0)} - ${toBanglaDigits(failMark - 1)}` : "—"}
          </span>
        </span>
        <span className="text-xs font-normal text-rose-700/80 dark:text-rose-400/80">(ফেল · স্বয়ংক্রিয়)</span>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        নম্বর {toBanglaDigits(failMark)}-এর কম পেলে শিক্ষার্থী স্বয়ংক্রিয়ভাবে {failLabel} (ফেল) হবে — {failLabel}
        {failSuffix} আলাদা গ্রেড হিসেবে যোগ করার দরকার নেই।
      </p>

      {!readOnly && mismatched.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="min-w-0 flex-1">
            গ্রেডের সীমায় ফাঁক বা অমিল আছে — সর্বনিম্ন গ্রেড {toBanglaDigits(failMark)} থেকে শুরু হওয়ার কথা, কিন্তু সংরক্ষিত
            সীমা মেলেনি।
          </p>
          <Button onClick={fixScale} disabled={fixing} className="shrink-0">
            {fixing ? "ঠিক করা হচ্ছে..." : "স্বয়ংক্রিয়ভাবে ঠিক করুন"}
          </Button>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title="কোনো গ্রেড যোগ করা হয়নি"
          hint={readOnly ? "ডিফল্টে কোনো গ্রেড নেই" : "উপরে থেকে নতুন গ্রেড যোগ করুন"}
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((g) => {
            const { min: minMark, max: maxMark } = getGradeRange(g);
            const isEditing = !readOnly && editingId === g.id;

            return (
              <div
                key={g.id}
                className={`group flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition focus-within:border-blue-300 ${
                  isEditing
                    ? "border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/70"
                }`}
              >
                {isEditing ? (
                  <>
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(ev) => setEditName(ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") saveEdit(g);
                          if (ev.key === "Escape") cancelEdit();
                        }}
                        placeholder="গ্রেড"
                      />
                      <Input
                        className="sm:w-28"
                        value={editPoint}
                        onChange={(ev) => setEditPoint(ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") saveEdit(g);
                          if (ev.key === "Escape") cancelEdit();
                        }}
                        placeholder="পয়েন্ট"
                        type="number"
                        step="0.01"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => saveEdit(g)}
                        disabled={saving}
                        className={`${actionBtn} text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40`}
                        aria-label="সংরক্ষণ করুন"
                        title="সংরক্ষণ করুন"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className={`${actionBtn} text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800`}
                        aria-label="বাতিল করুন"
                        title="বাতিল করুন"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="rounded-lg bg-indigo-600 px-2.5 py-0.5 text-sm font-bold text-white dark:bg-indigo-500">
                        {g.name}
                      </span>
                      <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-600">
                        {minMark !== undefined ? toBanglaDigits(minMark) : "-"} -{" "}
                        {maxMark !== undefined ? toBanglaDigits(maxMark) : "-"}
                      </span>
                      {hasPoint(g) && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          পয়েন্ট {toBanglaDigits(String(g.point))}
                        </span>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="flex shrink-0 items-center gap-1 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEdit(g)}
                          className={`${actionBtn} text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40`}
                          aria-label="সম্পাদনা করুন"
                          title="সম্পাদনা করুন"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => del(g.id, g.name)}
                          className={`${actionBtn} text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300`}
                          aria-label="মুছে ফেলুন"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
