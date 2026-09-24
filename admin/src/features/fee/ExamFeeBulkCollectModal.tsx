import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import {
  examFeeCollectApi,
  type ExamFeeBulkPayResult,
  type ExamFeeCollectSheet,
  type ExamFeeOverview,
  type PaymentMethod,
  type PaymentMethodSetting,
} from "../../services/phase2Api";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called on close when at least one payment was recorded, so the parent
   * can refresh whatever student ledger it currently shows. */
  onCompleted?: () => void;
  /** The tenant's configured receiving channels (already loaded by the page). */
  configuredMethods: PaymentMethodSetting[];
};

type Step = "select" | "confirm" | "result";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "ক্যাশ (হাতে নগদ)",
  BKASH: "বিকাশ",
  NAGAD: "নগদ",
  BANK: "ব্যাংক",
  ONLINE: "অনলাইন",
};
const METHODS = Object.keys(METHOD_LABELS) as PaymentMethod[];

// Local (not UTC) calendar date — the office's "today", used as the max too.
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const bn = (n: number) => n.toLocaleString("bn-BD");
const taka = (n: number) => `৳${bn(n)}`;

// Bangla-digit roll searches ("১২") should match roll 12 too.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

const errMessage = (err: any, fallback: string) => err?.response?.data?.message || fallback;

const emptyForm = () => ({
  method: "CASH" as PaymentMethod,
  payment_method_setting_id: "",
  transaction_ref: "",
  note: "",
  paid_at: localToday(),
});

const inputCls =
  "h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400";

