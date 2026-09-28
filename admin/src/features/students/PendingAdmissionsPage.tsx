import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { studentPath } from "./studentRoute";
import { admissionApi } from "../../services/phase1Api";
import { studentFeeDiscountApi, type FeePreviewRow } from "../../services/phase2Api";
import { refreshSidebar } from "../../services/sidebarApi";
import { useSidebarStore } from "../../store/sidebarStore";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonTable, SkeletonText } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import AdmissionFormPrintButton from "../../components/admission/AdmissionFormPrintButton";
import { normalizeBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { useText, getText, commonText, useIsMadrasa } from "@madrasha/shared-ui/src/i18n";
import { admissionReviewText } from "./admissionReview.text";

type FeeStatus = "NONE" | "DUE" | "WAIVED" | "PAID";

const FEE_BADGE: Partial<Record<FeeStatus, { label: (due: number) => string; className: string }>> = {
  DUE: { label: (due) => getText(admissionReviewText).feeDue(String(due)), className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  WAIVED: { label: () => getText(admissionReviewText).feeWaived, className: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
  PAID: { label: () => getText(admissionReviewText).feePaid, className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
};


const normalizeFeePreviewArray = (payload: any): FeePreviewRow[] => {
  const data = payload?.data?.data || payload?.data || [];
  const list = Array.isArray(data) ? data : [];
  return list.map((row: any) => ({
    feeStructureId: row.feeStructureId,
    name: row.name,
    feeType: row.feeType,
    frequency: row.frequency,
    amount: Number(row.amount),
    waivedAmount: Number(row.waivedAmount),
    reason: row.reason ?? null,
    examLinked: Boolean(row.examLinked),
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

const residencyLabel = (value?: number | null) => {
  const t = getText(admissionReviewText);
  return value === 1 ? t.residential : value === 2 ? t.nonResidential : t.none;
};

// admission_type is a backend enum; only the label is translated.
const admissionTypeLabel = (value?: string) =>
  value === "RE_ADMISSION" ? getText(admissionReviewText).readmission : getText(admissionReviewText).newAdmission;

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const PendingAdmissionsPage = () => {
  const t = useText(admissionReviewText);
  const c = useText(commonText);
  const isMadrasa = useIsMadrasa();
  const navigate = useNavigate();

  const [rows, setRows] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // per-row "processing" state so only the clicked row's buttons spin
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // reject modal - holds one target for a single-row reject, or several for
  // a bulk reject; either way one reason is collected and applied to all.
  const [rejectTargets, setRejectTargets] = useState<PendingStudent[] | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // detail modal
  const [detailTarget, setDetailTarget] = useState<PendingStudent | null>(null);

  // detail modal — নির্ধারিত ফি section: the determined fee list for this
  // student's class/session (from active FeeStructure rows - no Invoice
  // exists yet pre-approval), lazy-loaded whenever the modal opens, plus
  // whichever line's ছাড়/মওকুফ mini-form is currently expanded. Setting a
  // discount here only records a standing StudentFeeDiscount that gets
  // applied once invoices are actually generated at approval time (and to
  // every later MONTHLY invoice too) - see FeeService.setStudentFeeDiscount.
  const [feePreview, setFeePreview] = useState<FeePreviewRow[]>([]);
  const [feePreviewLoading, setFeePreviewLoading] = useState(false);
  const [activeDiscount, setActiveDiscount] = useState<{ feeStructureId: number } | null>(null);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [discountBusy, setDiscountBusy] = useState(false);

  // Opens the detail modal and, in the same render, clears the previous
  // student's fee-preview data and flips the loading flag on - otherwise
  // the modal briefly re-renders with the *previous* student's stale
  // feePreview/feePreviewLoading state (the fee-preview useEffect only
  // fires after this render commits), which flashes as "এই শ্রেণির জন্য
  // কোনো নির্ধারিত ফি সেট করা নেই" for a frame before the real fetch
  // starts - looking like the section is broken.
  const openDetail = (student: PendingStudent) => {
    setFeePreview([]);
    setFeePreviewLoading(true);
    setDetailTarget(student);
  };

  const loadPending = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await admissionApi.listPending();
      setRows(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD PENDING ADMISSIONS ERROR:", err);
      setRows([]);
      setError(getText(admissionReviewText).pendingLoadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const loadFeePreview = useCallback(async (studentId: string | number) => {
    try {
      setFeePreviewLoading(true);
      const res = await studentFeeDiscountApi.preview(Number(studentId));
      setFeePreview(normalizeFeePreviewArray(res));
    } catch (err) {
      logger.error("LOAD FEE PREVIEW ERROR:", err);
      setFeePreview([]);
    } finally {
      setFeePreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detailTarget) {
      setFeePreview([]);
      setActiveDiscount(null);
      return;
    }
    loadFeePreview(detailTarget.id);
  }, [detailTarget, loadFeePreview]);

  const openDiscountForm = (row: FeePreviewRow) => {
    setActiveDiscount({ feeStructureId: row.feeStructureId });
    // First-time discount starts blank (Muhtamim must consciously enter an
    // amount rather than accepting a pre-filled "waive it all" default);
    // re-opening an already-discounted fee pre-fills the current values so
    // it reads as editing that discount, not starting a new one.
    setDiscountAmount(row.waivedAmount > 0 ? String(row.waivedAmount) : "");
    setDiscountReason(row.reason || "");
  };

  const handleConfirmDiscount = async () => {
    if (!activeDiscount || !detailTarget) return;
    const amount = Number(discountAmount);
    if (!amount || amount <= 0) {
      useToastStore.getState().show(t.validAmount, "error");
      return;
    }
    if (!discountReason.trim()) {
      useToastStore.getState().show(t.enterReason, "error");
      return;
    }

    try {
      setDiscountBusy(true);
      const res = await studentFeeDiscountApi.setDiscount(
        Number(detailTarget.id),
        activeDiscount.feeStructureId,
        { amount, reason: discountReason.trim() },
      );
      setFeePreview(normalizeFeePreviewArray(res));
      useToastStore.getState().show(t.discountSet, "success");
      setActiveDiscount(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || getText(admissionReviewText).somethingWrong;
      useToastStore.getState().show(msg, "error");
    } finally {
      setDiscountBusy(false);
    }
  };

  const handleRemoveDiscount = async (feeStructureId: number) => {
    if (!detailTarget) return;
    try {
      setDiscountBusy(true);
      const res = await studentFeeDiscountApi.setDiscount(Number(detailTarget.id), feeStructureId, {
        amount: 0,
      });
      setFeePreview(normalizeFeePreviewArray(res));
      useToastStore.getState().show(t.discountRemoved, "success");
      setActiveDiscount(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || getText(admissionReviewText).somethingWrong;
      useToastStore.getState().show(msg, "error");
    } finally {
      setDiscountBusy(false);
    }
  };

  // Refreshes the sidebar's পেন্ডিং ভর্তি অনুমোদন badge right after an
  // approve/reject so the count updates immediately instead of waiting out
  // the sidebar GET cache's TTL or a full page reload.
  const refreshSidebarCounts = () => {
    refreshSidebar()
      .then((data) => useSidebarStore.getState().setItems(data))
      .catch((err) => logger.error("Sidebar refresh failed:", err));
  };

  const removeRows = (ids: (string | number)[]) => {
    const idSet = new Set(ids);
    setRows((prev) => prev.filter((row) => !idSet.has(row.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const toggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: (string | number)[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  };

  const handleApprove = async (student: PendingStudent) => {
    try {
      setBusyId(student.id);
      await admissionApi.approve(Number(student.id));
      useToastStore.getState().show(getText(admissionReviewText).approved, "success");
      removeRows([student.id]);
      refreshSidebarCounts();
    } catch (err: any) {
      const msg = err?.response?.data?.message || getText(admissionReviewText).approveFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkApprove = (students: PendingStudent[]) => {
    if (students.length === 0) return;
    useConfirmStore.getState().show({
      title: t.approveTitle,
      message: t.approveMessage(String(students.length)),
      confirmText: t.approveConfirm,
      onConfirm: async () => {
        setBulkBusy(true);
        try {
          const results = await Promise.allSettled(
            students.map((student) => admissionApi.approve(Number(student.id))),
          );
          const succeededIds = students
            .filter((_, i) => results[i].status === "fulfilled")
            .map((student) => student.id);
          const failedCount = results.length - succeededIds.length;
          if (succeededIds.length > 0) {
            removeRows(succeededIds);
            refreshSidebarCounts();
          }
          if (failedCount === 0) {
            useToastStore.getState().show(getText(admissionReviewText).approvedShort, "success");
          } else if (succeededIds.length === 0) {
            useToastStore.getState().show(getText(admissionReviewText).approveFailed, "error");
          } else {
            useToastStore
              .getState()
              .show(getText(admissionReviewText).approvePartial(String(succeededIds.length), String(failedCount)), "error");
          }
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  const openRejectModal = (student: PendingStudent) => {
    setRejectTargets([student]);
    setRejectReason("");
  };

  const openBulkRejectModal = (students: PendingStudent[]) => {
    if (students.length === 0) return;
    setRejectTargets(students);
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectTargets || rejectTargets.length === 0) return;
    if (!rejectReason.trim()) {
      useToastStore.getState().show(t.enterRejectReason, "error");
      return;
    }

    const isBulk = rejectTargets.length > 1;
    try {
      if (isBulk) setBulkBusy(true);
      else setBusyId(rejectTargets[0].id);

      const results = await Promise.allSettled(
        rejectTargets.map((student) => admissionApi.reject(Number(student.id), rejectReason.trim())),
      );
      const succeededIds = rejectTargets
        .filter((_, i) => results[i].status === "fulfilled")
        .map((student) => student.id);
      const failedCount = results.length - succeededIds.length;

      if (succeededIds.length > 0) {
        removeRows(succeededIds);
        refreshSidebarCounts();
      }

      if (!isBulk) {
        if (failedCount === 0) {
          useToastStore.getState().show(t.rejected, "success");
          setRejectTargets(null);
        } else {
          const msg =
            (results[0].status === "rejected" && (results[0] as PromiseRejectedResult).reason?.response?.data
              ?.message) ||
            t.rejectFailed;
          useToastStore.getState().show(msg, "error");
        }
      } else if (failedCount === 0) {
        useToastStore.getState().show(t.rejectedShort, "success");
        setRejectTargets(null);
      } else if (succeededIds.length === 0) {
        useToastStore.getState().show(t.rejectFailed, "error");
      } else {
        useToastStore
          .getState()
          .show(t.rejectPartial(String(succeededIds.length), String(failedCount)), "error");
        setRejectTargets(null);
      }
    } finally {
      setBusyId(null);
      setBulkBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
              {t.pendingTitle}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {t.awaitingReview(String(rows.length))}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <button
              type="button"
              onClick={() => navigate(`/students/admissions/rejected`)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 md:w-auto"
            >
              {t.rejectedApplications}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/students`)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 md:w-auto"
            >
              {t.backToList}
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {t.selectedN(String(selectedIds.size))}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => handleBulkApprove(rows.filter((row) => selectedIds.has(row.id)))}
                className="h-8 rounded-md bg-green-600 px-3 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
              >
                {t.approveSelected}
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => openBulkRejectModal(rows.filter((row) => selectedIds.has(row.id)))}
                className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {t.rejectSelected}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loading ? (
            <SkeletonTable rows={6} columns={6} />
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              {t.noPending}
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
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={() => toggleSelect(student.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="font-semibold text-gray-800 dark:text-slate-100">
                          {student.name_bn || t.noName}
                        </span>
                      </label>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {t.rollLabel} {student.roll ?? t.none}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {t.fatherLabel} {student.father_name || t.none} | {t.phoneLabel}{" "}
                      {student.guardian_phone || t.none}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {t.classLabel} {student.current_class || t.none}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                        {admissionTypeLabel(student.admission_type)}
                      </span>
                      {student.is_orphan === 1 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                          {t.orphan}
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
                        onClick={() => openDetail(student)}
                        className="h-9 flex-1 rounded-md border border-gray-300 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {t.details}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === student.id || bulkBusy}
                        onClick={() => handleApprove(student)}
                        className="h-9 flex-1 rounded-md bg-green-600 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        {t.approve}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === student.id || bulkBusy}
                        onClick={() => openRejectModal(student)}
                        className="h-9 flex-1 rounded-md bg-red-600 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {t.reject}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full text-start text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && rows.every((row) => selectedIds.has(row.id))}
                          onChange={() => toggleSelectAll(rows.map((row) => row.id))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </th>
                      <th className="px-3 py-2">{t.colName}</th>
                      <th className="px-3 py-2">{t.colRoll}</th>
                      <th className="px-3 py-2">{t.colFatherName}</th>
                      <th className="px-3 py-2">{t.colPhone}</th>
                      <th className="px-3 py-2">{t.colClass}</th>
                      <th className="px-3 py-2">{t.colAdmissionType}</th>
                      <th className="px-3 py-2">{t.colSpecial}</th>
                      <th className="px-3 py-2 text-end">{t.colActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(student.id)}
                            onChange={() => toggleSelect(student.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800 dark:text-slate-200">
                          {student.name_bn || t.noName}
                        </td>
                        <td className="px-3 py-2">{student.roll ?? t.none}</td>
                        <td className="px-3 py-2">{student.father_name || t.none}</td>
                        <td className="px-3 py-2">{student.guardian_phone || t.none}</td>
                        <td className="px-3 py-2">{student.current_class || t.none}</td>
                        <td className="px-3 py-2">{admissionTypeLabel(student.admission_type)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {student.is_orphan === 1 && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                                {t.orphan}
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
                              onClick={() => openDetail(student)}
                              className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {t.details}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === student.id || bulkBusy}
                              onClick={() => handleApprove(student)}
                              className="h-8 rounded-md bg-green-600 px-3 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                            >
                              {t.approve}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === student.id || bulkBusy}
                              onClick={() => openRejectModal(student)}
                              className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              {t.reject}
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

      {/* Reject reason modal - single target or bulk, one reason applies to all */}
      <Modal
        open={!!rejectTargets}
        title={
          rejectTargets && rejectTargets.length > 1
            ? t.rejectReasonBulk(String(rejectTargets.length))
            : t.rejectReasonOne(rejectTargets ? ` — ${rejectTargets[0].name_bn || ""}` : "")
        }
        onClose={() => setRejectTargets(null)}
      >
        <textarea
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          rows={4}
          placeholder={t.rejectReasonPlaceholder}
          className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRejectTargets(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {c.cancel}
          </button>
          <button
            type="button"
            disabled={bulkBusy || (!!rejectTargets && rejectTargets.length === 1 && busyId === rejectTargets[0].id)}
            onClick={handleReject}
            className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {c.confirm}
          </button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detailTarget}
        title={t.detailTitle(detailTarget ? ` — ${detailTarget.name_bn || ""}` : "")}
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

            <DetailSection title={t.studentInfo}>
              <DetailRow label={t.colName} value={detailTarget.name_bn} />
              <DetailRow label={t.arabicName} value={isMadrasa ? detailTarget.arabic_name : null} />
              <DetailRow label={t.nid} value={detailTarget.nid} />
              <DetailRow
                label={t.gender}
                value={detailTarget.gender === 1 ? t.male : detailTarget.gender === 2 ? t.female : null}
              />
              <DetailRow label={t.dob} value={detailTarget.dob ? String(detailTarget.dob).slice(0, 10) : null} />
              <DetailRow label={t.bloodGroup} value={detailTarget.blood_group} />
              <DetailRow label={t.residency} value={residencyLabel(detailTarget.residency_type)} />
              <DetailRow label={t.orphan} value={detailTarget.is_orphan === 1 ? c.yes : c.no} />
              <DetailRow label={t.colAdmissionType} value={admissionTypeLabel(detailTarget.admission_type)} />
              <DetailRow label={t.previousInstitution} value={detailTarget.previous_institution} />
              <DetailRow label={t.previousResult} value={detailTarget.previous_result} />
            </DetailSection>

            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">{t.determinedFees}</h4>
              {feePreviewLoading ? (
                <div className="flex flex-col gap-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-lg border border-gray-100 p-2 dark:border-slate-800">
                      <SkeletonText width="w-2/5" />
                    </div>
                  ))}
                </div>
              ) : feePreview.length === 0 ? (
                <div className="text-xs text-gray-400 dark:text-slate-500">
                  {t.noFeesForClass}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {feePreview.map((row) => {
                    const net = row.amount - row.waivedAmount;
                    const isActionOpen = activeDiscount?.feeStructureId === row.feeStructureId;
                    return (
                      <div
                        key={row.feeStructureId}
                        className="rounded-lg border border-gray-100 p-2 dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-gray-700 dark:text-slate-300">
                            {row.name}{" "}
                            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                              {t.frequency[row.frequency]}
                            </span>{" "}
                            <span className="text-gray-400 dark:text-slate-500">৳{row.amount}</span>
                            {row.examLinked && (
                              <span
                                title={t.examLinkedTitle}
                                className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                              >
                                {t.billedOnExam}
                              </span>
                            )}
                            {row.waivedAmount > 0 && (
                              <>
                                <span className="text-purple-600 dark:text-purple-400">{t.discountAmt(String(row.waivedAmount))}</span>
                                <span className="text-green-600 dark:text-green-400">{t.netAmt(String(net))}</span>
                              </>
                            )}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => openDiscountForm(row)}
                              className="h-7 rounded-md border border-purple-200 px-2.5 text-xs font-medium text-purple-700 transition hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-400 dark:hover:bg-purple-950/40"
                            >
                              {row.waivedAmount > 0 ? t.editDiscount : t.setDiscount}
                            </button>
                            {row.waivedAmount > 0 && (
                              <button
                                type="button"
                                disabled={discountBusy}
                                onClick={() => handleRemoveDiscount(row.feeStructureId)}
                                className="h-7 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                              >
                                {t.remove}
                              </button>
                            )}
                          </div>
                        </div>

                        {isActionOpen && (
                          <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-2 dark:border-slate-800">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-slate-400">{t.discountAmount}</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={discountAmount}
                                onChange={(e) => setDiscountAmount(normalizeBanglaDigits(e.target.value))}
                                className="h-8 w-24 rounded-md border border-gray-300 px-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div className="min-w-[140px] flex-1">
                              <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-slate-400">{t.reason}</label>
                              <input
                                type="text"
                                value={discountReason}
                                onChange={(e) => setDiscountReason(e.target.value)}
                                placeholder={t.reasonPlaceholder}
                                className="h-8 w-full rounded-md border border-gray-300 px-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={discountBusy}
                              onClick={handleConfirmDiscount}
                              className="h-8 rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {c.confirm}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveDiscount(null)}
                              className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {c.cancel}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DetailSection title={t.guardianInfo}>
              <DetailRow label={t.colFatherName} value={detailTarget.father_name} />
              <DetailRow label={t.fatherNid} value={detailTarget.father_nid} />
              <DetailRow label={t.fatherOccupation} value={detailTarget.father_occupation} />
              <DetailRow label={t.motherName} value={detailTarget.mother_name} />
              <DetailRow label={t.motherNid} value={detailTarget.mother_nid} />
              <DetailRow label={t.motherOccupation} value={detailTarget.mother_occupation} />
              <DetailRow label={t.mobile} value={detailTarget.guardian_phone} />
              <DetailRow label={t.altMobile} value={detailTarget.guardian_phone_2} />
            </DetailSection>

            {detailTarget.alt_guardian_name && (
              <DetailSection title={t.altGuardian}>
                <DetailRow label={t.colName} value={detailTarget.alt_guardian_name} />
                <DetailRow label={t.relation} value={detailTarget.alt_guardian_relation} />
                <DetailRow label={t.mobile} value={detailTarget.alt_guardian_phone} />
                <DetailRow label={t.address} value={detailTarget.alt_guardian_address} />
              </DetailSection>
            )}

            <DetailSection title={t.address}>
              <DetailRow label={t.addrDivision} value={detailTarget.division} />
              <DetailRow label={t.district} value={detailTarget.district} />
              <DetailRow label={t.thana} value={detailTarget.thana} />
              <DetailRow label={t.village} value={detailTarget.village} />
            </DetailSection>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4 dark:border-slate-700">
              <AdmissionFormPrintButton row={detailTarget} />
              <button
                type="button"
                onClick={() => navigate(studentPath(detailTarget, "/edit"))}
                className="h-9 rounded-md border border-blue-200 px-4 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-950/40"
              >
                {t.editInfo}
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
                {t.reject}
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
                {t.approve}
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
