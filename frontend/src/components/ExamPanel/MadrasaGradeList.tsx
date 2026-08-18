import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import api from "../../services/api";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import Button from "../ui/Button";
import Input from "../ui/Input";
import EmptyState from "../ui/EmptyState";
import { recomputeChain, recomputeChainAfterDelete, type ChainGrade } from "./gradeChain";

type GradeItem = {
  id: string | number;
  name: string;
  minMark?: number;
  maxMark?: number;
  min_mark?: number;
  max_mark?: number;
};

const getGradeRange = (grade: GradeItem) => ({
  min: grade.minMark ?? grade.min_mark,
  max: grade.maxMark ?? grade.max_mark,
});

const toChainGrade = (grade: GradeItem): ChainGrade => {
  const { min, max } = getGradeRange(grade);
  return { id: grade.id, name: grade.name, minMark: Number(min), maxMark: Number(max) };
};

export default function MadrasaGradeList({
  grades,
  reload,
  failMark,
}: {
  grades: GradeItem[];
  reload: () => void;
  failMark: number;
}) {
  const [name, setName] = useState("");
  const [max, setMax] = useState("");
  const [adding, setAdding] = useState(false);

  const applyChainUpdates = async (chained: ChainGrade[], skipId?: string | number) => {
    const updates = chained.filter((row) => {
      if (row.id === "new" || row.id === skipId) return false;
      const original = grades.find((g) => g.id === row.id);
      return original && getGradeRange(original).min !== row.minMark;
    });
    await Promise.all(
      updates.map((row) =>
        api.put(`/madrasa-grades/${row.id}`, {
          name: row.name,
          min_mark: row.minMark,
          max_mark: row.maxMark,
        }),
      ),
    );
  };

  const add = async () => {
    if (!name.trim() || !max) {
      return useToastStore.getState().show("সব ঘর পূরণ করুন", "error");
    }

    try {
      setAdding(true);
      const chained = recomputeChain(grades.map(toChainGrade), { name: name.trim(), maxMark: Number(max) }, failMark);
      const newRow = chained.find((g) => g.id === "new")!;

      await api.post("/madrasa-grades", {
        name: newRow.name,
        min_mark: newRow.minMark,
        max_mark: newRow.maxMark,
      });
      await applyChainUpdates(chained);

      setName("");
      setMax("");
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
        await api.delete(`/madrasa-grades/${id}`);
        reload();
      },
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className="text-xl">🕌</span>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">মাদরাসা গ্রেড</h2>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="গ্রেড (যেমনঃ মুমতায)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            className="w-full sm:w-24"
            placeholder="সর্বোচ্চ"
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
          <Button onClick={add} disabled={adding} className="shrink-0 px-3">
            <Plus size={16} />
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        শুধু সর্বোচ্চ নম্বর দিন — সর্বনিম্ন নম্বর স্বয়ংক্রিয়ভাবে আগের গ্রেড থেকে হিসাব হয়ে যাবে।
      </p>

      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400">
        ০ - {failMark}: ফেল <span className="font-normal opacity-80">(স্বয়ংক্রিয়)</span>
      </div>

      {grades.length === 0 ? (
        <EmptyState title="কোনো গ্রেড যোগ করা হয়নি" hint="উপরে থেকে নতুন গ্রেড যোগ করুন" />
      ) : (
        <div className="space-y-2">
          {grades.map((g) => {
            const { min: minMark, max: maxMark } = getGradeRange(g);

            return (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {g.name}{" "}
                  <span className="font-normal text-slate-500 dark:text-slate-400">
                    ({minMark ?? "-"} - {maxMark ?? "-"})
                  </span>
                </span>
                <button
                  onClick={() => del(g.id, g.name)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                  aria-label="মুছে ফেলুন"
                  title="মুছে ফেলুন"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
