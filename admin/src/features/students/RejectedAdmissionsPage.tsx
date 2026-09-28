import { useCallback, useEffect, useMemo, useState } from "react";
import { commonText, getText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { admissionReviewText } from "./admissionReview.text";
import { useNavigate, useSearchParams } from "react-router-dom";
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

type RejectedStudent = {
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
  session_id?: number | string | null;
  rejection_reason?: string | null;
  admission_type?: "NEW" | "RE_ADMISSION";
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

const RejectedAdmissionsPage = () => {
  const t = useText(admissionReviewText);
  const c = useText(commonText);
  const lang = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // "সেশন ডিলিট" ফ্লো থেকে ?session=<id> দিয়ে এই পেজে নির্দিষ্ট একটা সেশনের
  // বাতিল আবেদনগুলো ফিল্টার করে দেখানোর জন্য (দেখুন SessionPage.tsx)।
  const sessionFilter = searchParams.get("session");

  const [rows, setRows] = useState<RejectedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const [detailTarget, setDetailTarget] = useState<RejectedStudent | null>(null);

  // t.determinedFees - approve করলে যা বিল হতো তার প্রিভিউ, রিড-অনলি (ছাড়/মওকুফ
  // সেট করার সুবিধা ব্যাকএন্ডে শুধু PENDING ভর্তির জন্যই প্রযোজ্য - দেখুন
  // FeeService.setStudentFeeDiscount - তাই এখানে এডিট বাটন দেখানো হয় না)।
  const [feePreview, setFeePreview] = useState<FeePreviewRow[]>([]);
  const [feePreviewLoading, setFeePreviewLoading] = useState(false);

  // ডিটেইল মডাল খোলার সাথে সাথেই আগের ছাত্রের feePreview ক্লিয়ার করে দেয়,
  // নাহলে useEffect আসল ডেটা আনার আগ পর্যন্ত এক ফ্রেমের জন্য আগের ছাত্রের
  // পুরনো তথ্য দেখা যায়।
  const openDetail = (student: RejectedStudent) => {
    setFeePreview([]);
    setFeePreviewLoading(true);
    setDetailTarget(student);
  };

  const loadRejected = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await admissionApi.listRejected();
      setRows(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD REJECTED ADMISSIONS ERROR:", err);
      setRows([]);
      setError(t.rejectedLoadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRejected();
  }, [loadRejected]);

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
      return;
    }
    loadFeePreview(detailTarget.id);
  }, [detailTarget, loadFeePreview]);

  const filteredRows = useMemo(() => {
    if (!sessionFilter) return rows;
    return rows.filter((row) => String(row.session_id ?? "") === sessionFilter);
  }, [rows, sessionFilter]);

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

  const handleApprove = (student: RejectedStudent) => {
    useConfirmStore.getState().show({
      title: t.reapproveTitle,
      message: t.reapproveMessage(student.name_bn || t.thisApplication),
      confirmText: t.approveConfirm,
      onConfirm: async () => {
        try {
          setBusyId(student.id);
          await admissionApi.approve(Number(student.id));
          useToastStore.getState().show(t.reapproved, "success");
          removeRows([student.id]);
          refreshSidebarCounts();
        } catch (err: any) {
          const msg = err?.response?.data?.message || t.approveFailed;
          useToastStore.getState().show(msg, "error");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const handlePermanentDelete = (student: RejectedStudent) => {
    useConfirmStore.getState().show({
      title: t.deleteForeverTitle,
      message: t.deleteForeverMessage(student.name_bn || t.thisApplication),
      confirmText: t.deleteConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          setBusyId(student.id);
          await admissionApi.permanentlyDeleteRejected(Number(student.id));
          useToastStore.getState().show(t.deletedForever, "success");
          removeRows([student.id]);
        } catch (err: any) {
          const msg = err?.response?.data?.message || t.deleteFailed;
          useToastStore.getState().show(msg, "error");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const handleBulkDelete = (students: RejectedStudent[]) => {
    if (students.length === 0) return;
    useConfirmStore.getState().show({
      title: t.deleteForeverTitle,
      message: t.deleteForeverBulk(localizeDigits(students.length, lang)),
      confirmText: t.deleteConfirm,
      danger: true,
      onConfirm: async () => {
        setBulkBusy(true);
        try {
          const results = await Promise.allSettled(
            students.map((student) => admissionApi.permanentlyDeleteRejected(Number(student.id))),
          );
          const succeededIds = students
            .filter((_, i) => results[i].status === "fulfilled")
            .map((student) => student.id);
          const failedCount = results.length - succeededIds.length;
          if (succeededIds.length > 0) removeRows(succeededIds);
          if (failedCount === 0) {
            useToastStore.getState().show(t.deleted, "success");
          } else if (succeededIds.length === 0) {
            useToastStore.getState().show(t.deleteFailed, "error");
          } else {
            useToastStore
              .getState()
              .show(t.deletePartial(localizeDigits(succeededIds.length, lang), localizeDigits(failedCount, lang)), "error");
          }
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
              {t.rejectedTitle}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {t.totalN(localizeDigits(filteredRows.length, lang))}{sessionFilter ? t.sessionFiltered : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/students/admissions/pending`)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 md:w-auto"
          >
            {t.goToPending}
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {t.selectedN(localizeDigits(selectedIds.size, lang))}
            </span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleBulkDelete(filteredRows.filter((row) => selectedIds.has(row.id)))}
              className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {t.deleteSelectedForever}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loading ? (
            <SkeletonTable rows={6} columns={6} />
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              {t.noRejected}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="flex flex-col gap-3 sm:hidden">
                {filteredRows.map((student) => (
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
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                        {admissionTypeLabel(student.admission_type)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {t.fatherLabel} {student.father_name || t.none} | {t.phoneLabel} {student.guardian_phone || t.none}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {t.classLabel} {student.current_class || t.none}
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
                        {t.reapprove}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === student.id || bulkBusy}
                        onClick={() => handlePermanentDelete(student)}
                        className="h-9 flex-1 rounded-md bg-red-600 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {t.deleteForever}
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
                          checked={filteredRows.length > 0 && filteredRows.every((row) => selectedIds.has(row.id))}
                          onChange={() => toggleSelectAll(filteredRows.map((row) => row.id))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </th>
                      <th className="px-3 py-2">{t.colName}</th>
                      <th className="px-3 py-2">{t.colFatherName}</th>
                      <th className="px-3 py-2">{t.colPhone}</th>
                      <th className="px-3 py-2">{t.colClass}</th>
                      <th className="px-3 py-2">{t.rejectReasonCol}</th>
                      <th className="px-3 py-2 text-end">{t.colActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((student) => (
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
                        <td className="px-3 py-2">{student.father_name || t.none}</td>
                        <td className="px-3 py-2">{student.guardian_phone || t.none}</td>
                        <td className="px-3 py-2">{student.current_class || t.none}</td>
                        <td className="px-3 py-2 max-w-xs truncate" title={student.rejection_reason || ""}>
                          {student.rejection_reason || t.noReason}
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
                              {t.reapprove}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === student.id || bulkBusy}
                              onClick={() => handlePermanentDelete(student)}
                              className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              {t.deleteForever}
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

      {/* বিস্তারিত মডাল - পেন্ডিং ভর্তি অনুমোদন পেজের সাথে সামঞ্জস্যপূর্ণ; নির্ধারিত
          ফি সেকশন এখানে রিড-অনলি (ছাড়/মওকুফ শুধু PENDING অবস্থায় সম্ভব)। */}
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

            <DetailSection title={t.rejectReasonCol}>
              <div className="col-span-full text-gray-700 dark:text-slate-300">
                {detailTarget.rejection_reason || t.noReasonGiven}
              </div>
            </DetailSection>

            <DetailSection title={t.studentInfo}>
              <DetailRow label={t.colName} value={detailTarget.name_bn} />
              <DetailRow label={t.arabicName} value={detailTarget.arabic_name} />
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
              <DetailRow label={t.colClass} value={detailTarget.current_class} />
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
                    return (
                      <div
                        key={row.feeStructureId}
                        className="rounded-lg border border-gray-100 p-2 text-sm dark:border-slate-800"
                      >
                        <span className="text-gray-700 dark:text-slate-300">
                          {row.name}{" "}
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                            {t.frequency[row.frequency]}
                          </span>{" "}
                          <span className="text-gray-400 dark:text-slate-500">৳{row.amount}</span>
                          {row.examLinked && (
                            <span
                              title={t.examLinkedTitleShort}
                              className="ms-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                            >
                              {t.billedOnExam}
                            </span>
                          )}
                          {row.waivedAmount > 0 && (
                            <>
                              <span className="text-purple-600 dark:text-purple-400">{t.discountAmt(localizeDigits(row.waivedAmount, lang))}</span>
                              <span className="text-green-600 dark:text-green-400">{t.netAmt(localizeDigits(net, lang))}</span>
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                {t.reapproveFeeNote}
              </p>
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
                  handlePermanentDelete(detailTarget);
                  setDetailTarget(null);
                }}
                className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {t.deleteForever}
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
                {t.reapprove}
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

export default RejectedAdmissionsPage;
