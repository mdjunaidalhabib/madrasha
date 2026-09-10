import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";

import ReasonPromptModal from "../../components/ResultPanel/ReasonPromptModal";
import CorrectionPanel from "../../components/ResultPanel/CorrectionPanel";
import {
  RESULT_STATUS_FILTERS,
  RESULT_PERMISSIONS,
  resultStatusBadge,
  type ResultMasterStatus,
} from "../../components/ResultPanel/resultStatus";

interface Division {
  division_id: number;
  division_name_bn: string;
}
interface Exam {
  id: number;
  name: string;
}
interface ClassItem {
  class_id: number;
  class_name_bn: string;
  division_id: number;
}
interface StatusItem {
  class_id: number;
  division_id: number;
  exam_id: number;
  result_master_id: number | null;
  publish_status: ResultMasterStatus | "DRAFT" | "PUBLISHED" | null;
  total_students: number;
  entered_students: number;
  // Optional fields the backend may or may not include yet on the overview
  // row — read defensively, only rendered when present.
  submitted_by?: string | null;
  submitted_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
}

interface VerifyResult {
  valid: boolean;
  issues: string[];
  stats?: {
    totalStudents?: number;
    missingMarks?: number;
    invalidMarks?: number;
    missingGrades?: number;
    passCount?: number;
    failCount?: number;
    absentCount?: number;
    withheldCount?: number;
  };
}

const extractArray = (res: any) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

