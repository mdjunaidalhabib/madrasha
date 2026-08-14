import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Wallet, CircleCheck, X, HandCoins, Printer, CheckSquare, Square } from "lucide-react";
import { cachedGet } from "../../services/api";
import {
  invoiceApi,
  paymentMethodSettingApi,
  type InvoiceStatus,
  type PaymentMethod,
  type PaymentMethodSetting,
} from "../../services/phase2Api";
import { type Session } from "../../services/sessionApi";
import { useToastStore } from "../../store/toastStore";
import { useAuthStore } from "../../store/authStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";
import InvoicePrintModal from "./InvoicePrintModal";

type StudentOption = { id: number; name_bn?: string; roll?: number; registration_no?: number | string | null };

type InvoiceRow = {
  id: number;
  studentId: number;
  title: string;
  amount: string | number;
  paidAmount: string | number;
  waivedAmount: string | number;
  dueDate: string;
  status: InvoiceStatus;
  month?: string | null;
  student?: { nameBn?: string; roll?: number } | null;
};

const remainingDue = (inv: { amount: string | number; paidAmount: string | number; waivedAmount?: string | number }) =>
  Number(inv.amount) - Number(inv.paidAmount) - Number(inv.waivedAmount || 0);

const STATUS_LABELS: Record<InvoiceStatus, { label: string; className: string }> = {
  UNPAID: { label: "অপরিশোধিত", className: "bg-red-100 text-red-700" },
  PARTIALLY_PAID: { label: "আংশিক পরিশোধিত", className: "bg-amber-100 text-amber-700" },
  PAID: { label: "পরিশোধিত", className: "bg-green-100 text-green-700" },
  OVERDUE: { label: "মেয়াদোত্তীর্ণ", className: "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300" },
  WAIVED: { label: "মাফকৃত", className: "bg-purple-100 text-purple-700" },
};

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BKASH", "NAGAD", "BANK", "ONLINE"];

const BN_MONTH_NAMES = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

