import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const residencyLabel = (value?: number | null) =>
  value === 1 ? "আবাসিক" : value === 2 ? "অনাবাসিক" : "নেই";

const admissionTypeLabel = (value?: string) => (value === "RE_ADMISSION" ? "পুনঃভর্তি" : "নতুন");

const FREQUENCY_LABEL: Record<FeePreviewRow["frequency"], string> = {
  ONE_TIME: "একবার",
  MONTHLY: "মাসিক",
  YEARLY: "বাৎসরিক",
};

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

  // "নির্ধারিত ফি" - approve করলে যা বিল হতো তার প্রিভিউ, রিড-অনলি (ছাড়/মওকুফ
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
      setError("বাতিল হওয়া আবেদনের তালিকা লোড করতে সমস্যা হয়েছে");
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
      title: "পুনরায় অনুমোদন করবেন?",
      message: `"${student.name_bn || "এই আবেদন"}" পুনরায় অনুমোদন করা হবে — একজন সক্রিয় ছাত্র হিসেবে রোল/রেজিস্ট্রেশন বসবে এবং ফি বিল হবে।`,
      confirmText: "অনুমোদন করুন",
      onConfirm: async () => {
        try {
          setBusyId(student.id);
          await admissionApi.approve(Number(student.id));
          useToastStore.getState().show("ভর্তি পুনরায় অনুমোদন করা হয়েছে", "success");
          removeRows([student.id]);
          refreshSidebarCounts();
        } catch (err: any) {
          const msg = err?.response?.data?.message || "অনুমোদন করতে সমস্যা হয়েছে";
          useToastStore.getState().show(msg, "error");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const handlePermanentDelete = (student: RejectedStudent) => {
    useConfirmStore.getState().show({
      title: "স্থায়ীভাবে মুছে ফেলবেন?",
      message: `"${student.name_bn || "এই আবেদন"}" আবেদনটি স্থায়ীভাবে মুছে যাবে। এটি আর ফিরিয়ে আনা যাবে না।`,
      confirmText: "মুছে ফেলুন",
      danger: true,
      onConfirm: async () => {
        try {
          setBusyId(student.id);
          await admissionApi.permanentlyDeleteRejected(Number(student.id));
          useToastStore.getState().show("আবেদনটি স্থায়ীভাবে মুছে ফেলা হয়েছে", "success");
          removeRows([student.id]);
        } catch (err: any) {
          const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
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
      title: "স্থায়ীভাবে মুছে ফেলবেন?",
      message: `নির্বাচিত ${students.length}টি আবেদন স্থায়ীভাবে মুছে যাবে। এটি আর ফিরিয়ে আনা যাবে না।`,
      confirmText: "মুছে ফেলুন",
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
            useToastStore.getState().show("মুছে ফেলা হয়েছে", "success");
          } else if (succeededIds.length === 0) {
            useToastStore.getState().show("মুছতে সমস্যা হয়েছে", "error");
          } else {
            useToastStore
              .getState()
              .show(`${succeededIds.length}টি মুছে ফেলা হয়েছে, ${failedCount}টি ব্যর্থ হয়েছে`, "error");
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
              বাতিল হওয়া ভর্তির আবেদন
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              মোট {filteredRows.length}টি{sessionFilter ? " (নির্দিষ্ট সেশনে ফিল্টার করা)" : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/students/admissions/pending`)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 md:w-auto"
          >
            পেন্ডিং ভর্তি অনুমোদনে যান
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {selectedIds.size}টি নির্বাচিত
            </span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleBulkDelete(filteredRows.filter((row) => selectedIds.has(row.id)))}
              className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              নির্বাচিতগুলো স্থায়ীভাবে মুছুন
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
              বাতিল হওয়া কোনো আবেদন নেই
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
                          {student.name_bn || "নাম নেই"}
                        </span>
                      </label>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                        {admissionTypeLabel(student.admission_type)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      পিতা: {student.father_name || "নেই"} | ফোন: {student.guardian_phone || "নেই"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      শ্রেণি: {student.current_class || "নেই"}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openDetail(student)}
                        className="h-9 flex-1 rounded-md border border-gray-300 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        বিস্তারিত
                      </button>
                      <button
                        type="button"
                        disabled={busyId === student.id || bulkBusy}
                        onClick={() => handleApprove(student)}
                        className="h-9 flex-1 rounded-md bg-green-600 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        পুনরায় অনুমোদন
                      </button>
                      <button
                        type="button"
                        disabled={busyId === student.id || bulkBusy}
                        onClick={() => handlePermanentDelete(student)}
                        className="h-9 flex-1 rounded-md bg-red-600 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        স্থায়ীভাবে মুছুন
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
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={filteredRows.length > 0 && filteredRows.every((row) => selectedIds.has(row.id))}
                          onChange={() => toggleSelectAll(filteredRows.map((row) => row.id))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </th>
                      <th className="px-3 py-2">নাম</th>
                      <th className="px-3 py-2">পিতার নাম</th>
                      <th className="px-3 py-2">ফোন</th>
                      <th className="px-3 py-2">শ্রেণি</th>
                      <th className="px-3 py-2">বাতিলের কারণ</th>
                      <th className="px-3 py-2 text-right">অ্যাকশন</th>
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
                          {student.name_bn || "নাম নেই"}
                        </td>
                        <td className="px-3 py-2">{student.father_name || "নেই"}</td>
                        <td className="px-3 py-2">{student.guardian_phone || "নেই"}</td>
                        <td className="px-3 py-2">{student.current_class || "নেই"}</td>
                        <td className="px-3 py-2 max-w-xs truncate" title={student.rejection_reason || ""}>
                          {student.rejection_reason || "কারণ উল্লেখ নেই"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(student)}
                              className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              বিস্তারিত
                            </button>
                            <button
                              type="button"
                              disabled={busyId === student.id || bulkBusy}
                              onClick={() => handleApprove(student)}
                              className="h-8 rounded-md bg-green-600 px-3 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                            >
                              পুনরায় অনুমোদন
                            </button>
                            <button
                              type="button"
                              disabled={busyId === student.id || bulkBusy}
                              onClick={() => handlePermanentDelete(student)}
                              className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              স্থায়ীভাবে মুছুন
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

            <DetailSection title="বাতিলের কারণ">
              <div className="col-span-full text-gray-700 dark:text-slate-300">
                {detailTarget.rejection_reason || "কোনো কারণ উল্লেখ করা হয়নি"}
              </div>
            </DetailSection>

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
              <DetailRow label="শ্রেণি" value={detailTarget.current_class} />
              <DetailRow label="পূর্ববর্তী প্রতিষ্ঠান" value={detailTarget.previous_institution} />
              <DetailRow label="পূর্বের ফলাফল" value={detailTarget.previous_result} />
            </DetailSection>

            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">নির্ধারিত ফি</h4>
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
                  এই শ্রেণির জন্য কোনো নির্ধারিত ফি সেট করা নেই
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
                            {FREQUENCY_LABEL[row.frequency]}
                          </span>{" "}
                          <span className="text-gray-400 dark:text-slate-500">৳{row.amount}</span>
                          {row.examLinked && (
                            <span
                              title="নির্দিষ্ট একটি পরীক্ষার সাথে যুক্ত - ভর্তি অনুমোদনের সাথে সাথে এখনই বিল হবে না"
                              className="ml-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                            >
                              পরীক্ষা এলে বিল হবে
                            </span>
                          )}
                          {row.waivedAmount > 0 && (
                            <>
                              <span className="text-purple-600 dark:text-purple-400"> · ছাড় ৳{row.waivedAmount}</span>
                              <span className="text-green-600 dark:text-green-400"> · নেট ৳{net}</span>
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                পুনরায় অনুমোদন করলে এই ফিগুলো বিল হবে। ছাড়/মওকুফ এখান থেকে সেট করা যাবে না - অনুমোদনের পর প্রয়োজনে ছাত্র তালিকা থেকে ইনভয়েসে মওকুফ প্রয়োগ করুন।
              </p>
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
                onClick={() => navigate(`/students/${detailTarget.id}`)}
                className="h-9 rounded-md border border-blue-200 px-4 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-950/40"
              >
                তথ্য সম্পাদনা করুন
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
                স্থায়ীভাবে মুছুন
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
                পুনরায় অনুমোদন
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
