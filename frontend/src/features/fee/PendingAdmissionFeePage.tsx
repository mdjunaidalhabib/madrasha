import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  invoiceApi,
  paymentMethodSettingApi,
  type PaymentMethod,
  type PaymentMethodSetting,
} from "../../services/phase2Api";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { useAuthStore } from "../../store/authStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";
import { toBanglaDigits, normalizeBanglaDigits } from "../../utils/reportUtils";

// Backend caps a single page at 200 (see PendingInvoicesQueryDto handling in
// fee.service.ts) - fetched once here and then searched/paginated client
// side, same pattern as StudentListPage.
const FETCH_LIMIT = 200;
const PAGE_SIZES = [20, 50, 100];

type PendingFeeRow = {
  id: number;
  studentId: number;
  title: string;
  amount: string | number;
  paidAmount: string | number;
  waivedAmount: string | number;
  dueDate: string;
  student?: {
    nameBn?: string;
    roll?: number;
    registrationNo?: number | string | null;
    classRef?: { nameBn?: string } | null;
  } | null;
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const remainingDue = (inv: PendingFeeRow) =>
  Number(inv.amount) - Number(inv.paidAmount) - Number(inv.waivedAmount || 0);

const todayIso = () => new Date().toISOString().slice(0, 10);
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BKASH", "NAGAD", "BANK", "ONLINE"];

const PendingAdmissionFeePage = () => {
  const { madrasaSlug = "" } = useParams();
  const navigate = useNavigate();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const role = useAuthStore((s) => s.user?.role);
  const isMuhtamim = role === "MUHTAMIM" || role === "মুহতামিম";

  const [rows, setRows] = useState<PendingFeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [configuredMethods, setConfiguredMethods] = useState<PaymentMethodSetting[]>([]);

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [bulkMethod, setBulkMethod] = useState<PaymentMethod>("CASH");
  const [bulkMethodSettingId, setBulkMethodSettingId] = useState("");
  const [bulkTransactionRef, setBulkTransactionRef] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkDate, setBulkDate] = useState(todayIso());
  const [bulkPaying, setBulkPaying] = useState(false);

  const [payTarget, setPayTarget] = useState<PendingFeeRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [payMethodSettingId, setPayMethodSettingId] = useState("");
  const [payTransactionRef, setPayTransactionRef] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payDate, setPayDate] = useState(todayIso());
  const [paying, setPaying] = useState(false);

  const [waiveTarget, setWaiveTarget] = useState<PendingFeeRow | null>(null);
  const [waiveAmount, setWaiveAmount] = useState("");
  const [waiveReason, setWaiveReason] = useState("");
  const [waiving, setWaiving] = useState(false);

  const loadRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await invoiceApi.pending({ limit: FETCH_LIMIT });
      setRows(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD PENDING ADMISSION FEE ERROR:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // "সব ক্লিয়ার করুন" শুধু এই তালিকা থেকে সরিয়ে দেয় - আসল ভর্তি ফি ইনভয়েস
  // অপরিবর্তিত থাকে এবং পরে "ছাত্র ফি গ্রহণ" পেজ থেকে নেওয়া যাবে।
  const handleClearAll = () => {
    if (rows.length === 0) return;
    useConfirmStore.getState().show({
      title: "পুরো তালিকা ক্লিয়ার করবেন?",
      message:
        "এই তালিকার সবগুলো এখান থেকে সরে যাবে (সবার জন্য)। ভর্তি ফি বাতিল হবে না — পরে \"ছাত্র ফি গ্রহণ\" পেজ থেকে সেগুলো নেওয়া যাবে।",
      confirmText: "ক্লিয়ার করুন",
      danger: false,
      onConfirm: async () => {
        try {
          setClearing(true);
          await invoiceApi.clearPending();
          useToastStore.getState().show("তালিকা ক্লিয়ার করা হয়েছে", "success");
          setSelectedIds(new Set());
          await loadRows();
        } catch (err: any) {
          const msg = err?.response?.data?.message || "ক্লিয়ার করতে সমস্যা হয়েছে";
          useToastStore.getState().show(msg, "error");
        } finally {
          setClearing(false);
        }
      },
    });
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = (row.student?.nameBn || "").toLowerCase();
      const roll = String(row.student?.roll ?? "");
      const regNo = String(row.student?.registrationNo ?? "").toLowerCase();
      return name.includes(q) || roll.includes(q) || regNo.includes(q);
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, rows]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRows, currentPage, pageSize],
  );
  const rangeStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filteredRows.length);

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedIds.has(row.id));

  const toggleSelectAll = () => {
    setSelectedIds(allFilteredSelected ? new Set() : new Set(filteredRows.map((row) => row.id)));
  };
  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openBulkPayModal = () => {
    if (selectedIds.size === 0) return;
    setBulkMethod("CASH");
    setBulkMethodSettingId("");
    setBulkTransactionRef("");
    setBulkNote("");
    setBulkDate(todayIso());
    setBulkPayOpen(true);
  };

  const handleBulkPay = async () => {
    const targets = rows.filter((row) => selectedIds.has(row.id));
    if (targets.length === 0) return;
    try {
      setBulkPaying(true);
      const results = await Promise.allSettled(
        targets.map((row) =>
          invoiceApi.pay(row.id, {
            amount: remainingDue(row),
            method: bulkMethod,
            transaction_ref: bulkTransactionRef.trim() || undefined,
            payment_method_setting_id: bulkMethodSettingId ? Number(bulkMethodSettingId) : undefined,
            note: bulkNote.trim() || undefined,
            paid_at: bulkDate || undefined,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.length - failed;
      if (failed === 0) {
        useToastStore.getState().show(`${succeeded} জনের ভর্তি ফি একসাথে নেওয়া হয়েছে`, "success");
      } else {
        useToastStore
          .getState()
          .show(`${succeeded} জনের ফি নেওয়া হয়েছে, ${failed} জনের ব্যর্থ হয়েছে`, "error");
      }
      setBulkPayOpen(false);
      setSelectedIds(new Set());
      loadRows();
    } finally {
      setBulkPaying(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await paymentMethodSettingApi.list(true);
        setConfiguredMethods(normalizeArray(res));
      } catch (err) {
        logger.error("LOAD PAYMENT METHOD SETTINGS ERROR:", err);
      }
    })();
  }, []);

  const openPayModal = (row: PendingFeeRow) => {
    setPayTarget(row);
    setPayAmount(String(remainingDue(row)));
    setPayMethod("CASH");
    setPayMethodSettingId("");
    setPayTransactionRef("");
    setPayNote("");
    setPayDate(todayIso());
  };

  const handlePay = async () => {
    if (!payTarget) return;
    if (!payAmount || Number(payAmount) <= 0) {
      useToastStore.getState().show("পরিমাণ দিন", "error");
      return;
    }
    try {
      setPaying(true);
      await invoiceApi.pay(payTarget.id, {
        amount: Number(payAmount),
        method: payMethod,
        transaction_ref: payTransactionRef.trim() || undefined,
        payment_method_setting_id: payMethodSettingId ? Number(payMethodSettingId) : undefined,
        note: payNote.trim() || undefined,
        paid_at: payDate || undefined,
      });
      useToastStore.getState().show("পেমেন্ট রেকর্ড করা হয়েছে", "success");
      setPayTarget(null);
      loadRows();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "পেমেন্ট রেকর্ড করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setPaying(false);
    }
  };

  const openWaiveModal = (row: PendingFeeRow) => {
    setWaiveTarget(row);
    setWaiveAmount(String(remainingDue(row)));
    setWaiveReason("");
  };

  const handleWaive = async () => {
    if (!waiveTarget) return;
    if (!waiveAmount || Number(waiveAmount) <= 0) {
      useToastStore.getState().show("মওকুফের পরিমাণ দিন", "error");
      return;
    }
    if (!waiveReason.trim()) {
      useToastStore.getState().show("মওকুফের কারণ লিখুন", "error");
      return;
    }
    try {
      setWaiving(true);
      await invoiceApi.waive(waiveTarget.id, {
        amount: Number(waiveAmount),
        reason: waiveReason.trim(),
      });
      useToastStore.getState().show("ভর্তি ফি মওকুফ করা হয়েছে", "success");
      setWaiveTarget(null);
      loadRows();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মওকুফ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setWaiving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
              ভর্তি ফি পেন্ডিং
              {rows.length > 0 && (
                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[13px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                  {rows.length}
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              যেসব ছাত্র আবেদন করেছে কিন্তু এখনও ভর্তি ফি পরিশোধ করেনি
            </p>
          </div>

          {rows.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={clearing}
              className="h-9 shrink-0 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {clearing ? "ক্লিয়ার হচ্ছে..." : "সব ক্লিয়ার করুন"}
            </button>
          )}
        </div>

        {/* সার্চবার — নাম, রোল বা রেজিস্ট্রেশন নম্বর দিয়ে খোঁজা যায় */}
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম, রোল বা রেজিস্ট্রেশন নম্বর দিয়ে খুঁজুন..."
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
              {toBanglaDigits(selectedIds.size)} জন নির্বাচিত হয়েছে
            </p>
            <button
              type="button"
              onClick={openBulkPayModal}
              className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              নির্বাচিত সবার ফি একসাথে নিন
            </button>
          </div>
        )}

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loading ? (
            <SkeletonList items={5} />
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              কোনো ছাত্রের ভর্তি ফি পেন্ডিং নেই — সব ভর্তি ফি পরিশোধিত বা মওকুফকৃত
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              এই সার্চে কোনো ফলাফল পাওয়া যায়নি
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2 border-b border-gray-100 px-1 pb-2 dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                />
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400">সব নির্বাচন করুন</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {paginatedRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-lg border border-gray-100 px-3 py-2.5 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelectOne(row.id)}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 dark:border-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => navigate(`${adminBase}/students/${row.studentId}`)}
                        className="min-w-0 text-left"
                      >
                        <div className="truncate font-medium text-gray-800 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400">
                          {row.student?.nameBn || `ছাত্র #${row.studentId}`}
                          <span className="ml-1.5 font-normal text-gray-500 dark:text-slate-400">
                            (রোল {row.student?.roll ?? "-"}
                            {row.student?.classRef?.nameBn ? ` · ${row.student.classRef.nameBn}` : ""})
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                          {row.title} · নির্ধারিত তারিখ {row.dueDate?.slice(0, 10)}
                        </div>
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold text-rose-600 dark:text-rose-400">৳{remainingDue(row)}</span>
                      <button
                        type="button"
                        onClick={() => openPayModal(row)}
                        className="h-8 rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        ফি নিন
                      </button>
                      {isMuhtamim && (
                        <button
                          type="button"
                          onClick={() => openWaiveModal(row)}
                          className="h-8 rounded-md border border-purple-200 px-3 text-xs font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-900 dark:text-purple-400 dark:hover:bg-purple-950/40"
                        >
                          মওকুফ
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination — পাতাপ্রতি কয়জন দেখাবে বেছে নেওয়া যায় */}
              <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-slate-800 sm:flex-row">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 sm:text-sm">
                  <span>
                    দেখাচ্ছে {toBanglaDigits(rangeStart)}–{toBanglaDigits(rangeEnd)}, মোট{" "}
                    {toBanglaDigits(filteredRows.length)} জন
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        পাতায় {toBanglaDigits(size)} জন
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:text-sm"
                  >
                    আগের
                  </button>
                  <span className="text-xs text-gray-600 dark:text-slate-400 sm:text-sm">
                    পাতা {toBanglaDigits(currentPage)} / {toBanglaDigits(totalPages)}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:text-sm"
                  >
                    পরের
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pay modal */}
      <Modal
        open={!!payTarget}
        title={`ভর্তি ফি নিন — ${payTarget?.student?.nameBn || ""}`}
        onClose={() => setPayTarget(null)}
      >
        {payTarget && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পরিমাণ (৳)</label>
              <input
                type="text"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(normalizeBanglaDigits(e.target.value))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">বাকি আছে: ৳{remainingDue(payTarget)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পদ্ধতি</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
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
                  value={payDate}
                  max={todayIso()}
                  onChange={(e) => setPayDate(e.target.value)}
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
                  value={payMethodSettingId}
                  onChange={(e) => setPayMethodSettingId(e.target.value)}
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
                value={payTransactionRef}
                onChange={(e) => setPayTransactionRef(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">নোট (ঐচ্ছিক)</label>
              <textarea
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        )}
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
            disabled={paying}
            onClick={handlePay}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {paying ? "সংরক্ষণ হচ্ছে..." : "পেমেন্ট নিশ্চিত করুন"}
          </button>
        </div>
      </Modal>

      {/* Waive modal — Muhtamim only */}
      <Modal
        open={!!waiveTarget}
        title={`ভর্তি ফি মওকুফ করুন — ${waiveTarget?.student?.nameBn || ""}`}
        onClose={() => setWaiveTarget(null)}
      >
        {waiveTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">বাকি আছে: ৳{remainingDue(waiveTarget)}</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">মওকুফের পরিমাণ (৳)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={waiveAmount}
                  onChange={(e) => setWaiveAmount(normalizeBanglaDigits(e.target.value))}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setWaiveAmount(String(remainingDue(waiveTarget)))}
                  className="h-9 shrink-0 rounded-md border border-purple-200 px-3 text-xs font-medium text-purple-700 hover:bg-purple-50"
                >
                  সম্পূর্ণ মওকুফ করুন
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
            {waiving ? "সংরক্ষণ হচ্ছে..." : "মওকুফ নিশ্চিত করুন"}
          </button>
        </div>
      </Modal>

      {/* Bulk pay modal — একসাথে একাধিক ছাত্রের ভর্তি ফি (প্রতিটির বাকি
          পুরো টাকা) একই পদ্ধতি/তারিখ দিয়ে রেকর্ড করা হয় */}
      <Modal
        open={bulkPayOpen}
        title={`নির্বাচিত ${toBanglaDigits(selectedIds.size)} জনের ভর্তি ফি একসাথে নিন`}
        onClose={() => setBulkPayOpen(false)}
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            প্রতিটি নির্বাচিত ছাত্রের বাকি থাকা সম্পূর্ণ ভর্তি ফি একসাথে পরিশোধিত হিসেবে রেকর্ড হবে।
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পদ্ধতি</label>
              <select
                value={bulkMethod}
                onChange={(e) => setBulkMethod(e.target.value as PaymentMethod)}
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
                value={bulkDate}
                max={todayIso()}
                onChange={(e) => setBulkDate(e.target.value)}
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
                value={bulkMethodSettingId}
                onChange={(e) => setBulkMethodSettingId(e.target.value)}
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
              value={bulkTransactionRef}
              onChange={(e) => setBulkTransactionRef(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">নোট (ঐচ্ছিক)</label>
            <textarea
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setBulkPayOpen(false)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={bulkPaying}
            onClick={handleBulkPay}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {bulkPaying ? "সংরক্ষণ হচ্ছে..." : "সবার পেমেন্ট নিশ্চিত করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default PendingAdmissionFeePage;
