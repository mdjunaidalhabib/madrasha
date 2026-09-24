import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Search, Wallet, XCircle } from "lucide-react";
import api from "../../services/api";
import Card from "@madrasha/shared-ui/src/components/ui/Card";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

type FeeStudentRow = {
  student_id: number;
  name_bn: string;
  roll: number | null;
  class_id: number;
  class_name: string;
  amount: number;
  paid: number;
  due: number;
};

type ExamFeeStatus = {
  exam: { id: number; name: string; year: string | number } | null;
  paid: FeeStudentRow[];
  unpaid: FeeStudentRow[];
  totals: { collected: number; due: number };
};

type Tab = "unpaid" | "paid";

const bn = (value: number) => Number(value || 0).toLocaleString("bn-BD");

/**
 * তালিমাত dashboard - কারা কারা পরীক্ষার ফি দিয়েছে / দেয়নি, for one exam
 * (default: the latest active one). Reads GET /results/dashboard-exam-fee.
 */
export default function ExamFeeStatusCard({ exams }: { exams: { examId: number; name: string; year: string }[] }) {
  const [examId, setExamId] = useState<number | "">("");
  const [data, setData] = useState<ExamFeeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("unpaid");
  const [classId, setClassId] = useState<number | "">("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get<{ success: boolean; data: ExamFeeStatus }>("/results/dashboard-exam-fee", {
          params: examId ? { exam_id: examId } : undefined,
        });
        if (cancelled) return;
        const next = res.data?.data ?? null;
        setData(next);
        if (examId === "" && next?.exam) setExamId(next.exam.id);
      } catch (err) {
        logger.error("LOAD DASHBOARD EXAM FEE ERROR:", err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const allRows = useMemo(() => [...(data?.unpaid ?? []), ...(data?.paid ?? [])], [data]);
  const classOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of allRows) if (!map.has(r.class_id)) map.set(r.class_id, r.class_name || `শ্রেণি #${r.class_id}`);
    return [...map.entries()];
  }, [allRows]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tab === "paid" ? data?.paid : data?.unpaid)?.filter(
      (r) =>
        (classId === "" || r.class_id === classId) &&
        (!q || r.name_bn.toLowerCase().includes(q) || String(r.roll ?? "").includes(q)),
    ) ?? [];
  }, [data, tab, classId, query]);

  const paidCount = data?.paid.length ?? 0;
  const unpaidCount = data?.unpaid.length ?? 0;
  const total = paidCount + unpaidCount;
  const paidPct = total ? Math.round((paidCount / total) * 100) : 0;

  const selectClass =
    "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 p-2 text-white shadow-md shadow-purple-500/20">
            <Wallet size={18} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">পরীক্ষার ফি</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">কারা ফি দিয়েছে আর কারা দেয়নি</p>
          </div>
        </div>
        <select
          value={examId}
          onChange={(e) => {
            setExamId(e.target.value ? Number(e.target.value) : "");
            setClassId("");
          }}
          className={selectClass}
          aria-label="পরীক্ষা নির্বাচন"
        >
          {examId === "" && <option value="">সর্বশেষ পরীক্ষা</option>}
          {exams.map((e) => (
            <option key={e.examId} value={e.examId}>
              {e.name} ({e.year})
            </option>
          ))}
        </select>
      </div>

      {loading && !data ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : !data?.exam ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">কোনো সক্রিয় পরীক্ষা নেই</p>
      ) : total === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">এই পরীক্ষার ফি এখনো বিল হয়নি</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            পরীক্ষা চালু হলে বা রুটিন তৈরি হলে সব ছাত্রের ইনভয়েস তৈরি হবে।{" "}
            <Link to="/fee-management?tab=exam" className="text-indigo-600 hover:underline dark:text-indigo-400">
              ফি সেটাপ দেখুন
            </Link>
          </p>
        </div>
      ) : (
        <>
          {/* Summary: tabs double as the paid / unpaid counters */}
          <div className="grid grid-cols-2 gap-3 px-5 pt-4">
            {(
              [
                {
                  key: "unpaid" as Tab,
                  label: "দেয়নি",
                  count: unpaidCount,
                  money: `বাকি ৳${bn(data.totals.due)}`,
                  icon: <XCircle size={18} />,
                  active: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30",
                  text: "text-rose-600 dark:text-rose-400",
                },
                {
                  key: "paid" as Tab,
                  label: "দিয়েছে",
                  count: paidCount,
                  money: `আদায় ৳${bn(data.totals.collected)}`,
                  icon: <CheckCircle2 size={18} />,
                  active: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
                  text: "text-emerald-600 dark:text-emerald-400",
                },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  tab === t.key
                    ? t.active
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                }`}
              >
                <div>
                  <p className={`flex items-center gap-1.5 text-sm font-semibold ${t.text}`}>
                    {t.icon}
                    {t.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.money}</p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{bn(t.count)}</p>
              </button>
            ))}
          </div>

          <div className="px-5 pt-3">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-rose-100 dark:bg-rose-950/40">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {bn(paidPct)}% আদায়
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-5 py-3">
            <div className="relative min-w-[10rem] flex-1">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="নাম বা রোল খুঁজুন"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : "")}
              className={selectClass}
              aria-label="শ্রেণি"
            >
              <option value="">সব শ্রেণি</option>
              {classOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-96 overflow-y-auto border-t border-slate-100 dark:border-slate-800">
            {rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                {tab === "unpaid" && unpaidCount === 0 ? "সবাই ফি দিয়েছে" : "কোনো ছাত্র পাওয়া যায়নি"}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="w-16 px-5 py-2 text-left font-semibold">রোল</th>
                    <th className="px-2 py-2 text-left font-semibold">নাম</th>
                    <th className="px-2 py-2 text-left font-semibold">শ্রেণি</th>
                    <th className="px-5 py-2 text-right font-semibold">{tab === "unpaid" ? "বাকি" : "পরিশোধ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r) => (
                    <tr key={r.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-2 tabular-nums text-slate-500 dark:text-slate-400">
                        {r.roll != null ? bn(r.roll) : "—"}
                      </td>
                      <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">{r.name_bn}</td>
                      <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{r.class_name}</td>
                      <td
                        className={`px-5 py-2 text-right font-semibold tabular-nums ${
                          tab === "unpaid" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        ৳{bn(tab === "unpaid" ? r.due : r.paid)}
                        {tab === "unpaid" && r.paid > 0 && (
                          <span className="ml-1 text-[11px] font-normal text-slate-400">(আংশিক)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
