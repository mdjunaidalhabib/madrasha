import { useState } from "react";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import api from "../../services/api";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import Button from "../ui/Button";
import Input from "../ui/Input";
import EmptyState from "../ui/EmptyState";

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

// Grade ranges must be contiguous (one grade's max + 1 = next grade's min) —
// getGradeFast() in result-panel.service.ts falls back to a default grade
// for any average that lands in a gap, so surface gaps here before they bite.
const findGradeGaps = (grades: GradeItem[]) => {
  const sorted = grades
    .map((g) => getGradeRange(g))
    .filter((r) => r.min !== undefined && r.max !== undefined)
    .sort((a, b) => Number(a.min) - Number(b.min));

  const gaps: { from: number; to: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevMax = Number(sorted[i - 1].max);
    const currMin = Number(sorted[i].min);
    if (currMin > prevMax + 1) {
      gaps.push({ from: prevMax + 1, to: currMin - 1 });
    }
  }
  return gaps;
};

export default function GeneralGradeList({
  grades,
  reload,
}: {
  grades: GradeItem[];
  reload: () => void;
}) {
  const gradeGaps = findGradeGaps(grades);
  const [name, setName] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!name.trim() || !min || !max) {
      return useToastStore.getState().show("সব ঘর পূরণ করুন", "error");
    }

    try {
      setAdding(true);
      await api.post("/general-grades", {
        name: name.trim(),
        min_mark: Number(min),
        max_mark: Number(max),
      });

      setName("");
      setMin("");
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
        await api.delete(`/general-grades/${id}`);
        reload();
      },
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-blue-600" size={20} />
        <h2 className="text-lg font-bold text-slate-900">সাধারণ গ্রেড</h2>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="গ্রেড (যেমনঃ A+)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <Input
            className="w-full sm:w-20"
            placeholder="সর্বনিম্ন"
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
          <Input
            className="w-full sm:w-20"
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

      {gradeGaps.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠️ গ্রেড রেঞ্জের মাঝে ফাঁক আছে:{" "}
          {gradeGaps.map((g) => (g.from === g.to ? `${g.from}` : `${g.from}-${g.to}`)).join(", ")}
          {" "}— এই নম্বর পেলে সঠিক গ্রেড বসবে না।
        </div>
      )}

      {grades.length === 0 ? (
        <EmptyState title="কোনো গ্রেড যোগ করা হয়নি" hint="উপরে থেকে নতুন গ্রেড যোগ করুন" />
      ) : (
        <div className="space-y-2">
          {grades.map((g) => {
            const { min: minMark, max: maxMark } = getGradeRange(g);

            return (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100"
              >
                <span className="font-semibold text-slate-800">
                  {g.name}{" "}
                  <span className="font-normal text-slate-500">
                    ({minMark ?? "-"} - {maxMark ?? "-"})
                  </span>
                </span>
                <button
                  onClick={() => del(g.id, g.name)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
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