export default function ResultWorkflowPage() {
  const push = useToastStore((state) => state.push);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  const can = (perm: string) =>
    hasPermission(user, permissions, perm) ||
    hasPermission(user, permissions, RESULT_PERMISSIONS.legacyFallback);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ResultMasterStatus | "ALL">("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const [verifyModal, setVerifyModal] = useState<{
    resultMasterId: number;
    loading: boolean;
    result: VerifyResult | null;
  } | null>(null);

  const [rejectResultId, setRejectResultId] = useState<number | null>(null);
  const [rejectingResult, setRejectingResult] = useState(false);

  const [correctionTarget, setCorrectionTarget] = useState<{
    resultMasterId: number;
    label: string;
  } | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await cachedGet("/results/overview");
      setDivisions(extractArray(res.data?.divisions));
      setExams(extractArray(res.data?.exams));
      setClasses(extractArray(res.data?.classes));
      setStatuses(extractArray(res.data?.statuses));
    } catch (err) {
      logger.error("Workflow overview load error:", err);
      push("error", "কার্যপ্রবাহ লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const examName = (id: number) => exams.find((e) => e.id === id)?.name || `পরীক্ষা #${id}`;
  const className = (id: number) => classes.find((c) => c.class_id === id)?.class_name_bn || `শ্রেণি #${id}`;
  const divisionName = (id: number) =>
    divisions.find((d) => d.division_id === id)?.division_name_bn || "";

  // Rows with no result_master_id yet have nothing for this screen to act
  // on — number entry hasn't started, so there's no ResultMaster to drive a
  // workflow off of. Those stay on the Preview/Entry overview instead.
  const rows = statuses
    .filter((s) => s.result_master_id != null)
    .filter((s) => statusFilter === "ALL" || s.publish_status === statusFilter)
    .sort((a, b) => {
      const en = examName(a.exam_id).localeCompare(examName(b.exam_id), "bn");
      if (en !== 0) return en;
      return className(a.class_id).localeCompare(className(b.class_id), "bn");
    });

  const entryLink = (row: StatusItem) => {
    const params = new URLSearchParams({
      examId: String(row.exam_id),
      classId: String(row.class_id),
      divisionId: String(row.division_id),
    });
    if (row.result_master_id) params.set("resultMasterId", String(row.result_master_id));
    return `/talimat/results/entry?${params.toString()}`;
  };

  const runAction = async (resultMasterId: number, fn: () => Promise<void>) => {
    setActionLoadingId(resultMasterId);
    try {
      await fn();
      await loadOverview();
    } catch (err: any) {
      logger.error("Workflow action error:", err);
      push("error", err?.response?.data?.message || "কাজটি সম্পন্ন করা যায়নি");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleProcess = (row: StatusItem) => {
    if (!row.result_master_id) return;
    runAction(row.result_master_id, async () => {
      await api.post("/results/process", {
        exam_id: row.exam_id,
        class_id: row.class_id,
        result_master_id: row.result_master_id,
      });
      push("success", "প্রসেস সম্পন্ন হয়েছে");
    });
  };

  const handleVerifyResult = async (row: StatusItem) => {
    if (!row.result_master_id) return;
    setVerifyModal({ resultMasterId: row.result_master_id, loading: true, result: null });
    try {
      const res = await api.post(`/results/${row.result_master_id}/verify-result`, {});
      setVerifyModal({ resultMasterId: row.result_master_id, loading: false, result: res.data });
      await loadOverview();
    } catch (err: any) {
      logger.error("Verify result error:", err);
      push("error", err?.response?.data?.message || "ফলাফল যাচাই করা যায়নি");
      setVerifyModal(null);
    }
  };

  const handleApprove = (row: StatusItem) => {
    if (!row.result_master_id) return;
    useConfirmStore.getState().show({
      title: "ফলাফল অনুমোদন করুন",
      message: "এই ফলাফলটি অনুমোদন করতে চান? অনুমোদনের পর এটি প্রকাশের জন্য প্রস্তুত হবে।",
      confirmText: "অনুমোদন করুন",
      onConfirm: () =>
        runAction(row.result_master_id as number, async () => {
          await api.post(`/results/${row.result_master_id}/approve`, { approve: true });
          push("success", "ফলাফল অনুমোদন করা হয়েছে");
        }),
    });
  };

  const handleConfirmRejectResult = (reason: string) => {
    if (rejectResultId == null) return;
    setRejectingResult(true);
    runAction(rejectResultId, async () => {
      await api.post(`/results/${rejectResultId}/approve`, { approve: false, remarks: reason });
      push("success", "ফলাফল বাতিল করা হয়েছে");
    }).finally(() => {
      setRejectingResult(false);
      setRejectResultId(null);
    });
  };

  const handlePublish = (row: StatusItem) => {
    if (!row.result_master_id) return;
    useConfirmStore.getState().show({
      title: "ফলাফল প্রকাশ করুন",
      message: "ফলাফল প্রকাশ করা হলে অভিভাবক/শিক্ষার্থীরা তা দেখতে পাবে। এগিয়ে যেতে চান?",
      confirmText: "প্রকাশ করুন",
      danger: true,
      onConfirm: () =>
        runAction(row.result_master_id as number, async () => {
          await api.post("/results/publish", { result_master_id: row.result_master_id });
          push("success", "ফলাফল প্রকাশ করা হয়েছে");
        }),
    });
  };

  const handleLock = (row: StatusItem) => {
    if (!row.result_master_id) return;
    useConfirmStore.getState().show({
      title: "ফলাফল লক করুন",
      message: "লক করার পর সাধারণভাবে আর সম্পাদনা করা যাবে না — শুধু সংশোধনীর মাধ্যমে পরিবর্তন করা যাবে। এগিয়ে যেতে চান?",
      confirmText: "লক করুন",
      danger: true,
      onConfirm: () =>
        runAction(row.result_master_id as number, async () => {
          await api.post(`/results/${row.result_master_id}/lock`, {});
          push("success", "ফলাফল লক করা হয়েছে");
        }),
    });
  };

  return (
    <div className="p-3 sm:p-6 space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen">
      <div className="flex flex-wrap gap-3 justify-between items-center bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl shadow">
        <h1 className="text-lg sm:text-2xl font-bold dark:text-slate-100">🗂 ফলাফল কার্যপ্রবাহ</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/talimat/results/entry"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            ➕ নম্বর এন্ট্রি
          </Link>
          <Link
            to="/talimat/results"
            className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700"
          >
            👁 প্রিভিউ
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl shadow">
        {RESULT_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === f.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow divide-y divide-gray-100 dark:divide-slate-800">
        {loading ? (
          <div className="p-8 text-center text-gray-400 dark:text-slate-500">লোড হচ্ছে...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 dark:text-slate-500">
            এই অবস্থায় কোনো ফলাফল পাওয়া যায়নি
          </div>
        ) : (
          rows.map((row) => {
            const status = (row.publish_status || "DRAFT") as ResultMasterStatus;
            const badge = resultStatusBadge(status);
            const busy = actionLoadingId === row.result_master_id;
            const masterId = row.result_master_id as number;

            return (
              <div key={`${row.exam_id}-${row.class_id}`} className="p-3 sm:p-4 flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 dark:text-slate-100 break-words">
                    📝 {examName(row.exam_id)} — {className(row.class_id)}
                    {divisionName(row.division_id) && (
                      <span className="text-xs text-gray-400 dark:text-slate-500"> ({divisionName(row.division_id)})</span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {row.entered_students}/{row.total_students} জন এন্ট্রি হয়েছে
                    </span>
                  </div>
                  {row.rejected_reason && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      ❌ বাতিল: {row.rejected_reason}
                      {row.rejected_by ? ` — ${row.rejected_by}` : ""}
                      {row.rejected_at ? ` (${row.rejected_at})` : ""}
                    </p>
                  )}
                  {row.submitted_by && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                      জমা: {row.submitted_by}
                      {row.submitted_at ? `, ${row.submitted_at}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(status === "DRAFT" || status === "MARKS_SUBMITTED") && (
                    <Link
                      to={entryLink(row)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      ✍️ বিষয় জমা/যাচাই
                    </Link>
                  )}

                  {status === "MARKS_VERIFIED" && can(RESULT_PERMISSIONS.resultProcess) && (
                    <button
                      onClick={() => handleProcess(row)}
                      disabled={busy}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:bg-gray-400"
                    >
                      {busy ? "..." : "⚙️ প্রসেস করুন"}
                    </button>
                  )}

                  {status === "PROCESSING" && can(RESULT_PERMISSIONS.resultVerify) && (
                    <button
                      onClick={() => handleVerifyResult(row)}
                      disabled={busy}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:bg-gray-400"
                    >
                      {busy ? "..." : "🔍 ফলাফল যাচাই করুন"}
                    </button>
                  )}

                  {status === "RESULT_VERIFIED" && can(RESULT_PERMISSIONS.resultApprove) && (
                    <>
                      <button
                        onClick={() => handleApprove(row)}
                        disabled={busy}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400"
                      >
                        {busy ? "..." : "✅ অনুমোদন করুন"}
                      </button>
                      <button
                        onClick={() => setRejectResultId(masterId)}
                        disabled={busy}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
                      >
                        বাতিল করুন
                      </button>
                    </>
                  )}

                  {status === "APPROVED" && can(RESULT_PERMISSIONS.resultPublish) && (
                    <button
                      onClick={() => handlePublish(row)}
                      disabled={busy}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-400"
                    >
                      {busy ? "..." : "📢 প্রকাশ করুন"}
                    </button>
                  )}

                  {status === "PUBLISHED" && can(RESULT_PERMISSIONS.resultLock) && (
                    <button
                      onClick={() => handleLock(row)}
                      disabled={busy}
                      className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:bg-gray-400"
                    >
                      {busy ? "..." : "🔒 লক করুন"}
                    </button>
                  )}

                  {(status === "PUBLISHED" || status === "LOCKED") &&
                    can(RESULT_PERMISSIONS.resultCorrect) && (
                      <button
                        onClick={() =>
                          setCorrectionTarget({
                            resultMasterId: masterId,
                            label: `${examName(row.exam_id)} — ${className(row.class_id)}`,
                          })
                        }
                        className="rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
                      >
                        🛠 সংশোধনী
                      </button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Result-level verify issues/stats panel */}
      <Modal
        open={verifyModal != null}
        title="ফলাফল যাচাই"
        onClose={() => setVerifyModal(null)}
        maxWidthClassName="max-w-lg"
      >
        {verifyModal?.loading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">যাচাই করা হচ্ছে...</p>
        ) : verifyModal?.result ? (
          <div className="space-y-3">
            <div
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                verifyModal.result.valid
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
              }`}
            >
              {verifyModal.result.valid
                ? "✅ ফলাফল সঠিক — পরবর্তী ধাপে (অনুমোদন) এগিয়ে যাওয়া যাবে"
                : "⚠️ নিচের সমস্যাগুলো সমাধান করে আবার যাচাই করুন"}
            </div>

            {verifyModal.result.stats && (
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {Object.entries(verifyModal.result.stats).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-gray-200 p-2 text-center dark:border-slate-700">
                    <p className="font-bold text-gray-800 dark:text-slate-100">{value as any}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{key}</p>
                  </div>
                ))}
              </div>
            )}

            {verifyModal.result.issues?.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-red-600 dark:text-red-400">
                {verifyModal.result.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>

      <ReasonPromptModal
        open={rejectResultId != null}
        title="ফলাফল বাতিল করুন"
        message="এই ফলাফলটি বাতিল করা হবে — পুনরায় প্রক্রিয়া করতে হবে।"
        label="বাতিলের কারণ / মন্তব্য"
        confirmText="বাতিল করুন"
        loading={rejectingResult}
        onCancel={() => setRejectResultId(null)}
        onConfirm={handleConfirmRejectResult}
      />

      <Modal
        open={correctionTarget != null}
        title={`🛠 সংশোধনী — ${correctionTarget?.label ?? ""}`}
        onClose={() => setCorrectionTarget(null)}
        maxWidthClassName="max-w-2xl"
      >
        {correctionTarget && <CorrectionPanel resultMasterId={correctionTarget.resultMasterId} />}
      </Modal>
    </div>
  );
}