const ExamFeeBulkCollectModal = ({ open, onClose, onCompleted, configuredMethods }: Props) => {
  const [overview, setOverview] = useState<ExamFeeOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(false);

  const [examId, setExamId] = useState<number | "">("");
  const [classId, setClassId] = useState<number | "">("");

  const [sheet, setSheet] = useState<ExamFeeCollectSheet | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState(false);
  const sheetRequestRef = useRef(0);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [notifyGuardian, setNotifyGuardian] = useState(false);

  const [step, setStep] = useState<Step>("select");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [result, setResult] = useState<ExamFeeBulkPayResult | null>(null);
  const collectedRef = useRef(false);

  /* ---------- exam + class options (only live exam fees that billed someone) ---------- */

  const examOptions = useMemo(() => {
    if (!overview) return [];
    return overview.exams
      .filter((e) => e.fee_active && e.cells.some((c) => c.invoice_count > 0))
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.id - a.id);
  }, [overview]);

  const classOptions = useMemo(() => {
    const exam = examOptions.find((e) => e.id === examId);
    if (!exam || !overview) return [];
    const classById = new Map(overview.classes.map((c) => [c.class_id, c]));
    return exam.cells
      .filter((c) => c.invoice_count > 0)
      .map((c) => {
        const cls = classById.get(c.class_id);
        return {
          class_id: c.class_id,
          name: cls?.class_name_bn || `শ্রেণি #${c.class_id}`,
          division: cls?.division_name_bn || "",
          amount: c.amount,
        };
      });
  }, [examOptions, examId, overview]);

  const classGroups = useMemo(() => {
    const groups = new Map<string, typeof classOptions>();
    classOptions.forEach((c) => {
      const key = c.division || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    });
    return Array.from(groups.entries());
  }, [classOptions]);

  /* ---------- lifecycle ---------- */

  const loadOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      setOverviewError(false);
      const res = await examFeeCollectApi.options();
      setOverview(res.data?.data ?? null);
    } catch (err) {
      logger.error("LOAD EXAM FEE OVERVIEW ERROR:", err);
      setOverview(null);
      setOverviewError(true);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // Fresh state on every open — a half-finished batch from last time must
  // never be re-submitted by accident.
  useEffect(() => {
    if (!open) return;
    setExamId("");
    setClassId("");
    setSheet(null);
    setSelected(new Set());
    setSearch("");
    setForm(emptyForm());
    setNotifyGuardian(false);
    setStep("select");
    setResult(null);
    collectedRef.current = false;
    loadOverview();
  }, [open, loadOverview]);

  // Default to the latest active exam once options are known.
  useEffect(() => {
    if (examId === "" && examOptions.length > 0) setExamId(examOptions[0].id);
  }, [examOptions, examId]);

  // Keep the class valid for the chosen exam; auto-pick when there's only one.
  useEffect(() => {
    if (classId !== "" && !classOptions.some((c) => c.class_id === classId)) setClassId("");
    if (classId === "" && classOptions.length === 1) setClassId(classOptions[0].class_id);
  }, [classOptions, classId]);

  const loadSheet = useCallback(async () => {
    if (examId === "" || classId === "") {
      setSheet(null);
      setSelected(new Set());
      return;
    }
    const requestId = ++sheetRequestRef.current;
    try {
      setSheetLoading(true);
      setSheetError(false);
      const res = await examFeeCollectApi.getSheet(examId, classId);
      if (requestId !== sheetRequestRef.current) return;
      const data = res.data?.data ?? null;
      setSheet(data);
      // Everyone with a due starts ticked — the common case is "collect the class".
      setSelected(new Set((data?.rows ?? []).map((r) => r.invoice_id)));
    } catch (err) {
      if (requestId !== sheetRequestRef.current) return;
      logger.error("LOAD EXAM FEE COLLECT SHEET ERROR:", err);
      setSheet(null);
      setSelected(new Set());
      setSheetError(true);
      useToastStore.getState().show(errMessage(err, "তালিকা লোড করা যায়নি"), "error");
    } finally {
      if (requestId === sheetRequestRef.current) setSheetLoading(false);
    }
  }, [examId, classId]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setStep("select");
    loadSheet();
  }, [open, loadSheet]);

  /* ---------- table ---------- */

  const rows = useMemo(() => sheet?.rows ?? [], [sheet]);

  const filteredRows = useMemo(() => {
    const q = toAsciiDigits(search.trim().toLowerCase());
    if (!q) return rows;
    return rows.filter(
      (r) => (r.name_bn || "").toLowerCase().includes(q) || String(r.roll ?? "").includes(q),
    );
  }, [rows, search]);

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.invoice_id)), [rows, selected]);
  const selectedTotal = useMemo(() => selectedRows.reduce((s, r) => s + Number(r.due || 0), 0), [selectedRows]);

  const visibleSelectedCount = filteredRows.filter((r) => selected.has(r.invoice_id)).length;
  const allVisibleSelected = filteredRows.length > 0 && visibleSelectedCount === filteredRows.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const toggleRow = (invoiceId: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filteredRows.forEach((r) => next.delete(r.invoice_id));
      else filteredRows.forEach((r) => next.add(r.invoice_id));
      return next;
    });

  /* ---------- submit ---------- */

  const today = localToday();
  const dateInvalid = !form.paid_at || form.paid_at > today;

  const requestConfirm = () => {
    if (selectedRows.length === 0) {
      useToastStore.getState().show("অন্তত একজন ছাত্র নির্বাচন করুন", "error");
      return;
    }
    if (dateInvalid) {
      useToastStore.getState().show("সঠিক তারিখ দিন — ভবিষ্যতের তারিখ দেওয়া যাবে না", "error");
      return;
    }
    setStep("confirm");
  };

  const handleSubmit = async () => {
    if (submittingRef.current || examId === "" || classId === "" || selectedRows.length === 0) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await examFeeCollectApi.bulkPay({
        exam_id: examId,
        class_id: classId,
        invoice_ids: selectedRows.map((r) => r.invoice_id),
        method: form.method,
        payment_method_setting_id: form.payment_method_setting_id
          ? Number(form.payment_method_setting_id)
          : undefined,
        transaction_ref: form.method !== "CASH" ? form.transaction_ref.trim() || undefined : undefined,
        note: form.note.trim() || undefined,
        paid_at: form.paid_at || undefined,
        notify_guardian: notifyGuardian,
      });
      const data = res.data?.data;
      if (!data) throw new Error("Empty bulk-pay response");
      setResult(data);
      setStep("result");
      if (data.succeeded.length > 0) {
        collectedRef.current = true;
        useToastStore
          .getState()
          .show(`${bn(data.succeeded.length)} জনের পরীক্ষার ফি গ্রহণ হয়েছে (${taka(Number(data.total_collected || 0))})`, "success");
      } else {
        useToastStore.getState().show("কোনো ফি গ্রহণ করা যায়নি — কারণগুলো দেখুন", "error");
      }
    } catch (err) {
      logger.error("EXAM FEE BULK PAY ERROR:", err);
      useToastStore.getState().show(errMessage(err, "ফি গ্রহণ করা যায়নি, আবার চেষ্টা করুন"), "error");
      setStep("select");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submittingRef.current) return;
    if (collectedRef.current) onCompleted?.();
    onClose();
  };

  // "আরেকটি শ্রেণি" — back to picking with a fresh sheet (what's left to collect).
  const startAnother = () => {
    setResult(null);
    setStep("select");
    setForm((f) => ({ ...f, transaction_ref: "", note: "" }));
    loadSheet();
  };

  /* ---------- render ---------- */

  const selectedExam = examOptions.find((e) => e.id === examId);
  const selectedClass = classOptions.find((c) => c.class_id === classId);

  const renderPicker = () => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={labelCls}>পরীক্ষা</label>
        <select
          value={examId}
          onChange={(e) => {
            setExamId(e.target.value ? Number(e.target.value) : "");
            setClassId("");
          }}
          className={`${inputCls} h-10 text-base`}
        >
          {examOptions.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
              {exam.year ? ` (${exam.year})` : ""}
              {!exam.is_active ? " — নিষ্ক্রিয়" : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>শ্রেণি</label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : "")}
          disabled={classOptions.length === 0}
          className={`${inputCls} h-10 text-base`}
        >
          <option value="">শ্রেণি নির্বাচন করুন</option>
          {classGroups.map(([division, items]) =>
            division ? (
              <optgroup key={division} label={division}>
                {items.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.name}
                    {c.amount ? ` — ${taka(c.amount)}` : ""}
                  </option>
                ))}
              </optgroup>
            ) : (
              items.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.name}
                  {c.amount ? ` — ${taka(c.amount)}` : ""}
                </option>
              ))
            ),
          )}
        </select>
      </div>
    </div>
  );

  const renderCentered = (icon: ReactNode, title: string, hint?: string, action?: ReactNode) => (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center dark:border-slate-700">
      {icon}
      <div className="text-base font-semibold text-gray-700 dark:text-slate-200">{title}</div>
      {hint && <p className="max-w-sm text-sm text-gray-500 dark:text-slate-400">{hint}</p>}
      {action}
    </div>
  );

  const renderSheet = () => {
    if (classId === "") {
      return renderCentered(
        <Users size={28} className="text-gray-300 dark:text-slate-600" />,
        "শ্রেণি নির্বাচন করুন",
        "শ্রেণি বাছাই করলে যাদের পরীক্ষার ফি বাকি আছে তাদের তালিকা এখানে দেখাবে।",
      );
    }
    if (sheetLoading) {
      return renderCentered(<Loader2 size={26} className="animate-spin text-blue-500" />, "তালিকা লোড হচ্ছে...");
    }
    if (sheetError || !sheet) {
      return renderCentered(
        <AlertTriangle size={28} className="text-amber-500" />,
        "তালিকা লোড করা যায়নি",
        undefined,
        <button
          type="button"
          onClick={loadSheet}
          className="mt-1 h-9 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          আবার চেষ্টা করুন
        </button>,
      );
    }
    if (rows.length === 0) {
      return sheet.paid_count > 0
        ? renderCentered(
            <CheckCircle2 size={32} className="text-emerald-500" />,
            "এই শ্রেণির সবাই ফি দিয়েছে",
            `${bn(sheet.paid_count)} জন ইতিমধ্যে ${sheet.exam.name}-এর ফি পরিশোধ করেছে।`,
          )
        : renderCentered(
            <ClipboardList size={28} className="text-gray-300 dark:text-slate-600" />,
            "এই শ্রেণিতে কোনো বকেয়া পরীক্ষার ফি নেই",
          );
    }

    return (
      <div className="flex flex-col gap-2.5">
        {/* Stats + search */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              বাকি: {bn(rows.length)} জন · {taka(Number(sheet.totals?.due ?? 0))}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              ইতিমধ্যে পরিশোধ করেছে: {bn(sheet.paid_count)} জন
            </span>
          </div>
          <div className="relative sm:w-64">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="নাম বা রোল দিয়ে খুঁজুন"
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="max-h-[42vh] overflow-auto rounded-lg border border-gray-200 dark:border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
              <tr className="text-left text-xs font-semibold text-gray-600 dark:text-slate-300">
                <th className="w-10 px-3 py-2.5">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    disabled={filteredRows.length === 0}
                    aria-label="সবাইকে নির্বাচন করুন"
                    title="সবাইকে নির্বাচন / বাদ দিন"
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                  />
                </th>
                <th className="w-16 px-2 py-2.5">রোল</th>
                <th className="px-2 py-2.5">নাম</th>
                <th className="px-3 py-2.5 text-right">বাকি</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-400 dark:text-slate-500">
                    "{search}" — কাউকে পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const checked = selected.has(r.invoice_id);
                  const partlyPaid = Number(r.paid || 0) > 0 || Number(r.waived || 0) > 0;
                  return (
                    <tr
                      key={r.invoice_id}
                      onClick={() => step === "select" && toggleRow(r.invoice_id)}
                      className={`cursor-pointer border-t border-gray-100 transition-colors dark:border-slate-800 ${
                        checked
                          ? "bg-blue-50/70 hover:bg-blue-50 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
                          : "hover:bg-gray-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRow(r.invoice_id)}
                          aria-label={`${r.name_bn} নির্বাচন`}
                          className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                        />
                      </td>
                      <td className="px-2 py-2 tabular-nums text-gray-600 dark:text-slate-400">
                        {r.roll != null ? bn(r.roll) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-gray-800 dark:text-slate-100">{r.name_bn}</div>
                        {partlyPaid && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            মোট {taka(Number(r.amount))}
                            {Number(r.paid) > 0 ? ` · আগে দিয়েছে ${taka(Number(r.paid))}` : ""}
                            {Number(r.waived) > 0 ? ` · মওকুফ ${taka(Number(r.waived))}` : ""}
                          </div>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${
                          checked ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-500"
                        }`}
                      >
                        {taka(Number(r.due))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-slate-400">
          <Info size={13} className="mt-0.5 shrink-0" />
          এখানে শুধু সম্পূর্ণ বাকি গ্রহণ করা হয়। আংশিক পরিশোধের জন্য ছাত্র খুঁজে আলাদাভাবে ফি গ্রহণ করুন।
        </p>
      </div>
    );
  };

  const renderFooter = () => {
    if (!sheet || rows.length === 0 || sheetLoading) return null;

    if (step === "confirm") {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-base font-bold">
                {bn(selectedRows.length)} জনের মোট {taka(selectedTotal)} গ্রহণ করবেন?
              </div>
              <div className="mt-0.5 text-xs opacity-90">
                {sheet.exam.name} · {sheet.class.name_bn} · {METHOD_LABELS[form.method]} ·{" "}
                {new Date(`${form.paid_at}T00:00:00`).toLocaleDateString("bn-BD")}
                {notifyGuardian ? " · অভিভাবককে SMS যাবে" : " · SMS যাবে না"}
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep("select")}
              className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft size={14} />
              ফিরে যান
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {submitting ? "গ্রহণ করা হচ্ছে..." : "হ্যাঁ, গ্রহণ করুন"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div>
            <label className={labelCls}>পদ্ধতি</label>
            <select
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}
              className={inputCls}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>তারিখ</label>
            <input
              type="date"
              value={form.paid_at}
              max={today}
              onChange={(e) => setForm((f) => ({ ...f, paid_at: e.target.value }))}
              className={`${inputCls} ${dateInvalid ? "border-rose-400 dark:border-rose-500" : ""}`}
            />
          </div>
          {configuredMethods.length > 0 && (
            <div>
              <label className={labelCls}>চ্যানেল (ঐচ্ছিক)</label>
              <select
                value={form.payment_method_setting_id}
                onChange={(e) => setForm((f) => ({ ...f, payment_method_setting_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">নির্বাচন করুন</option>
                {configuredMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.accountNumber ? ` — ${m.accountNumber}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.method !== "CASH" && (
            <div>
              <label className={labelCls}>ট্রানজেকশন রেফ (ঐচ্ছিক)</label>
              <input
                type="text"
                value={form.transaction_ref}
                onChange={(e) => setForm((f) => ({ ...f, transaction_ref: e.target.value }))}
                className={inputCls}
              />
            </div>
          )}
          <div className="col-span-2 sm:col-span-4">
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="নোট (ঐচ্ছিক)"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="text-sm text-gray-600 dark:text-slate-400">
              নির্বাচিত <b className="text-gray-900 dark:text-slate-100">{bn(selectedRows.length)} জন</b> · মোট{" "}
              <b className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{taka(selectedTotal)}</b>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={notifyGuardian}
                onChange={(e) => setNotifyGuardian(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
              />
              অভিভাবককে SMS পাঠান
            </label>
          </div>
          <button
            type="button"
            disabled={selectedRows.length === 0 || dateInvalid}
            onClick={requestConfirm}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Wallet size={15} />
            ফি গ্রহণ করুন
          </button>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!result) return null;
    const ok = result.succeeded.length;
    return (
      <div className="flex flex-col gap-4">
        <div
          className={`flex flex-col items-center gap-1.5 rounded-xl px-4 py-6 text-center ${
            ok > 0
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          {ok > 0 ? <CheckCircle2 size={36} /> : <AlertTriangle size={36} />}
          <div className="text-lg font-bold">
            {ok > 0 ? `${bn(ok)} জনের ফি গ্রহণ হয়েছে` : "কোনো ফি গ্রহণ হয়নি"}
          </div>
          {ok > 0 && (
            <div className="text-sm">
              মোট সংগৃহীত <b className="text-xl font-extrabold">{taka(Number(result.total_collected || 0))}</b>
            </div>
          )}
          {sheet && (
            <div className="text-xs opacity-80">
              {sheet.exam.name} · {sheet.class.name_bn}
            </div>
          )}
        </div>

        {result.failed.length > 0 && (
          <div className="rounded-xl ring-1 ring-rose-200 dark:ring-rose-900">
            <div className="flex items-center gap-1.5 border-b border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertTriangle size={14} />
              {bn(result.failed.length)} জনের ফি গ্রহণ করা যায়নি
            </div>
            <ul className="max-h-60 divide-y divide-gray-100 overflow-y-auto dark:divide-slate-800">
              {result.failed.map((f) => (
                <li key={f.invoice_id} className="px-3 py-2 text-sm">
                  <div className="font-medium text-gray-800 dark:text-slate-100">{f.name_bn}</div>
                  <div className="text-xs text-rose-600 dark:text-rose-400">{f.reason}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={startAnother}
            className="h-10 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {result.failed.length > 0 ? "তালিকায় ফিরে যান" : "আরেকটি শ্রেণি"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="h-10 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (overviewLoading && !overview) {
      return renderCentered(<Loader2 size={26} className="animate-spin text-blue-500" />, "লোড হচ্ছে...");
    }
    if (overviewError) {
      return renderCentered(
        <AlertTriangle size={28} className="text-amber-500" />,
        "পরীক্ষার তালিকা লোড করা যায়নি",
        undefined,
        <button
          type="button"
          onClick={loadOverview}
          className="mt-1 h-9 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          আবার চেষ্টা করুন
        </button>,
      );
    }
    if (examOptions.length === 0) {
      return renderCentered(
        <ClipboardList size={30} className="text-gray-300 dark:text-slate-600" />,
        "কোনো পরীক্ষার ফি চালু নেই",
        "ফি সেটাপ → পরীক্ষার ফি থেকে পরিমাণ বসিয়ে ফি চালু করলে এখানে শ্রেণিভিত্তিক গ্রহণ করা যাবে।",
      );
    }
    if (step === "result") return renderResult();

    const footer = renderFooter();
    return (
      <div className="flex flex-col gap-4">
        <fieldset disabled={step === "confirm"} className="flex min-w-0 flex-col gap-4">
          {renderPicker()}
          {renderSheet()}
        </fieldset>
        {footer && (
          <div className="sticky -bottom-4 z-20 -mx-5 -mb-4 border-t border-gray-200 bg-white/95 px-5 pb-4 pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            {footer}
          </div>
        )}
      </div>
    );
  };

  const title =
    step === "result"
      ? "পরীক্ষার ফি — ফলাফল"
      : selectedExam && selectedClass
        ? `পরীক্ষার ফি — ${selectedClass.name}`
        : "পরীক্ষার ফি — শ্রেণিভিত্তিক গ্রহণ";

  return (
    <Modal open={open} title={title} onClose={handleClose} maxWidthClassName="max-w-3xl">
      {renderBody()}
    </Modal>
  );
};

export default ExamFeeBulkCollectModal;
