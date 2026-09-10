import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import api, { cachedGet } from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

const COMPONENT_OPTIONS = [
  { value: "WRITTEN", label: "লিখিত" },
  { value: "MCQ", label: "এমসিকিউ" },
  { value: "PRACTICAL", label: "ব্যবহারিক" },
  { value: "ORAL", label: "মৌখিক" },
  { value: "ASSIGNMENT", label: "অ্যাসাইনমেন্ট" },
  { value: "CLASS_ASSESSMENT", label: "ক্লাস মূল্যায়ন" },
  { value: "OTHER", label: "অন্যান্য" },
];

interface Exam {
  id: number;
  name: string;
}

interface ComponentRow {
  component: string;
  full_mark: string;
}

interface Props {
  open: boolean;
  bookId: number;
  bookLabel: string;
  onClose: () => void;
}

const extractArray = (res: any) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

/** Optional/secondary settings screen: lets an admin split a subject's full
 * mark into components (written/MCQ/practical/...) that must sum to the
 * subject's own full mark. Reached from ClassBookSettingsPage per book. */
export default function MarkComponentsModal({ open, bookId, bookLabel, onClose }: Props) {
  const push = useToastStore((state) => state.push);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    cachedGet("/exams", { params: { active_only: true } })
      .then((res) => setExams(extractArray(res.data)))
      .catch((err) => logger.error("Exams load error:", err));
  }, [open]);

  const loadComponents = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ book_id: String(bookId) });
      if (examId) query.set("exam_id", examId);
      const res = await api.get(`/results/mark-components?${query.toString()}`);
      const list = extractArray(res.data?.components ?? res.data);
      setRows(
        list.map((c: any) => ({
          component: c.component,
          full_mark: String(c.full_mark ?? ""),
        })),
      );
    } catch (err) {
      logger.error("Load mark-components error:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadComponents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookId, examId]);

  const addRow = () => setRows((prev) => [...prev, { component: "WRITTEN", full_mark: "" }]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));
  const updateRow = (index: number, patch: Partial<ComponentRow>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    if (rows.length === 0) {
      return push("error", "অন্তত একটি উপাদান যোগ করুন");
    }
    for (const r of rows) {
      const n = Number(r.full_mark);
      if (!r.full_mark || !Number.isFinite(n) || n <= 0) {
        return push("error", "প্রতিটি উপাদানের পূর্ণমান সঠিক সংখ্যা হতে হবে");
      }
    }

    setSaving(true);
    try {
      await api.put("/results/mark-components", {
        book_id: bookId,
        ...(examId ? { exam_id: Number(examId) } : {}),
        components: rows.map((r, i) => ({
          component: r.component,
          full_mark: Number(r.full_mark),
          sort_order: i + 1,
        })),
      });
      push("success", "উপাদান সংরক্ষণ হয়েছে");
      onClose();
    } catch (err: any) {
      logger.error("Save mark-components error:", err);
      push("error", err?.response?.data?.message || "সংরক্ষণ করা যায়নি — পূর্ণমানের যোগফল মিলছে না");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={`নম্বর বিভাজন — ${bookLabel}`} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="space-y-3">
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400">
          পরীক্ষা (ঐচ্ছিক — খালি রাখলে সাধারণ/সব পরীক্ষার জন্য প্রযোজ্য হবে)
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">সাধারণ (সব পরীক্ষা)</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>

        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">লোড হচ্ছে...</p>
        ) : (
          <div className="space-y-2">
            {rows.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-slate-500">কোনো উপাদান যোগ করা হয়নি</p>
            )}
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={row.component}
                  onChange={(e) => updateRow(i, { component: e.target.value })}
                  className="flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {COMPONENT_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={row.full_mark}
                  onChange={(e) => updateRow(i, { full_mark: e.target.value })}
                  placeholder="পূর্ণমান"
                  className="w-24 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="shrink-0 rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40"
                  aria-label="মুছুন"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            >
              <Plus size={15} /> উপাদান যোগ করুন
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            বাতিল
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
