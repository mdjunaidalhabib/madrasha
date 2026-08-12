import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Receipt, Trash2, Search, Wallet, CircleCheck, X, HandCoins, Printer } from "lucide-react";
import { cachedGet } from "../../services/api";
import {
  feeStructureApi,
  invoiceApi,
  paymentMethodSettingApi,
  type FeeFrequency,
  type InvoiceStatus,
  type PaymentMethod,
  type PaymentMethodSetting,
} from "../../services/phase2Api";
import { useToastStore } from "../../store/toastStore";
import { useAuthStore } from "../../store/authStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";
import InvoicePrintModal from "./InvoicePrintModal";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string };

type FeeStructureRow = {
  id: number;
  name: string;
  amount: string | number;
  frequency: FeeFrequency;
  academicYear: string;
  isActive: boolean;
  classId?: number | null;
  class?: { nameBn?: string; division?: { nameBn?: string } | null } | null;
};

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

const FREQUENCY_LABELS: Record<FeeFrequency, string> = {
  ONE_TIME: "একবার",
  MONTHLY: "মাসিক",
  YEARLY: "বাৎসরিক",
};

const STATUS_LABELS: Record<InvoiceStatus, { label: string; className: string }> = {
  UNPAID: { label: "অপরিশোধিত", className: "bg-red-100 text-red-700" },
  PARTIALLY_PAID: { label: "আংশিক পরিশোধিত", className: "bg-amber-100 text-amber-700" },
  PAID: { label: "পরিশোধিত", className: "bg-green-100 text-green-700" },
  OVERDUE: { label: "মেয়াদোত্তীর্ণ", className: "bg-gray-200 text-gray-700" },
  WAIVED: { label: "মাফকৃত", className: "bg-purple-100 text-purple-700" },
};

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BKASH", "NAGAD", "BANK", "ONLINE"];

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyStructureForm = { name: "", amount: "", frequency: "MONTHLY" as FeeFrequency, academic_year: String(new Date().getFullYear()) };
const emptyGenerateForm = { due_date: "", month: "" };

const todayIso = () => new Date().toISOString().slice(0, 10);
const emptyPayCommon = {
  method: "CASH" as PaymentMethod,
  payment_method_setting_id: "",
  transaction_ref: "",
  note: "",
  paid_at: todayIso(),
};
type PayLine = { selected: boolean; amount: string };

