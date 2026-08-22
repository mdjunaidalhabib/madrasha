import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { admissionApi } from "../../services/phase1Api";
import { invoiceApi, type InvoiceStatus } from "../../services/phase2Api";
import Modal from "../../components/ui/Modal";
import { useToastStore } from "../../store/toastStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { logger } from "../../utils/logger";
import { SkeletonTable } from "../../components/ui/Skeleton";
import AdmissionFormPrintButton from "../../components/admission/AdmissionFormPrintButton";
import { normalizeBanglaDigits } from "../../utils/reportUtils";

type FeeStatus = "NONE" | "DUE" | "WAIVED" | "PAID";

type AdmissionInvoiceRow = {
  id: number;
  title: string;
  amount: number;
  paidAmount: number;
  waivedAmount: number;
  waiveReason: string | null;
  status: InvoiceStatus;
};

const FEE_BADGE: Partial<Record<FeeStatus, { label: (due: number) => string; className: string }>> = {
  DUE: { label: (due) => `বকেয়া ৳${due}`, className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  WAIVED: { label: () => "মওকুফকৃত", className: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
  PAID: { label: () => "পরিশোধিত", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
};

const normalizeInvoiceArray = (payload: any): AdmissionInvoiceRow[] => {
  const data = payload?.data?.data || payload?.data || [];
  const list = Array.isArray(data) ? data : [];
  return list.map((inv: any) => ({
    id: inv.id,
    title: inv.title,
    amount: Number(inv.amount),
    paidAmount: Number(inv.paidAmount),
    waivedAmount: Number(inv.waivedAmount),
    waiveReason: inv.waiveReason ?? null,
    status: inv.status,
  }));
};

type PendingStudent = {
  id: number | string;
  name_bn?: string;
  arabic_name?: string | null;
  nid?: string | null;
  registration_no?: number | string | null;
  roll?: number | string | null;
  gender?: number | null;
  dob?: string | null;
  blood_group?: string | null;
  residency_type?: number | null;
  is_orphan?: number | null;
  guardian_phone?: string | null;
  guardian_phone_2?: string | null;
  father_name?: string | null;
  father_nid?: string | null;
  father_occupation?: string | null;
  mother_name?: string | null;
  mother_nid?: string | null;
  mother_occupation?: string | null;
  alt_guardian_name?: string | null;
  alt_guardian_relation?: string | null;
  alt_guardian_address?: string | null;
  alt_guardian_phone?: string | null;
  previous_institution?: string | null;
  previous_result?: string | null;
  division?: string | null;
  district?: string | null;
  thana?: string | null;
  village?: string | null;
  image?: string | null;
  current_class?: string | null;
  admission_status?: string;
  admission_type?: "NEW" | "RE_ADMISSION";
  fee_due?: number;
  fee_status?: FeeStatus;
};

const residencyLabel = (value?: number | null) =>
  value === 1 ? "আবাসিক" : value === 2 ? "অনাবাসিক" : "নেই";

const admissionTypeLabel = (value?: string) => (value === "RE_ADMISSION" ? "পুনঃভর্তি" : "নতুন");

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const PendingAdmissionsPage = () => {
  const navigate = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const [rows, setRows] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // per-row "processing" state so only the clicked row's buttons spin
  const [busyId, setBusyId] = useState<string | number | null>(null);

  // reject modal
  const [rejectTarget, setRejectTarget] = useState<PendingStudent | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // detail modal
  const [detailTarget, setDetailTarget] = useState<PendingStudent | null>(null);

  // detail modal — ভর্তি ফি section: this student's invoices, lazy-loaded
  // whenever the modal opens, plus whichever line's মওকুফ mini-form is
  // currently expanded. Muhtamim can only waive here, never collect payment
  // - fee collection is হিসাব বিভাগ's job, and only once this admission is
  // approved (see approveAdmission on the backend + findPendingInvoices,
  // which only surfaces APPROVED students' due admission fees).
  const [detailInvoices, setDetailInvoices] = useState<AdmissionInvoiceRow[]>([]);
  const [detailInvoicesLoading, setDetailInvoicesLoading] = useState(false);
  const [activeFeeAction, setActiveFeeAction] = useState<{ invoiceId: number } | null>(null);
  const [feeActionAmount, setFeeActionAmount] = useState("");
  const [feeActionReason, setFeeActionReason] = useState("");
  const [feeActionBusy, setFeeActionBusy] = useState(false);

  const loadPending = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await admissionApi.listPending();
      setRows(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD PENDING ADMISSIONS ERROR:", err);
      setRows([]);
      setError("পেন্ডিং ভর্তির তালিকা লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const loadDetailInvoices = useCallback(async (studentId: string | number) => {
    try {
      setDetailInvoicesLoading(true);
      const res = await invoiceApi.list({ student_id: Number(studentId) });
      setDetailInvoices(normalizeInvoiceArray(res));
    } catch (err) {
      logger.error("LOAD ADMISSION INVOICES ERROR:", err);
      setDetailInvoices([]);
    } finally {
      setDetailInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detailTarget) {
      setDetailInvoices([]);
      setActiveFeeAction(null);
      return;
    }
    loadDetailInvoices(detailTarget.id);
  }, [detailTarget, loadDetailInvoices]);

  const openFeeAction = (invoice: AdmissionInvoiceRow) => {
    setActiveFeeAction({ invoiceId: invoice.id });
    // First-time waiver starts blank (Muhtamim must consciously enter an
    // amount rather than accepting a pre-filled "waive it all" default);
    // re-opening an already-waived invoice pre-fills the current values so
    // it reads as editing that waiver, not starting a new one.
    setFeeActionAmount(invoice.waivedAmount > 0 ? String(invoice.waivedAmount) : "");
    setFeeActionReason(invoice.waiveReason || "");
  };

  const handleConfirmFeeAction = async () => {
    if (!activeFeeAction) return;
    const amount = Number(feeActionAmount);
    if (!amount || amount <= 0) {
      useToastStore.getState().show("সঠিক পরিমাণ দিন", "error");
      return;
    }
    if (!feeActionReason.trim()) {
      useToastStore.getState().show("মওকুফের কারণ লিখুন", "error");
      return;
    }

    try {
      setFeeActionBusy(true);
      // "set" (not the default additive "add") - this form always shows/edits
      // the invoice's *total* waived amount, so re-submitting must replace
      // it, not stack on top.
      await invoiceApi.waive(activeFeeAction.invoiceId, {
        amount,
        reason: feeActionReason.trim(),
        mode: "set",
      });
      useToastStore.getState().show("মওকুফ করা হয়েছে", "success");
      setActiveFeeAction(null);
      if (detailTarget) await loadDetailInvoices(detailTarget.id);
      await loadPending();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setFeeActionBusy(false);
    }
  };

  const handleApprove = async (student: PendingStudent) => {
    try {
      setBusyId(student.id);
      await admissionApi.approve(Number(student.id));
      useToastStore.getState().show("ভর্তি অনুমোদন করা হয়েছে", "success");
      setRows((prev) => prev.filter((row) => row.id !== student.id));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "অনুমোদন করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setBusyId(null);
    }
  };

  const openRejectModal = (student: PendingStudent) => {
    setRejectTarget(student);
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      useToastStore.getState().show("বাতিলের কারণ লিখুন", "error");
      return;
    }

    try {
      setBusyId(rejectTarget.id);
      await admissionApi.reject(Number(rejectTarget.id), rejectReason.trim());
      useToastStore.getState().show("ভর্তি বাতিল করা হয়েছে", "success");
      setRows((prev) => prev.filter((row) => row.id !== rejectTarget.id));
      setRejectTarget(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "বাতিল করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
              পেন্ডিং ভর্তি অনুমোদন
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              পর্যালোচনার অপেক্ষায় আছে: {rows.length} জন
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`${adminBase}/students/list`)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 md:w-auto"
          >
            ছাত্র তালিকায় ফিরে যান
          </button>
        </div>

        {/* Content */}
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loading ? (
            <SkeletonTable rows={6} columns={6} />
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              অনুমোদনের অপেক্ষায় কোনো ভর্তি নেই
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="flex flex-col gap-3 sm:hidden">
                {rows.map((student) => (
                  <div
                    key={student.id}
                    className="rounded-lg border border-gray-200 p-3 shadow-sm dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800 dark:text-slate-100">
                        {student.name_bn || "নাম নেই"}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        রোল: {student.roll ?? "নেই"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      পিতা: {student.father_name || "নেই"} | ফোন:{" "}
                      {student.guardian_phone || "নেই"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      শ্রেণি: {student.current_class || "নেই"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                        {admissionTypeLabel(student.admission_type)}
                      </span>
                      {student.is_orphan === 1 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                          এতিম
                        </span>
                      )}
                      {student.residency_type ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                          {residencyLabel(student.residency_type)}
                        </span>
                      ) : null}
                      {student.blood_group && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                          {student.blood_group}
                        </span>
                      )}
                      {student.fee_status && FEE_BADGE[student.fee_status] && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${FEE_BADGE[student.fee_status]!.className}`}
                        >
                          {FEE_BADGE[student.fee_status]!.label(student.fee_due ?? 0)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailTarget(student)}
                        className="h-9 flex-1 rounded-md border border-gray-300 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        বিস্তারিত
                      </button>
                      <button
                        type="button"
                        disabled={busyId === student.id}
                        onClick={() => handleApprove(student)}
                        className="h-9 flex-1 rounded-md bg-green-600 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        অনুমোদন
                      </button>
                      <button
                        type="button"
                        disabled={busyId === student.id}
                        onClick={() => openRejectModal(student)}
                        className="h-9 flex-1 rounded-md bg-red-600 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        বাতিল
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-3 py-2">নাম</th>
                      <th className="px-3 py-2">রোল</th>
                      <th className="px-3 py-2">পিতার নাম</th>
                      <th className="px-3 py-2">ফোন</th>
                      <th className="px-3 py-2">শ্রেণি</th>
                      <th className="px-3 py-2">ভর্তির ধরন</th>
                      <th className="px-3 py-2">বিশেষ</th>
                      <th className="px-3 py-2 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-medium text-gray-800 dark:text-slate-200">
                          {student.name_bn || "নাম নেই"}
                        </td>
                        <td className="px-3 py-2">{student.roll ?? "নেই"}</td>
                        <td className="px-3 py-2">{student.father_name || "নেই"}</td>
                        <td className="px-3 py-2">{student.guardian_phone || "নেই"}</td>
                        <td className="px-3 py-2">{student.current_class || "নেই"}</td>
                        <td className="px-3 py-2">{admissionTypeLabel(student.admission_type)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {student.is_orphan === 1 && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                                এতিম
                              </span>
                            )}
                            {student.blood_group && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                                {student.blood_group}
                              </span>
                            )}
                            {student.fee_status && FEE_BADGE[student.fee_status] && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${FEE_BADGE[student.fee_status]!.className}`}
                              >
                                {FEE_BADGE[student.fee_status]!.label(student.fee_due ?? 0)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailTarget(student)}
                              className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              বিস্তারিত
                            </button>
                            <button
                              type="button"
                              disabled={busyId === student.id}
                              onClick={() => handleApprove(student)}
                              className="h-8 rounded-md bg-green-600 px-3 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                            >
                              অনুমোদন
                            </button>
                            <button
                              type="button"
                              disabled={busyId === student.id}
                              onClick={() => openRejectModal(student)}
                              className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              বাতিল
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reject reason modal */}
      <Modal
        open={!!rejectTarget}
        title={`ভর্তি বাতিলের কারণ${rejectTarget ? ` — ${rejectTarget.name_bn || ""}` : ""}`}
        onClose={() => setRejectTarget(null)}
      >
        <textarea
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          rows={4}
          placeholder="বাতিলের কারণ লিখুন..."
          className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRejectTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল করুন
          </button>
          <button
            type="button"
            disabled={busyId === rejectTarget?.id}
            onClick={handleReject}
            className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            নিশ্চিত করুন
          </button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detailTarget}
        title={`ভর্তি আবেদনের বিস্তারিত${detailTarget ? ` — ${detailTarget.name_bn || ""}` : ""}`}
        onClose={() => setDetailTarget(null)}
        maxWidthClassName="max-w-2xl"
      >
        {detailTarget && (
          <div className="space-y-4 text-sm">
            {detailTarget.image && (
              <img
                src={detailTarget.image}
                alt={detailTarget.name_bn || ""}
                className="h-24 w-24 rounded-lg object-cover border border-gray-200 dark:border-slate-700"
              />
            )}

            <DetailSection title="শিক্ষার্থীর তথ্য">
              <DetailRow label="নাম" value={detailTarget.name_bn} />
              <DetailRow label="আরবি নাম" value={detailTarget.arabic_name} />
              <DetailRow label="NID/জন্ম নিবন্ধন" value={detailTarget.nid} />
              <DetailRow
                label="লিঙ্গ"
                value={detailTarget.gender === 1 ? "ছেলে" : detailTarget.gender === 2 ? "মেয়ে" : null}
              />
              <DetailRow label="জন্ম তারিখ" value={detailTarget.dob ? String(detailTarget.dob).slice(0, 10) : null} />
              <DetailRow label="রক্তের গ্রুপ" value={detailTarget.blood_group} />
              <DetailRow label="আবাসিক/অনাবাসিক" value={residencyLabel(detailTarget.residency_type)} />
              <DetailRow label="এতিম" value={detailTarget.is_orphan === 1 ? "হ্যাঁ" : "না"} />
              <DetailRow label="ভর্তির ধরন" value={admissionTypeLabel(detailTarget.admission_type)} />
              <DetailRow label="পূর্ববর্তী প্রতিষ্ঠান" value={detailTarget.previous_institution} />
              <DetailRow label="পূর্বের ফলাফল" value={detailTarget.previous_result} />
            </DetailSection>

            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">ভর্তি ফি</h4>
              {detailInvoicesLoading ? (
                <div className="text-xs text-gray-400 dark:text-slate-500">লোড হচ্ছে...</div>
              ) : detailInvoices.length === 0 ? (
                <div className="text-xs text-gray-400 dark:text-slate-500">এই ছাত্রের জন্য কোনো ফি বিল হয়নি</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {detailInvoices.map((inv) => {
                    const remaining = inv.amount - inv.paidAmount - inv.waivedAmount;
                    // Fully paid has nothing left to waive; a WAIVED invoice
                    // stays actionable so an already-recorded waiver can
                    // still be edited (see openFeeAction).
                    const canAct = inv.status !== "PAID";
                    const isActionOpen = activeFeeAction?.invoiceId === inv.id;
                    return (
                      <div key={inv.id} className="rounded-lg border border-gray-100 p-2 dark:border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-gray-700 dark:text-slate-300">
                            {inv.title} <span className="text-gray-400 dark:text-slate-500">৳{inv.amount}</span>
                            {remaining > 0 && <span className="text-rose-600 dark:text-rose-400"> · বাকি ৳{remaining}</span>}
                            {inv.waivedAmount > 0 && (
                              <span className="text-purple-600 dark:text-purple-400"> · মওকুফ ৳{inv.waivedAmount}</span>
                            )}
                          </span>
                          {canAct && (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => openFeeAction(inv)}
                                className="h-7 rounded-md border border-purple-200 px-2.5 text-xs font-medium text-purple-700 transition hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-400 dark:hover:bg-purple-950/40"
                              >
                                {inv.waivedAmount > 0 ? "মওকুফ এডিট করুন" : "মওকুফ করুন"}
                              </button>
                            </div>
                          )}
                        </div>

                        {isActionOpen && (
                          <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-2 dark:border-slate-800">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-slate-400">পরিমাণ (৳)</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={feeActionAmount}
                                onChange={(e) => setFeeActionAmount(normalizeBanglaDigits(e.target.value))}
                                className="h-8 w-24 rounded-md border border-gray-300 px-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div className="min-w-[140px] flex-1">
                              <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-slate-400">কারণ</label>
                              <input
                                type="text"
                                value={feeActionReason}
                                onChange={(e) => setFeeActionReason(e.target.value)}
                                placeholder="যেমন: এতিম ছাত্র"
                                className="h-8 w-full rounded-md border border-gray-300 px-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={feeActionBusy}
                              onClick={handleConfirmFeeAction}
                              className="h-8 rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              নিশ্চিত করুন
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveFeeAction(null)}
                              className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              বাতিল
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DetailSection title="অভিভাবকের তথ্য">
              <DetailRow label="পিতার নাম" value={detailTarget.father_name} />
              <DetailRow label="পিতার NID" value={detailTarget.father_nid} />
              <DetailRow label="পিতার পেশা" value={detailTarget.father_occupation} />
              <DetailRow label="মাতার নাম" value={detailTarget.mother_name} />
              <DetailRow label="মাতার NID" value={detailTarget.mother_nid} />
              <DetailRow label="মাতার পেশা" value={detailTarget.mother_occupation} />
              <DetailRow label="মোবাইল নম্বর" value={detailTarget.guardian_phone} />
              <DetailRow label="বিকল্প মোবাইল নম্বর" value={detailTarget.guardian_phone_2} />
            </DetailSection>

            {detailTarget.alt_guardian_name && (
              <DetailSection title="বিকল্প অভিভাবক (পিতা-মাতা ছাড়া)">
                <DetailRow label="নাম" value={detailTarget.alt_guardian_name} />
                <DetailRow label="সম্পর্ক" value={detailTarget.alt_guardian_relation} />
                <DetailRow label="মোবাইল নম্বর" value={detailTarget.alt_guardian_phone} />
                <DetailRow label="ঠিকানা" value={detailTarget.alt_guardian_address} />
              </DetailSection>
            )}

            <DetailSection title="ঠিকানা">
              <DetailRow label="বিভাগ" value={detailTarget.division} />
              <DetailRow label="জেলা" value={detailTarget.district} />
              <DetailRow label="থানা/উপজেলা" value={detailTarget.thana} />
              <DetailRow label="গ্রাম" value={detailTarget.village} />
            </DetailSection>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4 dark:border-slate-700">
              <AdmissionFormPrintButton row={detailTarget} />
              <button
                type="button"
                onClick={() => navigate(`${adminBase}/students/${detailTarget.id}`)}
                className="h-9 rounded-md border border-blue-200 px-4 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-950/40"
              >
                তথ্য সম্পাদনা করুন
              </button>
              <button
                type="button"
                disabled={busyId === detailTarget.id}
                onClick={() => {
                  openRejectModal(detailTarget);
                  setDetailTarget(null);
                }}
                className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={busyId === detailTarget.id}
                onClick={() => {
                  handleApprove(detailTarget);
                  setDetailTarget(null);
                }}
                className="h-9 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                অনুমোদন
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const DetailSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">{title}</h4>
    <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">{children}</div>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <div className="flex justify-between gap-2 border-b border-gray-100 pb-1 dark:border-slate-800">
      <span className="text-gray-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-gray-800 dark:text-slate-200">{value}</span>
    </div>
  ) : null;

export default PendingAdmissionsPage;
