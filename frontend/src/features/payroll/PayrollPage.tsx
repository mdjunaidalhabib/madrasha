import { useCallback, useEffect, useState } from "react";
import { payrollApi, type PayrollStatus } from "../../services/phase2Api";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";

type PayrollRow = {
  id: number;
  teacherId: number;
  month: string;
  basicSalary: string | number;
  allowances: string | number;
  deductions: string | number;
  netAmount: string | number;
  status: PayrollStatus;
  teacher?: { nameBn?: string; designation?: string | null } | null;
};

const STATUS_LABELS: Record<PayrollStatus, { label: string; className: string }> = {
  PENDING: { label: "বকেয়া", className: "bg-amber-100 text-amber-700" },
  PAID: { label: "পরিশোধিত", className: "bg-green-100 text-green-700" },
};

const currentMonth = new Date().toISOString().slice(0, 7);

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const PayrollPage = () => {
  const [month, setMonth] = useState(currentMonth);
  const [statusFilter, setStatusFilter] = useState("");
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [payTarget, setPayTarget] = useState<PayrollRow | null>(null);
  const [paying, setPaying] = useState(false);

  const loadPayroll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await payrollApi.list({
        month: month || undefined,
        status: (statusFilter as PayrollStatus) || undefined,
      });
      setRows(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD PAYROLL ERROR:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [month, statusFilter]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  const handleGenerate = async () => {
    if (!month) {
      useToastStore.getState().show("মাস নির্বাচন করুন", "error");
      return;
    }
    try {
      setGenerating(true);
      const res = await payrollApi.generate({ month });
      const data = (res.data as any)?.data;
      useToastStore
        .getState()
        .show(
          `পেরোল তৈরি হয়েছে: ${data?.created ?? 0} জন শিক্ষকের (আগে থেকে ছিল: ${data?.skipped ?? 0} জন)`,
          "success",
        );
      loadPayroll();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "পেরোল তৈরি করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!payTarget) return;
    try {
      setPaying(true);
      await payrollApi.markPaid(payTarget.id);
      useToastStore.getState().show("বেতন পরিশোধিত হিসেবে চিহ্নিত হয়েছে", "success");
      setPayTarget(null);
      loadPayroll();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "পরিশোধ নিশ্চিত করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setPaying(false);
    }
  };

  const totals = rows.reduce(
    (acc, row) => {
      acc.net += Number(row.netAmount);
      if (row.status === "PAID") acc.paid += Number(row.netAmount);
      else acc.pending += Number(row.netAmount);
      return acc;
    },
    { net: 0, paid: 0, pending: 0 },
  );

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">শিক্ষক বেতন (পেরোল)</h1>
          <p className="mt-1 text-sm text-gray-500">
            মাস নির্বাচন করে সব সক্রিয় শিক্ষকের বেতন একসাথে জেনারেট করুন
          </p>
        </div>

        {/* Filters + generate */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[160px]"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[160px]"
            >
              <option value="">সব স্ট্যাটাস</option>
              <option value="PENDING">বকেয়া</option>
              <option value="PAID">পরিশোধিত</option>
            </select>

            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              {generating ? "তৈরি হচ্ছে..." : "এই মাসের পেরোল তৈরি করুন"}
            </button>
          </div>

          {rows.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
              <span>মোট: ৳{totals.net}</span>
              <span className="text-green-700">পরিশোধিত: ৳{totals.paid}</span>
              <span className="text-amber-700">বকেয়া: ৳{totals.pending}</span>
            </div>
          )}
        </div>

        {/* List */}
        <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
          {loading ? (
            <SkeletonList items={6} />
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              এই মাসে এখনো কোনো পেরোল তৈরি করা হয়নি
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <span className="font-semibold text-gray-800">
                      {row.teacher?.nameBn || `শিক্ষক #${row.teacherId}`}
                    </span>
                    {row.teacher?.designation && (
                      <span className="text-gray-500"> · {row.teacher.designation}</span>
                    )}{" "}
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${STATUS_LABELS[row.status].className}`}
                    >
                      {STATUS_LABELS[row.status].label}
                    </span>
                    <div className="mt-1 text-xs text-gray-500">
                      মূল বেতন: ৳{row.basicSalary} · ভাতা: ৳{row.allowances} · কর্তন: ৳
                      {row.deductions} · নীট:{" "}
                      <span className="font-medium text-gray-700">৳{row.netAmount}</span>
                    </div>
                  </div>

                  {row.status === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => setPayTarget(row)}
                      className="h-8 w-full rounded-md bg-green-600 px-4 text-xs font-medium text-white transition hover:bg-green-700 sm:w-auto"
                    >
                      পরিশোধ করুন
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!payTarget}
        title={`বেতন পরিশোধ নিশ্চিত করুন — ${payTarget?.teacher?.nameBn || ""}`}
        onClose={() => setPayTarget(null)}
      >
        <p className="text-sm text-gray-700">
          নীট বেতন <strong>৳{payTarget?.netAmount}</strong> পরিশোধিত হিসেবে চিহ্নিত হবে এবং
          অ্যাকাউন্টস লেজারে খরচ হিসেবে যুক্ত হবে। নিশ্চিত?
        </p>
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
            disabled={paying}
            onClick={handleMarkPaid}
            className="h-9 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {paying ? "সংরক্ষণ হচ্ছে..." : "হ্যাঁ, পরিশোধিত করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default PayrollPage;