const FeeManagementPage = () => {
  const [tab, setTab] = useState<"structures" | "invoices">("structures");

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [division, setDivision] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [classLoading, setClassLoading] = useState(false);

  const [structures, setStructures] = useState<FeeStructureRow[]>([]);
  const [structureForm, setStructureForm] = useState(emptyStructureForm);
  const [saving, setSaving] = useState(false);

  const [generateTarget, setGenerateTarget] = useState<FeeStructureRow | null>(null);
  const [generateForm, setGenerateForm] = useState(emptyGenerateForm);
  const [generating, setGenerating] = useState(false);

  const [editTarget, setEditTarget] = useState<FeeStructureRow | null>(null);
  const [editForm, setEditForm] = useState(emptyStructureForm);
  const [editSaving, setEditSaving] = useState(false);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoicesLoading, setInvoicesLoading] = useState(false);

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

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD DIVISIONS ERROR:", err);
      setDivisions([]);
    }
  }, []);

  useEffect(() => {
    loadDivisions();
  }, [loadDivisions]);

  const loadClasses = async (divisionId: string) => {
    setClassId("");
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      setClassLoading(true);
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("CLASS LOAD ERROR:", err);
      setClasses([]);
    } finally {
      setClassLoading(false);
    }
  };

  const loadStructures = useCallback(async () => {
    try {
      const res = await feeStructureApi.list(classId ? { class_id: Number(classId) } : undefined);
      setStructures(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD FEE STRUCTURES ERROR:", err);
      setStructures([]);
    }
  }, [classId]);

  const loadInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      const res = await invoiceApi.list({
        status: (invoiceStatusFilter as InvoiceStatus) || undefined,
      });
      setInvoices(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD INVOICES ERROR:", err);
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [invoiceStatusFilter]);

  useEffect(() => {
    loadStructures();
  }, [loadStructures]);

  useEffect(() => {
    if (tab === "invoices") loadInvoices();
  }, [tab, loadInvoices]);

  const handleCreateStructure = async () => {
    if (!structureForm.name.trim() || !structureForm.amount || !structureForm.academic_year) {
      useToastStore.getState().show("নাম, পরিমাণ ও শিক্ষাবর্ষ দিন", "error");
      return;
    }
    try {
      setSaving(true);
      await feeStructureApi.create({
        class_id: classId ? Number(classId) : undefined,
        name: structureForm.name.trim(),
        amount: Number(structureForm.amount),
        frequency: structureForm.frequency,
        academic_year: structureForm.academic_year,
      });
      useToastStore.getState().show("ফি কাঠামো তৈরি হয়েছে", "success");
      setStructureForm(emptyStructureForm);
      loadStructures();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "ফি কাঠামো তৈরি করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (structure: FeeStructureRow) => {
    setEditTarget(structure);
    setEditForm({
      name: structure.name,
      amount: String(structure.amount),
      frequency: structure.frequency,
      academic_year: structure.academicYear,
    });
  };

  const handleUpdateStructure = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim() || !editForm.amount || !editForm.academic_year) {
      useToastStore.getState().show("নাম, পরিমাণ ও শিক্ষাবর্ষ দিন", "error");
      return;
    }
    try {
      setEditSaving(true);
      await feeStructureApi.update(editTarget.id, {
        name: editForm.name.trim(),
        amount: Number(editForm.amount),
        frequency: editForm.frequency,
        academic_year: editForm.academic_year,
      });
      useToastStore.getState().show("ফি কাঠামো আপডেট হয়েছে", "success");
      setEditTarget(null);
      loadStructures();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "ফি কাঠামো আপডেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteStructure = async (id: number) => {
    try {
      await feeStructureApi.remove(id);
      useToastStore.getState().show("ফি কাঠামো মুছে ফেলা হয়েছে", "success");
      setStructures((prev) => prev.filter((row) => row.id !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  const openGenerateModal = (structure: FeeStructureRow) => {
    setGenerateTarget(structure);
    setGenerateForm(emptyGenerateForm);
  };

  const handleGenerate = async () => {
    if (!generateTarget || !generateForm.due_date) {
      useToastStore.getState().show("ডিউ তারিখ দিন", "error");
      return;
    }
    if (generateTarget.frequency === "MONTHLY" && !generateForm.month) {
      useToastStore.getState().show("মাসিক ফির জন্য মাস (YYYY-MM) দিন", "error");
      return;
    }

    try {
      setGenerating(true);
      const res = await invoiceApi.generate({
        fee_structure_id: generateTarget.id,
        due_date: generateForm.due_date,
        month: generateForm.month || undefined,
        class_id: classId ? Number(classId) : undefined,
      });
      const data = (res.data as any)?.data;
      useToastStore
        .getState()
        .show(
          `ইনভয়েস তৈরি হয়েছে: ${data?.created ?? 0} জনের (আগে থেকে বিল করা ছিল: ${data?.skipped ?? 0} জন)`,
          "success",
        );
      setGenerateTarget(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "ইনভয়েস তৈরি করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setGenerating(false);
    }
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

  // Grouped division → class so a long flat list (one row per fee, per
  // class, across every division) reads as sections instead — "সাধারণ" (no
  // class, applies to every class) always pinned first as its own section,
  // then each division's classes alphabetical inside that division.
  const groupedStructures = useMemo(() => {
    type ClassGroup = { key: string; label: string; items: FeeStructureRow[] };
    type DivisionGroup = { key: string; label: string; classGroups: ClassGroup[] };

    const genericItems = structures.filter((r) => !r.classId);
    const divisionMap = new Map<string, { label: string; classMap: Map<string, ClassGroup> }>();

    for (const row of structures) {
      if (!row.classId) continue;
      const divisionLabel = row.class?.division?.nameBn || "অন্যান্য";
      if (!divisionMap.has(divisionLabel)) {
        divisionMap.set(divisionLabel, { label: divisionLabel, classMap: new Map() });
      }
      const division = divisionMap.get(divisionLabel)!;
      const classKey = String(row.classId);
      const classLabel = row.class?.nameBn || `শ্রেণি #${row.classId}`;
      if (!division.classMap.has(classKey)) {
        division.classMap.set(classKey, { key: classKey, label: classLabel, items: [] });
      }
      division.classMap.get(classKey)!.items.push(row);
    }

    const divisionGroups: DivisionGroup[] = Array.from(divisionMap.entries())
      .map(([key, v]) => ({
        key,
        label: v.label,
        classGroups: Array.from(v.classMap.values()).sort((a, b) => a.label.localeCompare(b.label, "bn")),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "bn"));

    const result: DivisionGroup[] = [];
    if (genericItems.length) {
      result.push({
        key: "generic",
        label: "সাধারণ (সব শ্রেণির জন্য)",
        classGroups: [{ key: "generic-items", label: "সাধারণ", items: genericItems }],
      });
    }
    return [...result, ...divisionGroups];
  }, [structures]);

  // Client-side search over the already-loaded invoice page — matches
  // student name, roll number, or fee title so office staff can find a
  // student instantly instead of scanning a flat invoice list.
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const name = (inv.student?.nameBn || "").toLowerCase();
      const roll = String(inv.student?.roll ?? "");
      return name.includes(q) || roll.includes(q) || inv.title.toLowerCase().includes(q);
    });
  }, [invoices, invoiceSearch]);

  type StudentGroup = {
    studentId: number;
    label: string;
    roll: number | string;
    invoices: InvoiceRow[];
    totalDue: number;
  };

  // One card per student instead of one row per fee, with students owing
  // the most shown first — so collecting fees is "find the student, pay
  // everything they owe in one go" instead of hunting invoice-by-invoice.
  const studentGroups = useMemo(() => {
    const map = new Map<number, StudentGroup>();
    for (const inv of filteredInvoices) {
      if (!map.has(inv.studentId)) {
        map.set(inv.studentId, {
          studentId: inv.studentId,
          label: inv.student?.nameBn || `ছাত্র #${inv.studentId}`,
          roll: inv.student?.roll ?? "-",
          invoices: [],
          totalDue: 0,
        });
      }
      const group = map.get(inv.studentId)!;
      group.invoices.push(inv);
      if (inv.status !== "PAID" && inv.status !== "WAIVED") group.totalDue += remainingDue(inv);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalDue - a.totalDue || a.label.localeCompare(b.label, "bn"),
    );
  }, [filteredInvoices]);

  const invoiceSummary = useMemo(() => {
    let totalDue = 0;
    let totalCollected = 0;
    for (const inv of filteredInvoices) {
      totalCollected += Number(inv.paidAmount);
      if (inv.status !== "PAID" && inv.status !== "WAIVED") totalDue += remainingDue(inv);
    }
    return { totalDue, totalCollected, studentCount: studentGroups.length };
  }, [filteredInvoices, studentGroups]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">ছাত্র ফি ব্যবস্থাপনা</h1>
          <p className="mt-1 text-sm text-gray-500">
            ফি কাঠামো তৈরি করুন, ইনভয়েস জেনারেট করুন এবং পেমেন্ট রেকর্ড করুন
          </p>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("structures")}
            className={`h-9 rounded-md px-4 text-sm font-medium transition ${
              tab === "structures" ? "bg-blue-600 text-white" : "bg-white text-gray-600 shadow-sm"
            }`}
          >
            ফি কাঠামো
          </button>
          <button
            type="button"
            onClick={() => setTab("invoices")}
            className={`h-9 rounded-md px-4 text-sm font-medium transition ${
              tab === "invoices" ? "bg-blue-600 text-white" : "bg-white text-gray-600 shadow-sm"
            }`}
          >
            ইনভয়েস
          </button>
        </div>

        {/* Division/Class picker */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={division}
              onChange={(event) => {
                const value = event.target.value;
                setDivision(value);
                loadClasses(value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[160px]"
            >
              <option value="">বিভাগ (ফিল্টার)</option>
              {divisions.map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={!division || classLoading}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 sm:w-[180px]"
            >
              <option value="">{classLoading ? "লোড হচ্ছে..." : "শ্রেণি (ফিল্টার)"}</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {tab === "structures" ? (
          <>
            <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                নতুন ফি কাঠামো তৈরি করুন {classId ? "(নির্বাচিত শ্রেণির জন্য)" : "(সব শ্রেণির জন্য)"}
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <input
                  type="text"
                  placeholder="নাম (যেমন: মাসিক বেতন)"
                  value={structureForm.name}
                  onChange={(e) => setStructureForm((p) => ({ ...p, name: e.target.value }))}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[200px]"
                />
                <input
                  type="number"
                  placeholder="পরিমাণ (৳)"
                  value={structureForm.amount}
                  onChange={(e) => setStructureForm((p) => ({ ...p, amount: e.target.value }))}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[130px]"
                />
                <select
                  value={structureForm.frequency}
                  onChange={(e) =>
                    setStructureForm((p) => ({ ...p, frequency: e.target.value as FeeFrequency }))
                  }
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[130px]"
                >
                  {(Object.keys(FREQUENCY_LABELS) as FeeFrequency[]).map((f) => (
                    <option key={f} value={f}>
                      {FREQUENCY_LABELS[f]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="শিক্ষাবর্ষ"
                  value={structureForm.academic_year}
                  onChange={(e) => setStructureForm((p) => ({ ...p, academic_year: e.target.value }))}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[110px]"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCreateStructure}
                  className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                >
                  তৈরি করুন
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
              {structures.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">কোনো ফি কাঠামো নেই</div>
              ) : (
                <div className="space-y-5">
                  {groupedStructures.map((division) => (
                    <div key={division.key}>
                      {division.key !== "generic" && (
                        <h3 className="mb-2 text-sm font-bold text-gray-700">{division.label}</h3>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {division.classGroups.map((group) => (
                          <div key={group.key} className="rounded-xl border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <h4 className="truncate text-sm font-semibold text-gray-800">{group.label}</h4>
                              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                                {group.items.length}টি
                              </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {group.items.map((row) => (
                          <div
                            key={row.id}
                            className="flex items-center gap-1 rounded-lg border border-gray-100 px-2.5 py-2 text-sm transition hover:border-blue-200"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-gray-800">
                                {row.name} <span className="font-normal text-gray-500">৳{row.amount}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                                  {FREQUENCY_LABELS[row.frequency]}
                                </span>
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                                  {row.academicYear}
                                </span>
                                {!row.isActive && (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                    নিষ্ক্রিয়
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-0.5">
                              <button
                                type="button"
                                title="ইনভয়েস জেনারেট করুন"
                                onClick={() => openGenerateModal(row)}
                                className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                              >
                                <Receipt size={14} />
                              </button>
                              <button
                                type="button"
                                title="এডিট"
                                onClick={() => openEditModal(row)}
                                className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title="মুছুন"
                                onClick={() => handleDeleteStructure(row.id)}
                                className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Search + status filter */}
            <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <div className="relative w-full sm:w-[260px]">
                  <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="ছাত্রের নাম বা রোল দিয়ে খুঁজুন"
                    className="h-9 w-full rounded-md border border-gray-300 pl-8 pr-7 text-sm outline-none focus:border-blue-400"
                  />
                  {invoiceSearch && (
                    <button
                      type="button"
                      onClick={() => setInvoiceSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title="মুছুন"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <select
                  value={invoiceStatusFilter}
                  onChange={(event) => setInvoiceStatusFilter(event.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[180px]"
                >
                  <option value="">সব স্ট্যাটাস</option>
                  {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Summary stats */}
            {!invoicesLoading && invoices.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-xl bg-white p-3 text-center shadow-sm sm:p-4">
                  <div className="text-[11px] text-gray-500 sm:text-xs">মোট বকেয়া</div>
                  <div className="mt-0.5 text-base font-bold text-rose-600 sm:text-lg">
                    ৳{invoiceSummary.totalDue.toLocaleString("bn-BD")}
                  </div>
                </div>
                <div className="rounded-xl bg-white p-3 text-center shadow-sm sm:p-4">
                  <div className="text-[11px] text-gray-500 sm:text-xs">সংগৃহীত</div>
                  <div className="mt-0.5 text-base font-bold text-emerald-600 sm:text-lg">
                    ৳{invoiceSummary.totalCollected.toLocaleString("bn-BD")}
                  </div>
                </div>
                <div className="rounded-xl bg-white p-3 text-center shadow-sm sm:p-4">
                  <div className="text-[11px] text-gray-500 sm:text-xs">ছাত্র</div>
                  <div className="mt-0.5 text-base font-bold text-gray-800 sm:text-lg">
                    {invoiceSummary.studentCount.toLocaleString("bn-BD")}
                  </div>
                </div>
              </div>
            )}

            {/* Student-grouped invoice cards */}
            <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
              {invoicesLoading ? (
                <SkeletonList items={6} />
              ) : invoices.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">কোনো ইনভয়েস নেই</div>
              ) : studentGroups.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">কোনো ছাত্র পাওয়া যায়নি</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {studentGroups.map((group) => {
                    const unpaid = group.invoices.filter(
                      (inv) => inv.status !== "PAID" && inv.status !== "WAIVED",
                    );
                    return (
                      <div key={group.studentId} className="rounded-xl border border-gray-200 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm">
                            <span className="font-semibold text-gray-800">{group.label}</span>{" "}
                            <span className="text-gray-500">(রোল {group.roll})</span>
                          </div>
                          {group.totalDue > 0 ? (
                            <button
                              type="button"
                              onClick={() => openPayModal(unpaid, group.label)}
                              className="flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700"
                            >
                              <Wallet size={13} />
                              সব বকেয়া ফি নিন (৳{group.totalDue.toLocaleString("bn-BD")})
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-medium text-green-700">
                              <CircleCheck size={12} />
                              সব পরিশোধিত
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          {group.invoices.map((invoice) => {
                            const remaining = remainingDue(invoice);
                            const canAct = invoice.status !== "PAID" && invoice.status !== "WAIVED";
                            return (
                              <div
                                key={invoice.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-2.5 py-1.5 text-sm"
                              >
                                <div className="min-w-0">
                                  <span className="text-gray-800">{invoice.title}</span>{" "}
                                  <span className="text-gray-500">৳{invoice.amount}</span>{" "}
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_LABELS[invoice.status].className}`}
                                  >
                                    {STATUS_LABELS[invoice.status].label}
                                  </span>
                                  {remaining > 0 && (
                                    <span className="text-gray-500"> · বাকি ৳{remaining}</span>
                                  )}
                                  {Number(invoice.waivedAmount) > 0 && (
                                    <span className="text-purple-600"> · মাফ ৳{invoice.waivedAmount}</span>
                                  )}
                                </div>

                                <div className="flex shrink-0 gap-1.5">
                                  <button
                                    type="button"
                                    title="প্রিন্ট"
                                    onClick={() => setPrintTarget(invoice)}
                                    className="flex h-7 items-center rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                                  >
                                    <Printer size={13} />
                                  </button>
                                  {canAct && isMuhtamim && (
                                    <button
                                      type="button"
                                      onClick={() => openWaiveModal(invoice)}
                                      className="flex h-7 items-center gap-1 rounded-md border border-purple-200 px-2.5 text-xs font-medium text-purple-700 transition hover:bg-purple-50"
                                    >
                                      <HandCoins size={13} />
                                      মাফ করুন
                                    </button>
                                  )}
                                  {canAct && (
                                    <button
                                      type="button"
                                      onClick={() => openPayModal([invoice], group.label)}
                                      className="h-7 shrink-0 rounded-md border border-blue-200 px-2.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
                                    >
                                      শুধু এটি নিন
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit fee structure modal */}
      <Modal
        open={!!editTarget}
        title={`ফি কাঠামো এডিট করুন — ${editTarget?.name || ""}`}
        onClose={() => setEditTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">নাম</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">পরিমাণ (৳)</label>
            <input
              type="number"
              value={editForm.amount}
              onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">ফ্রিকোয়েন্সি</label>
            <select
              value={editForm.frequency}
              onChange={(e) => setEditForm((p) => ({ ...p, frequency: e.target.value as FeeFrequency }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            >
              {(Object.keys(FREQUENCY_LABELS) as FeeFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">শিক্ষাবর্ষ</label>
            <input
              type="text"
              value={editForm.academic_year}
              onChange={(e) => setEditForm((p) => ({ ...p, academic_year: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={editSaving}
            onClick={handleUpdateStructure}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {editSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </Modal>

      {/* Generate invoices modal */}
      <Modal
        open={!!generateTarget}
        title={`ইনভয়েস জেনারেট করুন — ${generateTarget?.name || ""}`}
        onClose={() => setGenerateTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">ডিউ তারিখ</label>
            <input
              type="date"
              value={generateForm.due_date}
              onChange={(e) => setGenerateForm((p) => ({ ...p, due_date: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>
          {generateTarget?.frequency === "MONTHLY" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                মাস (YYYY-MM)
              </label>
              <input
                type="month"
                value={generateForm.month}
                onChange={(e) => setGenerateForm((p) => ({ ...p, month: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
              />
            </div>
          )}
          {!classId && (
            <p className="text-xs text-amber-600">
              কোনো শ্রেণি ফিল্টার নির্বাচন করা নেই — ফি কাঠামোর সাথে যুক্ত শ্রেণির সব ছাত্রের জন্য
              ইনভয়েস তৈরি হবে।
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setGenerateTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerate}
            className="h-9 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {generating ? "তৈরি হচ্ছে..." : "জেনারেট করুন"}
          </button>
        </div>
      </Modal>

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
            <div className="flex flex-col gap-1.5 rounded-lg bg-gray-50 p-2.5">
              {payTarget.map((invoice) => {
                const remaining = Number(invoice.amount) - Number(invoice.paidAmount);
                const line = payLines[invoice.id];
                if (!line) return null;
                return (
                  <div key={invoice.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={() => togglePayLine(invoice.id)}
                      className="h-4 w-4 shrink-0 rounded border-gray-300"
                    />
                    <span className="min-w-0 flex-1 truncate text-gray-700">
                      {invoice.title} <span className="text-gray-400">(বাকি ৳{remaining})</span>
                    </span>
                    <input
                      type="number"
                      value={line.amount}
                      disabled={!line.selected}
                      onChange={(e) => setPayLineAmount(invoice.id, e.target.value)}
                      className="h-8 w-24 shrink-0 rounded-md border border-gray-300 px-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                );
              })}
              <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-1.5 text-sm font-semibold text-gray-800">
                <span>মোট নেওয়া হবে</span>
                <span>৳{selectedPayTotal.toLocaleString("bn-BD")}</span>
              </div>
            </div>
          )}

          {payTarget && payTarget.length === 1 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">পরিমাণ (৳)</label>
              <input
                type="number"
                value={payLines[payTarget[0].id]?.amount ?? ""}
                onChange={(e) => setPayLineAmount(payTarget[0].id, e.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                বাকি আছে: ৳{remainingDue(payTarget[0])}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">পদ্ধতি</label>
              <select
                value={payCommon.method}
                onChange={(e) => setPayCommon((p) => ({ ...p, method: e.target.value as PaymentMethod }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">তারিখ</label>
              <input
                type="date"
                value={payCommon.paid_at}
                max={todayIso()}
                onChange={(e) => setPayCommon((p) => ({ ...p, paid_at: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
              />
            </div>
          </div>

          {configuredMethods.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                কোন চ্যানেলে টাকা পাওয়া গেছে (ঐচ্ছিক)
              </label>
              <select
                value={payCommon.payment_method_setting_id}
                onChange={(e) =>
                  setPayCommon((p) => ({ ...p, payment_method_setting_id: e.target.value }))
                }
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
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
            <label className="mb-1 block text-xs font-medium text-gray-600">
              ট্রানজেকশন রেফারেন্স (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={payCommon.transaction_ref}
              onChange={(e) => setPayCommon((p) => ({ ...p, transaction_ref: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">নোট (ঐচ্ছিক)</label>
            <textarea
              value={payCommon.note}
              onChange={(e) => setPayCommon((p) => ({ ...p, note: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none"
              placeholder="যেমন: আংশিক পরিশোধ, বাকিটা পরের মাসে দেবে"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPayTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
            <p className="text-xs text-gray-500">
              বাকি আছে: ৳{remainingDue(waiveTarget)}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">মাফের পরিমাণ (৳)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={waiveAmount}
                  onChange={(e) => setWaiveAmount(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
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
              <label className="mb-1 block text-xs font-medium text-gray-600">কারণ</label>
              <textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none"
                placeholder="যেমন: এতিম ছাত্র, আর্থিক অসচ্ছলতা"
              />
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setWaiveTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
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

export default FeeManagementPage;
