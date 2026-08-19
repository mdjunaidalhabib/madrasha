import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Wallet, CircleCheck, X, Pencil, Check } from "lucide-react";
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
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";
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

const toPositiveAmount = (value: string | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const STATUS_LABELS: Record<InvoiceStatus, { label: string; className: string }> = {
  UNPAID: { label: "অপরিশোধিত", className: "bg-red-100 text-red-700" },
  PARTIALLY_PAID: { label: "আংশিক পরিশোধিত", className: "bg-amber-100 text-amber-700" },
  PAID: { label: "পরিশোধিত", className: "bg-green-100 text-green-700" },
  OVERDUE: { label: "মেয়াদোত্তীর্ণ", className: "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300" },
  WAIVED: { label: "মওকুফকৃত", className: "bg-purple-100 text-purple-700" },
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

// Short forms for the ledger table's column headers on narrow screens — the
// full Bangla month names make a 12-column table far wider than any phone,
// so mobile gets the compact form and larger screens get the full name.
const BN_MONTH_SHORT = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];

// invoice.month is stored "YYYY-MM" (calendar month); rendered as the Bangla
// month name + Bangla-digit year for the monthly fee grid.
const monthLabel = (month: string) => {
  const [year, monthNum] = month.split("-");
  const name = BN_MONTH_NAMES[Number(monthNum) - 1] || month;
  return `${name} ${Number(year).toLocaleString("bn-BD")}`;
};

const monthShortLabel = (month: string) => {
  const monthNum = Number(month.split("-")[1]);
  return BN_MONTH_SHORT[monthNum - 1] || month;
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

  type StudentDetail = {
    father_name?: string | null;
    guardian_phone?: string | null;
    village?: string | null;
    thana?: string | null;
    district?: string | null;
    current_class?: string | null;
  };
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [checkedInvoiceIds, setCheckedInvoiceIds] = useState<Set<number>>(new Set());
  // Row-level gate: a fee row's month checkboxes stay disabled until its own
  // row header checkbox is ticked — an intentional-action guard so nobody
  // collects a month by an accidental click on the ledger grid.
  const [unlockedRows, setUnlockedRows] = useState<Set<string>>(new Set());
  // Partial amount typed directly into a row's "পরিমাণ" cell — set only
  // when a single invoice is checked, so there's no ambiguity about which
  // invoice a hand-typed number belongs to. Falls back to the full due.
  const [amountOverrides, setAmountOverrides] = useState<Record<number, string>>({});
  const effectiveAmount = useCallback(
    (inv: InvoiceRow) => {
      const override = amountOverrides[inv.id];
      return override !== undefined ? toPositiveAmount(override) : remainingDue(inv);
    },
    [amountOverrides],
  );
  // "পরিমাণ" is plain read-only text by default (fully paid at a glance) —
  // tapping the pencil next to it opens a small inline edit-in-place (value
  // + save/cancel) instead of leaving a bare number spinner sitting in the
  // grid all the time.
  const [editingAmountId, setEditingAmountId] = useState<number | null>(null);
  const [amountDraft, setAmountDraft] = useState("");

  const startEditAmount = (invoice: InvoiceRow) => {
    setEditingAmountId(invoice.id);
    setAmountDraft(String(effectiveAmount(invoice)));
  };
  const cancelEditAmount = () => setEditingAmountId(null);
  const confirmEditAmount = (invoice: InvoiceRow) => {
    setInvoiceAmountOverride(invoice, amountDraft);
    setEditingAmountId(null);
  };

  const [payTarget, setPayTarget] = useState<InvoiceRow[] | null>(null);
  const [payStudentLabel, setPayStudentLabel] = useState("");
  const [payLines, setPayLines] = useState<Record<number, PayLine>>({});
  const [payCommon, setPayCommon] = useState(emptyPayCommon);
  const [paying, setPaying] = useState(false);
  const [configuredMethods, setConfiguredMethods] = useState<PaymentMethodSetting[]>([]);

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
    setStudentDetail(null);
    setStudentQuery("");
    setAmountOverrides({});
    setEditingAmountId(null);
  };

  // Full profile (guardian name, address, mobile) for the read-only info
  // card at the top of the collection sheet — the search list only carries
  // name/roll/reg-no, so this is fetched once a student is actually picked.
  useEffect(() => {
    if (!selectedStudent) {
      setStudentDetail(null);
      return;
    }
    (async () => {
      try {
        const res = await cachedGet(`/students/${selectedStudent.id}`);
        setStudentDetail((res as any)?.data?.data ?? null);
      } catch (err) {
        logger.error("LOAD STUDENT DETAIL ERROR:", err);
        setStudentDetail(null);
      }
    })();
  }, [selectedStudent]);

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
    setUnlockedRows(new Set());
    setAmountOverrides({});
    setEditingAmountId(null);
  }, [loadInvoices]);

  const toggleCheckedInvoice = (invoiceId: number) => {
    setCheckedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
    // Unchecking clears any hand-typed partial amount so a stale number
    // doesn't resurface if the same invoice gets checked again later.
    setAmountOverrides((prev) => {
      if (!(invoiceId in prev)) return prev;
      const next = { ...prev };
      delete next[invoiceId];
      return next;
    });
    setEditingAmountId((prev) => (prev === invoiceId ? null : prev));
  };

  // Typed directly into a row's "পরিমাণ" field — the field-level partial
  // payment path (no need to open the pay dialog just to reduce an amount).
  const setInvoiceAmountOverride = (invoice: InvoiceRow, value: string) => {
    setAmountOverrides((prev) => ({ ...prev, [invoice.id]: value }));
  };

  // Opens the payment modal for one or many invoices at once (single "পেমেন্ট
  // নিন" click passes one invoice; "সব বকেয়া ফি নিন" passes every unpaid
  // invoice for that student) so both flows share one form and one API loop.
  // Amounts already typed into the ledger's "পরিমাণ" field carry straight
  // into the dialog instead of resetting back to the full due.
  const openPayModal = (targetInvoices: InvoiceRow[], studentLabel: string) => {
    const lines: Record<number, PayLine> = {};
    targetInvoices.forEach((inv) => {
      const amount = effectiveAmount(inv);
      lines[inv.id] = { selected: true, amount: amount > 0 ? String(amount) : "0" };
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
        setAmountOverrides({});
        setEditingAmountId(null);
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
    () => checkedInvoices.reduce((sum, inv) => sum + effectiveAmount(inv), 0),
    [checkedInvoices, effectiveAmount],
  );

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

  // Every month that appears anywhere across the fee rows, oldest-first —
  // the single shared column set for the consolidated ledger table below.
  const allMonths = useMemo(() => {
    const set = new Set<string>();
    monthlyGroups.forEach((g) => g.items.forEach((inv) => set.add(inv.month!)));
    return Array.from(set).sort();
  }, [monthlyGroups]);

  const ledgerYear = useMemo(() => {
    const first = allMonths[0];
    return first ? Number(first.split("-")[0]) : new Date().getFullYear();
  }, [allMonths]);

  // The ledger table's column set is always the full year — before a
  // student is picked (nothing to derive months from) it falls back to
  // Jan–Dec of the current year, so the sheet has its shape from first load.
  const displayMonths = useMemo(() => {
    if (allMonths.length > 0) return allMonths;
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  }, [allMonths]);

  const studentAddress = useMemo(() => {
    if (!studentDetail) return "";
    return [studentDetail.village, studentDetail.thana, studentDetail.district].filter(Boolean).join(", ");
  }, [studentDetail]);

  return (
    <div
      className={`min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6 ${checkedInvoices.length > 0 ? "pb-28 sm:pb-20" : ""}`}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">ফি গ্রহণ</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            ছাত্র খুঁজে নিন, মাসিক ফি আদায়-অনাদায় ছক দেখুন ও পেমেন্ট রেকর্ড করুন
          </p>
        </div>

        {/* Student search — always visible; type to find, pick a suggestion
            and the card + ledger below auto-fill. An already-selected
            student shows as a chip here with a change control. */}
        <div ref={searchBoxRef} className="relative mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          {selectedStudent && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm dark:bg-blue-950/40">
              <span className="text-blue-800 dark:text-blue-300">
                নির্বাচিত: <b className="font-bold">{selectedStudent.name_bn || `ছাত্র #${selectedStudent.id}`}</b>
              </span>
              <button
                type="button"
                onClick={clearStudent}
                className="flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
              >
                <X size={12} />
                বদলান
              </button>
            </div>
          )}
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
              className="h-11 w-full rounded-md border border-gray-300 pl-8 pr-3 text-base outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
        </div>

        {/* Student info card — always visible, dashes until a student is
            picked, so this sheet has its shape from the very first load. */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
            ছাত্রের তথ্য
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "আইডি নং", value: selectedStudent ? selectedStudent.registration_no ?? selectedStudent.id : "—" },
              { label: "নাম", value: selectedStudent ? selectedStudent.name_bn || `ছাত্র #${selectedStudent.id}` : "—" },
              { label: "অভিভাবকের নাম", value: selectedStudent ? studentDetail?.father_name || "—" : "—" },
              { label: "ঠিকানা", value: selectedStudent ? studentAddress || "—" : "—" },
              { label: "মোবাইল", value: selectedStudent ? studentDetail?.guardian_phone || "—" : "—" },
            ].map((field) => (
              <div key={field.label} className="min-w-0 bg-white px-3 py-2.5 dark:bg-slate-900">
                <div className="text-xs font-medium text-gray-400 dark:text-slate-500">{field.label}</div>
                <div className="truncate text-base font-bold text-gray-800 dark:text-slate-100" title={String(field.value)}>
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <select
            value={invoiceStatusFilter}
            disabled={!selectedStudent}
            onChange={(event) => setInvoiceStatusFilter(event.target.value)}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-base outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[200px]"
          >
            <option value="">সব স্ট্যাটাস</option>
            {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status].label}
              </option>
            ))}
          </select>
        </div>

        {/* Summary stats — always visible, ৳০ until a student is picked */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3">
          <div className="rounded-xl bg-white p-3 text-center shadow-sm dark:bg-slate-900 sm:p-4">
            <div className="text-xs text-gray-500 dark:text-slate-400 sm:text-sm">মোট বকেয়া</div>
            <div className="mt-0.5 text-xl font-extrabold text-rose-600 dark:text-rose-400 sm:text-2xl">
              ৳{invoiceSummary.totalDue.toLocaleString("bn-BD")}
            </div>
          </div>
          <div className="rounded-xl bg-white p-3 text-center shadow-sm dark:bg-slate-900 sm:p-4">
            <div className="text-xs text-gray-500 dark:text-slate-400 sm:text-sm">সংগৃহীত</div>
            <div className="mt-0.5 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 sm:text-2xl">
              ৳{invoiceSummary.totalCollected.toLocaleString("bn-BD")}
            </div>
          </div>
        </div>

        {/* Fee ledger — the table frame (months, header) is always here;
            only the body reacts to loading / no-student / no-fee states.
            Each row starts locked: its month checkboxes stay disabled until
            the row's own header checkbox is ticked, so a month is only ever
            collected on a deliberate two-step action. "পরিমাণ" reflects only
            what's currently ticked (1 month × rate, 2 months × rate, ...). */}
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <h4 className="mb-2 text-center text-sm font-semibold text-gray-700 dark:text-slate-300">
            মাসিক ফি আদায় - অনাদায় ছক, সাল - {ledgerYear.toLocaleString("bn-BD")}
          </h4>
          <p className="mb-1.5 text-center text-[11px] text-gray-400 dark:text-slate-500 sm:hidden">
            ⟷ টেবিলটি পাশে স্ক্রল করে বাকি মাসগুলো দেখুন
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-300 dark:border-slate-700">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border border-gray-300 bg-gray-50 px-3 py-2.5 text-left text-sm font-bold text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    বিষয়সমূহ
                  </th>
                  {displayMonths.map((m) => (
                    <th
                      key={m}
                      className="border border-gray-300 bg-gray-50 px-1 py-2.5 text-center text-xs font-semibold text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:px-1.5"
                    >
                      <span className="sm:hidden">{monthShortLabel(m)}</span>
                      <span className="hidden sm:inline">{monthLabel(m).split(" ")[0]}</span>
                    </th>
                  ))}
                  <th className="border border-gray-300 bg-gray-50 px-3 py-2.5 text-center text-sm font-bold text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    পরিমাণ
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoicesLoading ? (
                  <tr>
                    <td
                      colSpan={displayMonths.length + 2}
                      className="border border-gray-300 px-2.5 py-8 text-center text-gray-400 dark:border-slate-700 dark:text-slate-500"
                    >
                      লোড হচ্ছে...
                    </td>
                  </tr>
                ) : !selectedStudent ? (
                  <tr>
                    <td
                      colSpan={displayMonths.length + 2}
                      className="border border-gray-300 px-2.5 py-8 text-center text-gray-400 dark:border-slate-700 dark:text-slate-500"
                    >
                      ফি দেখতে ও নিতে উপরের সার্চ বারে একজন ছাত্র খুঁজে নির্বাচন করুন
                    </td>
                  </tr>
                ) : monthlyGroups.length === 0 && otherInvoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={displayMonths.length + 2}
                      className="border border-gray-300 px-2.5 py-8 text-center text-gray-400 dark:border-slate-700 dark:text-slate-500"
                    >
                      এই ছাত্রের কোনো ফি নেই
                    </td>
                  </tr>
                ) : (
                  <>
                  {monthlyGroups.map((group) => {
                    const byMonth = new Map(group.items.map((inv) => [inv.month, inv]));
                    const rate = group.items[0]?.amount;
                    const rowUnpaidIds = group.items
                      .filter((inv) => inv.status !== "PAID" && inv.status !== "WAIVED")
                      .map((inv) => inv.id);
                    const unlocked = unlockedRows.has(group.title);
                    const rowCheckedItems = group.items.filter((inv) => checkedInvoiceIds.has(inv.id));
                    const rowActiveAmount = rowCheckedItems.reduce((sum, inv) => sum + effectiveAmount(inv), 0);
                    return (
                      <tr key={group.title} className="odd:bg-white even:bg-gray-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40">
                        <td className="sticky left-0 z-10 border border-gray-300 bg-inherit px-3 py-2 dark:border-slate-700">
                          <label className="flex items-start gap-2">
                            {rowUnpaidIds.length > 0 ? (
                              <input
                                type="checkbox"
                                checked={unlocked}
                                title="ফি নিতে এই ঘরে টিক দিয়ে মাসগুলো খুলুন"
                                onChange={() => {
                                  setUnlockedRows((prev) => {
                                    const next = new Set(prev);
                                    if (unlocked) next.delete(group.title);
                                    else next.add(group.title);
                                    return next;
                                  });
                                  if (unlocked) {
                                    setCheckedInvoiceIds((prev) => {
                                      const next = new Set(prev);
                                      rowUnpaidIds.forEach((id) => next.delete(id));
                                      return next;
                                    });
                                    setAmountOverrides((prev) => {
                                      const next = { ...prev };
                                      rowUnpaidIds.forEach((id) => delete next[id]);
                                      return next;
                                    });
                                    setEditingAmountId((prev) => (prev !== null && rowUnpaidIds.includes(prev) ? null : prev));
                                  }
                                }}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 dark:border-slate-600"
                              />
                            ) : (
                              <CircleCheck size={15} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                            )}
                            <span className="flex flex-col leading-tight">
                              <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">{group.title}</span>
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                ৳{Number(rate || 0).toLocaleString("bn-BD")}
                              </span>
                            </span>
                          </label>
                        </td>
                        {displayMonths.map((m) => {
                          const invoice = byMonth.get(m);
                          if (!invoice) {
                            return (
                              <td
                                key={m}
                                className="border border-gray-300 px-1.5 py-2 text-center text-gray-300 dark:border-slate-700 dark:text-slate-700"
                              >
                                —
                              </td>
                            );
                          }
                          const canAct = invoice.status !== "PAID" && invoice.status !== "WAIVED";
                          const checked = checkedInvoiceIds.has(invoice.id);
                          return (
                            <td
                              key={m}
                              className={`border border-gray-300 px-1.5 py-2 text-center dark:border-slate-700 ${
                                checked ? "bg-blue-50 dark:bg-blue-950/40" : ""
                              }`}
                            >
                              {invoice.status === "PAID" ? (
                                <button
                                  type="button"
                                  title="প্রিন্ট"
                                  onClick={() => setPrintTarget(invoice)}
                                  className="inline-flex"
                                >
                                  <CircleCheck size={17} className="text-green-600 dark:text-green-400" />
                                </button>
                              ) : invoice.status === "WAIVED" ? (
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">মওকুফ</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!canAct || !unlocked}
                                  onChange={() => toggleCheckedInvoice(invoice.id)}
                                  className="h-4 w-4 rounded border-gray-300 disabled:opacity-30 dark:border-slate-600"
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="border border-gray-300 px-2 py-2 text-center text-sm font-bold dark:border-slate-700">
                          {rowCheckedItems.length === 1 && editingAmountId === rowCheckedItems[0].id ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                autoFocus
                                value={amountDraft}
                                max={remainingDue(rowCheckedItems[0])}
                                min={0}
                                onChange={(e) => setAmountDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") confirmEditAmount(rowCheckedItems[0]);
                                  if (e.key === "Escape") cancelEditAmount();
                                }}
                                className="h-7 w-16 rounded border border-blue-400 px-1 text-center text-sm font-bold text-gray-800 outline-none dark:border-blue-500 dark:bg-slate-800 dark:text-slate-100"
                              />
                              <button
                                type="button"
                                title="সংরক্ষণ করুন"
                                onClick={() => confirmEditAmount(rowCheckedItems[0])}
                                className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                title="বাতিল"
                                onClick={cancelEditAmount}
                                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-800"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : rowCheckedItems.length === 1 ? (
                            <button
                              type="button"
                              onClick={() => startEditAmount(rowCheckedItems[0])}
                              title="আংশিক পরিমাণ দিতে ক্লিক করুন"
                              className="inline-flex items-center gap-1"
                            >
                              <span className={rowActiveAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-slate-600"}>
                                ৳{rowActiveAmount.toLocaleString("bn-BD")}
                              </span>
                              <Pencil size={11} className="text-gray-400 dark:text-slate-500" />
                            </button>
                          ) : (
                            <span className={rowActiveAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-slate-600"}>
                              ৳{rowActiveAmount.toLocaleString("bn-BD")}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* One-time / yearly fees (ভর্তি ফি, পরীক্ষার ফি, ...) — no
                      month breakdown, so every month cell is a dash and the
                      row's own checkbox selects the whole invoice. Kept in
                      this same table so "সর্বমোট" below covers every fee,
                      not just the monthly ones. */}
                  {otherInvoices.map((invoice) => {
                    const canAct = invoice.status !== "PAID" && invoice.status !== "WAIVED";
                    const checked = checkedInvoiceIds.has(invoice.id);
                    const remaining = remainingDue(invoice);
                    return (
                      <tr
                        key={`other-${invoice.id}`}
                        className="odd:bg-white even:bg-gray-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40"
                      >
                        <td className="sticky left-0 z-10 border border-gray-300 bg-inherit px-3 py-2 dark:border-slate-700">
                          <label className="flex items-start gap-2">
                            {invoice.status === "PAID" ? (
                              <button
                                type="button"
                                title="প্রিন্ট"
                                onClick={() => setPrintTarget(invoice)}
                                className="mt-0.5 inline-flex shrink-0"
                              >
                                <CircleCheck size={15} className="text-green-600 dark:text-green-400" />
                              </button>
                            ) : invoice.status === "WAIVED" ? (
                              <span className="mt-0.5 shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400">মওকুফ</span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!canAct}
                                onChange={() => toggleCheckedInvoice(invoice.id)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 disabled:opacity-40 dark:border-slate-600"
                              />
                            )}
                            <span className="flex flex-col leading-tight">
                              <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">{invoice.title}</span>
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                ৳{Number(invoice.amount || 0).toLocaleString("bn-BD")}
                              </span>
                            </span>
                          </label>
                        </td>
                        {displayMonths.map((m) => (
                          <td
                            key={m}
                            className="border border-gray-300 px-1.5 py-2 text-center text-gray-300 dark:border-slate-700 dark:text-slate-700"
                          >
                            —
                          </td>
                        ))}
                        <td className="border border-gray-300 px-2 py-2 text-center text-sm font-bold dark:border-slate-700">
                          {checked && editingAmountId === invoice.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                autoFocus
                                value={amountDraft}
                                max={remaining}
                                min={0}
                                onChange={(e) => setAmountDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") confirmEditAmount(invoice);
                                  if (e.key === "Escape") cancelEditAmount();
                                }}
                                className="h-7 w-16 rounded border border-blue-400 px-1 text-center text-sm font-bold text-gray-800 outline-none dark:border-blue-500 dark:bg-slate-800 dark:text-slate-100"
                              />
                              <button
                                type="button"
                                title="সংরক্ষণ করুন"
                                onClick={() => confirmEditAmount(invoice)}
                                className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                title="বাতিল"
                                onClick={cancelEditAmount}
                                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-800"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : checked ? (
                            <button
                              type="button"
                              onClick={() => startEditAmount(invoice)}
                              title="আংশিক পরিমাণ দিতে ক্লিক করুন"
                              className="inline-flex items-center gap-1"
                            >
                              <span className="text-emerald-600 dark:text-emerald-400">৳{effectiveAmount(invoice).toLocaleString("bn-BD")}</span>
                              <Pencil size={11} className="text-gray-400 dark:text-slate-500" />
                            </button>
                          ) : (
                            <span className="text-gray-300 dark:text-slate-600">৳০</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  </>
                )}
              </tbody>
              {(monthlyGroups.length > 0 || otherInvoices.length > 0) && (
                <tfoot>
                  <tr className="bg-blue-50 dark:bg-blue-950/30">
                    <td
                      colSpan={displayMonths.length + 1}
                      className="border border-gray-300 px-3 py-2.5 text-right text-sm font-bold text-gray-800 dark:border-slate-700 dark:text-slate-100"
                    >
                      সর্বমোট
                    </td>
                    <td className="border border-gray-300 px-3 py-2.5 text-center text-base font-extrabold text-blue-700 dark:border-slate-700 dark:text-blue-400">
                      ৳{checkedTotal.toLocaleString("bn-BD")}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Sticky collect bar — appears once at least one fee is checked, stays
          on screen while scrolling the list so the office can tick several
          months and collect them together without hunting for the button. */}
      {checkedInvoices.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-3 py-2.5 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-gray-600 dark:text-slate-400">
              {checkedInvoices.length}টি নির্বাচিত ·{" "}
              <span className="font-semibold text-gray-800 dark:text-slate-100">৳{checkedTotal.toLocaleString("bn-BD")}</span>
            </span>
            <button
              type="button"
              onClick={() => openPayModal(checkedInvoices, selectedStudent?.name_bn || "")}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
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
            <div className="flex flex-col gap-2.5 rounded-lg bg-gray-50 p-2.5 dark:bg-slate-800">
              {payTarget.map((invoice) => {
                const remaining = remainingDue(invoice);
                const line = payLines[invoice.id];
                if (!line) return null;
                const isPartial = line.selected && Number(line.amount) > 0 && Number(line.amount) < remaining;
                return (
                  <div
                    key={invoice.id}
                    className="flex flex-col gap-1.5 border-b border-gray-200 pb-2.5 text-sm last:border-0 last:pb-0 dark:border-slate-700 sm:flex-row sm:items-center sm:gap-2 sm:border-0 sm:pb-0"
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={line.selected}
                        onChange={() => togglePayLine(invoice.id)}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 dark:border-slate-600"
                      />
                      <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-slate-300">
                        {invoice.title} <span className="text-gray-400 dark:text-slate-500">(বাকি ৳{remaining})</span>
                      </span>
                    </label>
                    <div className="flex shrink-0 items-center gap-1.5 pl-6 sm:pl-0">
                      <input
                        type="number"
                        value={line.amount}
                        disabled={!line.selected}
                        max={remaining}
                        min={0}
                        onChange={(e) => setPayLineAmount(invoice.id, e.target.value)}
                        className="h-9 w-full flex-1 rounded-md border border-gray-300 px-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800/60 sm:w-24 sm:flex-none"
                      />
                      {isPartial && (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          আংশিক
                        </span>
                      )}
                    </div>
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
                max={remainingDue(payTarget[0])}
                min={0}
                onChange={(e) => setPayLineAmount(payTarget[0].id, e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-base outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                বাকি আছে: ৳{remainingDue(payTarget[0])} — সম্পূর্ণ না দিয়ে কম অঙ্ক লিখলে আংশিক পরিশোধ হিসেবে রেকর্ড হবে
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পদ্ধতি</label>
              <select
                value={payCommon.method}
                onChange={(e) => setPayCommon((p) => ({ ...p, method: e.target.value as PaymentMethod }))}
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-base outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-base outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setPayTarget(null)}
            className="h-10 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={paying || selectedPayTotal <= 0}
            onClick={handlePay}
            className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {paying ? "সংরক্ষণ হচ্ছে..." : `৳${selectedPayTotal.toLocaleString("bn-BD")} পেমেন্ট নিশ্চিত করুন`}
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