// invoice.month is stored "YYYY-MM" (calendar month); rendered as the Bangla
// month name + Bangla-digit year for the monthly fee grid.
const monthLabel = (month: string) => {
  const [year, monthNum] = month.split("-");
  const name = BN_MONTH_NAMES[Number(monthNum) - 1] || month;
  return `${name} ${Number(year).toLocaleString("bn-BD")}`;
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const emptyPayCommon = {
  method: "CASH" as PaymentMethod,
  payment_method_setting_id: "",
  transaction_ref: "",
  note: "",
  paid_at: todayIso(),
};
type PayLine = { selected: boolean; amount: string };

const FeeInvoicesPage = () => {
  // Every student's own fee data is loaded on demand only (searched by name
  // / roll / id), instead of pulling every invoice for every student up
  // front — that "everything at once" list was both slow and cluttered.
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [checkedInvoiceIds, setCheckedInvoiceIds] = useState<Set<number>>(new Set());

  const [payTarget, setPayTarget] = useState<InvoiceRow[] | null>(null);
  const [payStudentLabel, setPayStudentLabel] = useState("");
  const [payLines, setPayLines] = useState<Record<number, PayLine>>({});
  const [payCommon, setPayCommon] = useState(emptyPayCommon);
  const [paying, setPaying] = useState(false);
  const [configuredMethods, setConfiguredMethods] = useState<PaymentMethodSetting[]>([]);

  const role = useAuthStore((s) => s.user?.role);
  const isMuhtamim = role === "MUHTAMIM" || role === "মুহতামিম";

  const [waiveTarget, setWaiveTarget] = useState<InvoiceRow | null>(null);
  const [waiveAmount, setWaiveAmount] = useState("");
  const [waiveReason, setWaiveReason] = useState("");
  const [waiving, setWaiving] = useState(false);

  const [printTarget, setPrintTarget] = useState<InvoiceRow | null>(null);

  const loadConfiguredMethods = useCallback(async () => {
    try {
      const res = await paymentMethodSettingApi.list(true);
      setConfiguredMethods(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD PAYMENT METHOD SETTINGS ERROR:", err);
      setConfiguredMethods([]);
    }
  }, []);

  useEffect(() => {
    loadConfiguredMethods();
  }, [loadConfiguredMethods]);

  // Lightweight (no invoices/payments joined) list of students, loaded once,
  // used purely to power the search-by-name/roll/reg-no/id suggestions below.
  // Scoped to the current session only — otherwise every past session's
  // students (promoted, passed out, transferred) clutter the search.
  useEffect(() => {
    (async () => {
      try {
        const sessionsRes = await cachedGet("/sessions?active_only=true");
        const sessions = normalizeArray(sessionsRes) as unknown as Session[];
        const currentSessionId = sessions.find((s) => s.isCurrent)?.id;

        const res = await cachedGet(
          currentSessionId ? `/students?session_id=${currentSessionId}` : "/students",
        );
        setAllStudents(normalizeArray(res));
      } catch (err) {
        logger.error("LOAD STUDENTS ERROR:", err);
        setAllStudents([]);
      }
    })();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const studentSuggestions = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return [];
    return allStudents
      .filter((s) => {
        const name = (s.name_bn || "").toLowerCase();
        const roll = String(s.roll ?? "");
        const regNo = String(s.registration_no ?? "");
        const id = String(s.id);
        return name.includes(q) || roll.includes(q) || regNo.includes(q) || id === q;
      })
      .slice(0, 8);
  }, [allStudents, studentQuery]);

  const selectStudent = (student: StudentOption) => {
    setSelectedStudent(student);
    setStudentQuery("");
    setShowSuggestions(false);
  };

  // Registration number is the student's permanent, unique identifier, so a
  // full exact match on it is unambiguous — select it immediately instead of
  // waiting for the office to click the suggestion.
  useEffect(() => {
    const q = studentQuery.trim();
    if (!q || selectedStudent) return;
    const exactMatch = allStudents.find((s) => s.registration_no != null && String(s.registration_no) === q);
    if (exactMatch) selectStudent(exactMatch);
  }, [studentQuery, allStudents, selectedStudent]);

  const clearStudent = () => {
    setSelectedStudent(null);
    setInvoices([]);
    setStudentQuery("");
  };

  const loadInvoices = useCallback(async () => {
    if (!selectedStudent) return;
    try {
      setInvoicesLoading(true);
      const res = await invoiceApi.list({
        student_id: selectedStudent.id,
        status: (invoiceStatusFilter as InvoiceStatus) || undefined,
      });
      setInvoices(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD INVOICES ERROR:", err);
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [selectedStudent, invoiceStatusFilter]);

  useEffect(() => {
    loadInvoices();
    setCheckedInvoiceIds(new Set());
  }, [loadInvoices]);

  const toggleCheckedInvoice = (invoiceId: number) => {
    setCheckedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  };

  // Opens the payment modal for one or many invoices at once (single "পেমেন্ট
  // নিন" click passes one invoice; "সব বকেয়া ফি নিন" passes every unpaid
  // invoice for that student) so both flows share one form and one API loop.
  const openPayModal = (targetInvoices: InvoiceRow[], studentLabel: string) => {
    const lines: Record<number, PayLine> = {};
    targetInvoices.forEach((inv) => {
      const remaining = remainingDue(inv);
      lines[inv.id] = { selected: true, amount: remaining > 0 ? String(remaining) : "0" };
    });
    setPayTarget(targetInvoices);
    setPayStudentLabel(studentLabel);
    setPayLines(lines);
    setPayCommon(emptyPayCommon);
  };

  const togglePayLine = (invoiceId: number) => {
    setPayLines((prev) => ({
      ...prev,
      [invoiceId]: { ...prev[invoiceId], selected: !prev[invoiceId].selected },
    }));
  };

  const setPayLineAmount = (invoiceId: number, amount: string) => {
    setPayLines((prev) => ({ ...prev, [invoiceId]: { ...prev[invoiceId], amount } }));
  };

  const selectedPayTotal = useMemo(
    () =>
      Object.values(payLines).reduce(
        (sum, line) => (line.selected ? sum + (Number(line.amount) || 0) : sum),
        0,
      ),
    [payLines],
  );

  const handlePay = async () => {
    if (!payTarget) return;
    const selected = Object.entries(payLines).filter(
      ([, line]) => line.selected && Number(line.amount) > 0,
    );
    if (selected.length === 0) {
      useToastStore.getState().show("অন্তত একটি ফি নির্বাচন করে পরিমাণ দিন", "error");
      return;
    }

    try {
      setPaying(true);
      let success = 0;
      let failed = 0;
      for (const [invoiceIdStr, line] of selected) {
        try {
          await invoiceApi.pay(Number(invoiceIdStr), {
            amount: Number(line.amount),
            method: payCommon.method,
            transaction_ref: payCommon.transaction_ref.trim() || undefined,
            payment_method_setting_id: payCommon.payment_method_setting_id
              ? Number(payCommon.payment_method_setting_id)
              : undefined,
            note: payCommon.note.trim() || undefined,
            paid_at: payCommon.paid_at || undefined,
          });
          success += 1;
        } catch (err) {
          failed += 1;
          logger.error("PAY INVOICE ERROR:", err);
        }
      }

      if (failed === 0) {
        useToastStore
          .getState()
          .show(success > 1 ? `${success}টি ফি একসাথে পরিশোধ রেকর্ড হয়েছে` : "পেমেন্ট রেকর্ড করা হয়েছে", "success");
        setPayTarget(null);
        setCheckedInvoiceIds(new Set());
      } else {
        useToastStore
          .getState()
          .show(`${success}টি পরিশোধ হয়েছে, ${failed}টি ব্যর্থ হয়েছে — আবার চেষ্টা করুন`, "error");
      }
      loadInvoices();
    } finally {
      setPaying(false);
    }
  };

  const openWaiveModal = (invoice: InvoiceRow) => {
    setWaiveTarget(invoice);
    setWaiveAmount(String(remainingDue(invoice)));
    setWaiveReason("");
  };

  const handleWaive = async () => {
    if (!waiveTarget) return;
    if (!waiveAmount || Number(waiveAmount) <= 0) {
      useToastStore.getState().show("মাফের পরিমাণ দিন", "error");
      return;
    }
    if (!waiveReason.trim()) {
      useToastStore.getState().show("মাফের কারণ লিখুন", "error");
      return;
    }

    try {
      setWaiving(true);
      await invoiceApi.waive(waiveTarget.id, {
        amount: Number(waiveAmount),
        reason: waiveReason.trim(),
      });
      useToastStore.getState().show("কিস্তি মাফ করা হয়েছে", "success");
      setWaiveTarget(null);
      loadInvoices();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মাফ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setWaiving(false);
    }
  };

  const unpaidInvoices = useMemo(
    () => invoices.filter((inv) => inv.status !== "PAID" && inv.status !== "WAIVED"),
    [invoices],
  );

  const invoiceSummary = useMemo(() => {
    let totalDue = 0;
    let totalCollected = 0;
    for (const inv of invoices) {
      totalCollected += Number(inv.paidAmount);
      if (inv.status !== "PAID" && inv.status !== "WAIVED") totalDue += remainingDue(inv);
    }
    return { totalDue, totalCollected };
  }, [invoices]);

  const checkedInvoices = useMemo(
    () => unpaidInvoices.filter((inv) => checkedInvoiceIds.has(inv.id)),
    [unpaidInvoices, checkedInvoiceIds],
  );
  const checkedTotal = useMemo(
    () => checkedInvoices.reduce((sum, inv) => sum + remainingDue(inv), 0),
    [checkedInvoices],
  );
  const allChecked = unpaidInvoices.length > 0 && checkedInvoiceIds.size === unpaidInvoices.length;
  const toggleCheckAll = () => {
    setCheckedInvoiceIds(allChecked ? new Set() : new Set(unpaidInvoices.map((inv) => inv.id)));
  };

  // Monthly fees (e.g. "মাসিক বেতন") are shown as one horizontal row per fee
  // name, oldest month first — grouped by title since a student can be on
  // more than one monthly fee structure at once. One-time/yearly fees (no
  // month) keep the plain list layout below the grid.
  const monthlyGroups = useMemo(() => {
    const map = new Map<string, InvoiceRow[]>();
    for (const inv of invoices) {
      if (!inv.month) continue;
      if (!map.has(inv.title)) map.set(inv.title, []);
      map.get(inv.title)!.push(inv);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.month! < b.month! ? -1 : a.month! > b.month! ? 1 : 0));
    }
    return Array.from(map.entries()).map(([title, items]) => ({ title, items }));
  }, [invoices]);

  const otherInvoices = useMemo(() => invoices.filter((inv) => !inv.month), [invoices]);

  return (
    <div
      className={`min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6 ${checkedInvoices.length > 0 ? "pb-20" : ""}`}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">ফি গ্রহণ</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            ছাত্রদের বকেয়া ইনভয়েস দেখুন, পেমেন্ট রেকর্ড করুন এবং প্রয়োজনে মাফ করুন
          </p>
        </div>

        {/* Student search — the only thing needed before anything shows */}
        <div ref={searchBoxRef} className="relative mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {selectedStudent ? (
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">
                <span className="font-semibold text-gray-800 dark:text-slate-100">{selectedStudent.name_bn || `ছাত্র #${selectedStudent.id}`}</span>{" "}
                <span className="text-gray-500 dark:text-slate-400">
                  (রোল {selectedStudent.roll ?? "-"}
                  {selectedStudent.registration_no ? ` · রেজি নং ${selectedStudent.registration_no}` : ""})
                </span>
              </div>
              <button
                type="button"
                onClick={clearStudent}
                className="flex h-8 items-center gap-1 rounded-md border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X size={13} />
                বদলান
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => {
                  setStudentQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="ছাত্রের নাম, রোল, রেজি নং বা আইডি দিয়ে খুঁজুন"
                className="h-10 w-full rounded-md border border-gray-300 pl-8 pr-3 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {showSuggestions && studentQuery.trim() && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {studentSuggestions.length === 0 ? (
                    <div className="px-3 py-3 text-center text-sm text-gray-400 dark:text-slate-500">কোনো ছাত্র পাওয়া যায়নি</div>
                  ) : (
                    studentSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectStudent(s)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        <span className="text-gray-800 dark:text-slate-200">{s.name_bn || `ছাত্র #${s.id}`}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                          রোল {s.roll ?? "-"}
                          {s.registration_no ? ` · রেজি ${s.registration_no}` : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!selectedStudent ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
            ফি দেখতে ও নিতে প্রথমে একজন ছাত্র খুঁজে নির্বাচন করুন
          </div>
        ) : (
          <>
            <div className="mb-4">
              <select
                value={invoiceStatusFilter}
                onChange={(event) => setInvoiceStatusFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[180px]"
              >
                <option value="">সব স্ট্যাটাস</option>
                {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary stats */}
            {!invoicesLoading && invoices.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-xl bg-white p-3 text-center shadow-sm dark:bg-slate-900 sm:p-4">
                  <div className="text-[11px] text-gray-500 dark:text-slate-400 sm:text-xs">মোট বকেয়া</div>
                  <div className="mt-0.5 text-base font-bold text-rose-600 dark:text-rose-400 sm:text-lg">
                    ৳{invoiceSummary.totalDue.toLocaleString("bn-BD")}
                  </div>
                </div>
                <div className="rounded-xl bg-white p-3 text-center shadow-sm dark:bg-slate-900 sm:p-4">
                  <div className="text-[11px] text-gray-500 dark:text-slate-400 sm:text-xs">সংগৃহীত</div>
                  <div className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400 sm:text-lg">
                    ৳{invoiceSummary.totalCollected.toLocaleString("bn-BD")}
                  </div>
                </div>
              </div>
            )}

            {/* This student's invoices */}
            <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
              {invoicesLoading ? (
                <SkeletonList items={4} />
              ) : invoices.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">এই ছাত্রের কোনো ইনভয়েস নেই</div>
              ) : (
                <>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    {unpaidInvoices.length > 0 ? (
                      <button
                        type="button"
                        onClick={toggleCheckAll}
                        className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {allChecked ? (
                          <CheckSquare size={15} className="text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square size={15} className="text-gray-400 dark:text-slate-500" />
                        )}
                        সব নির্বাচন করুন
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                        <CircleCheck size={12} />
                        সব পরিশোধিত
                      </span>
                    )}
                  </div>

                  {/* Monthly fees — one small table per fee name. Month names
                      sit once in the header row (latest month leftmost,
                      earliest rightmost — DOM order handles the right-to-left
                      serial reading, no bidi tricks needed); every attribute
                      below (নিন/checkbox, বকেয়া/amount, মাফ, প্রিন্ট) is its
                      own row so each stays a separate field instead of being
                      crammed into one cell. */}
                  {monthlyGroups.length > 0 && (
                    <div className="mb-4 flex flex-col gap-4">
                      {monthlyGroups.map((group) => {
                        const sorted = [...group.items].sort((a, b) =>
                          a.month! < b.month! ? 1 : a.month! > b.month! ? -1 : 0,
                        );
                        const gridStyle = { gridTemplateColumns: `60px repeat(${sorted.length}, 84px)` };
                        return (
                          <div key={group.title}>
                            <h4 className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-slate-400">{group.title}</h4>
                            <div className="overflow-x-auto pb-1">
                              <div className="grid items-center gap-x-1.5 gap-y-2" style={gridStyle}>
                                {/* header row: month names, once */}
                                <div className="sticky left-0 z-10 bg-white dark:bg-slate-900" />
                                {sorted.map((invoice) => (
                                  <div
                                    key={`h-${invoice.id}`}
                                    className="text-center text-[11px] font-medium text-gray-700 dark:text-slate-300"
                                  >
                                    {monthLabel(invoice.month!)}
                                  </div>
                                ))}

                                {/* checkbox row — selection only, nothing else in this field */}
                                <div className="sticky left-0 z-10 bg-white text-[10px] font-medium text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                                  নিন
                                </div>
                                {sorted.map((invoice) => {
                                  const canAct = invoice.status !== "PAID" && invoice.status !== "WAIVED";
                                  const checked = checkedInvoiceIds.has(invoice.id);
                                  return (
                                    <div
                                      key={`c-${invoice.id}`}
                                      className={`flex justify-center rounded py-0.5 ${checked ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
                                    >
                                      {invoice.status === "PAID" ? (
                                        <CircleCheck size={16} className="text-green-600 dark:text-green-400" />
                                      ) : (
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={!canAct}
                                          onChange={() => toggleCheckedInvoice(invoice.id)}
                                          className="h-4 w-4 rounded border-gray-300 disabled:opacity-40 dark:border-slate-600"
                                        />
                                      )}
                                    </div>
                                  );
                                })}

                                {/* due amount row */}
                                <div className="sticky left-0 z-10 bg-white text-[10px] font-medium text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                                  বকেয়া
                                </div>
                                {sorted.map((invoice) => {
                                  const remaining = remainingDue(invoice);
                                  return (
                                    <div key={`a-${invoice.id}`} className="text-center text-[10px] font-semibold">
                                      {remaining > 0 ? (
                                        <span className="text-rose-600 dark:text-rose-400">৳{remaining}</span>
                                      ) : (
                                        <span className="text-gray-300 dark:text-slate-600">—</span>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* waive row */}
                                <div className="sticky left-0 z-10 bg-white text-[10px] font-medium text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                                  মাফ
                                </div>
                                {sorted.map((invoice) => {
                                  const canAct = invoice.status !== "PAID" && invoice.status !== "WAIVED";
                                  const waived = Number(invoice.waivedAmount) > 0;
                                  return (
                                    <div key={`w-${invoice.id}`} className="flex justify-center">
                                      {waived ? (
                                        <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">
                                          ৳{invoice.waivedAmount}
                                        </span>
                                      ) : canAct && isMuhtamim ? (
                                        <button
                                          type="button"
                                          title="মাফ করুন"
                                          onClick={() => openWaiveModal(invoice)}
                                          className="rounded p-0.5 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/40"
                                        >
                                          <HandCoins size={13} />
                                        </button>
                                      ) : (
                                        <span className="text-gray-300 dark:text-slate-600">—</span>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* print row */}
                                <div className="sticky left-0 z-10 bg-white text-[10px] font-medium text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                                  প্রিন্ট
                                </div>
                                {sorted.map((invoice) => (
                                  <div key={`p-${invoice.id}`} className="flex justify-center">
                                    <button
                                      type="button"
                                      title="প্রিন্ট"
                                      onClick={() => setPrintTarget(invoice)}
                                      className="rounded p-0.5 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    >
                                      <Printer size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* One-time / yearly fees — no month, plain list */}
                  {otherInvoices.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {otherInvoices.map((invoice) => {
                        const remaining = remainingDue(invoice);
                        const canAct = invoice.status !== "PAID" && invoice.status !== "WAIVED";
                        const checked = checkedInvoiceIds.has(invoice.id);
                        return (
                          <div
                            key={invoice.id}
                            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${
                              checked ? "border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30" : "border-gray-100 dark:border-slate-800"
                            }`}
                          >
                            <label className="flex min-w-0 flex-1 items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!canAct}
                                onChange={() => toggleCheckedInvoice(invoice.id)}
                                className="h-4 w-4 shrink-0 rounded border-gray-300 disabled:opacity-40 dark:border-slate-600"
                              />
                              <span className="min-w-0">
                                <span className="text-gray-800 dark:text-slate-200">{invoice.title}</span>{" "}
                                <span className="text-gray-500 dark:text-slate-400">৳{invoice.amount}</span>{" "}
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_LABELS[invoice.status].className}`}
                                >
                                  {STATUS_LABELS[invoice.status].label}
                                </span>
                                {remaining > 0 && (
                                  <span className="font-medium text-rose-600 dark:text-rose-400"> · বকেয়া ৳{remaining}</span>
                                )}
                                {Number(invoice.waivedAmount) > 0 && (
                                  <span className="text-purple-600 dark:text-purple-400"> · মাফ ৳{invoice.waivedAmount}</span>
                                )}
                              </span>
                            </label>

                            <div className="flex shrink-0 gap-1.5">
                              <button
                                type="button"
                                title="প্রিন্ট"
                                onClick={() => setPrintTarget(invoice)}
                                className="flex h-7 items-center rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Printer size={13} />
                              </button>
                              {canAct && isMuhtamim && (
                                <button
                                  type="button"
                                  onClick={() => openWaiveModal(invoice)}
                                  className="flex h-7 items-center gap-1 rounded-md border border-purple-200 px-2.5 text-xs font-medium text-purple-700 transition hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-400 dark:hover:bg-purple-950/40"
                                >
                                  <HandCoins size={13} />
                                  মাফ করুন
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sticky collect bar — appears once at least one fee is checked, stays
          on screen while scrolling the list so the office can tick several
          months and collect them together without hunting for the button. */}
      {checkedInvoices.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-3 py-2.5 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-4">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-600 dark:text-slate-400">
              {checkedInvoices.length}টি নির্বাচিত ·{" "}
              <span className="font-semibold text-gray-800 dark:text-slate-100">৳{checkedTotal.toLocaleString("bn-BD")}</span>
            </span>
            <button
              type="button"
              onClick={() => openPayModal(checkedInvoices, selectedStudent?.name_bn || "")}
              className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Wallet size={14} />
              নির্বাচিত ফি সংগ্রহ করুন
            </button>
          </div>
        </div>
      )}

      {/* Pay invoice(s) modal — handles both a single "পেমেন্ট নিন" click and
          "সব বকেয়া ফি নিন" (every unpaid fee for one student at once) */}
      <Modal
        open={!!payTarget}
        title={`পেমেন্ট রেকর্ড করুন — ${payStudentLabel}`}
        onClose={() => setPayTarget(null)}
        maxWidthClassName="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          {payTarget && payTarget.length > 1 && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-gray-50 p-2.5 dark:bg-slate-800">
              {payTarget.map((invoice) => {
                const remaining = remainingDue(invoice);
                const line = payLines[invoice.id];
                if (!line) return null;
                return (
                  <div key={invoice.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={() => togglePayLine(invoice.id)}
                      className="h-4 w-4 shrink-0 rounded border-gray-300 dark:border-slate-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-slate-300">
                      {invoice.title} <span className="text-gray-400 dark:text-slate-500">(বাকি ৳{remaining})</span>
                    </span>
                    <input
                      type="number"
                      value={line.amount}
                      disabled={!line.selected}
                      onChange={(e) => setPayLineAmount(invoice.id, e.target.value)}
                      className="h-8 w-24 shrink-0 rounded-md border border-gray-300 px-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800/60"
                    />
                  </div>
                );
              })}
              <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-1.5 text-sm font-semibold text-gray-800 dark:border-slate-700 dark:text-slate-100">
                <span>মোট নেওয়া হবে</span>
                <span>৳{selectedPayTotal.toLocaleString("bn-BD")}</span>
              </div>
            </div>
          )}

          {payTarget && payTarget.length === 1 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পরিমাণ (৳)</label>
              <input
                type="number"
                value={payLines[payTarget[0].id]?.amount ?? ""}
                onChange={(e) => setPayLineAmount(payTarget[0].id, e.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                বাকি আছে: ৳{remainingDue(payTarget[0])}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পদ্ধতি</label>
              <select
                value={payCommon.method}
                onChange={(e) => setPayCommon((p) => ({ ...p, method: e.target.value as PaymentMethod }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">তারিখ</label>
              <input
                type="date"
                value={payCommon.paid_at}
                max={todayIso()}
                onChange={(e) => setPayCommon((p) => ({ ...p, paid_at: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {configuredMethods.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                কোন চ্যানেলে টাকা পাওয়া গেছে (ঐচ্ছিক)
              </label>
              <select
                value={payCommon.payment_method_setting_id}
                onChange={(e) =>
                  setPayCommon((p) => ({ ...p, payment_method_setting_id: e.target.value }))
                }
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">নির্বাচন করুন (ঐচ্ছিক)</option>
                {configuredMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label}
                    {method.accountNumber ? ` — ${method.accountNumber}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              ট্রানজেকশন রেফারেন্স (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={payCommon.transaction_ref}
              onChange={(e) => setPayCommon((p) => ({ ...p, transaction_ref: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">নোট (ঐচ্ছিক)</label>
            <textarea
              value={payCommon.note}
              onChange={(e) => setPayCommon((p) => ({ ...p, note: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="যেমন: আংশিক পরিশোধ, বাকিটা পরের মাসে দেবে"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPayTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={paying || selectedPayTotal <= 0}
            onClick={handlePay}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {paying ? "সংরক্ষণ হচ্ছে..." : `৳${selectedPayTotal.toLocaleString("bn-BD")} পেমেন্ট নিশ্চিত করুন`}
          </button>
        </div>
      </Modal>

      {/* Waive (partial/full forgiveness) modal — Muhtamim only */}
      <Modal
        open={!!waiveTarget}
        title={`কিস্তি মাফ করুন — ${waiveTarget?.title || ""}`}
        onClose={() => setWaiveTarget(null)}
      >
        {waiveTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              বাকি আছে: ৳{remainingDue(waiveTarget)}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">মাফের পরিমাণ (৳)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={waiveAmount}
                  onChange={(e) => setWaiveAmount(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setWaiveAmount(String(remainingDue(waiveTarget)))}
                  className="h-9 shrink-0 rounded-md border border-purple-200 px-3 text-xs font-medium text-purple-700 hover:bg-purple-50"
                >
                  সম্পূর্ণ মাফ করুন
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">কারণ</label>
              <textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="যেমন: এতিম ছাত্র, আর্থিক অসচ্ছলতা"
              />
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setWaiveTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={waiving}
            onClick={handleWaive}
            className="h-9 rounded-md bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {waiving ? "সংরক্ষণ হচ্ছে..." : "মাফ নিশ্চিত করুন"}
          </button>
        </div>
      </Modal>

      <InvoicePrintModal
        invoice={printTarget}
        studentLabel={
          printTarget
            ? `${printTarget.student?.nameBn || ""}${printTarget.student?.roll ? ` (রোল ${printTarget.student.roll})` : ""}`
            : ""
        }
        onClose={() => setPrintTarget(null)}
      />
    </div>
  );
};

export default FeeInvoicesPage;
