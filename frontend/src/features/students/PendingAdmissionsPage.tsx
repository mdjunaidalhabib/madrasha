import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { admissionApi } from "../../services/phase1Api";
import Modal from "../../components/ui/Modal";
import { useToastStore } from "../../store/toastStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { logger } from "../../utils/logger";

type PendingStudent = {
  id: number | string;
  name_bn?: string;
  registration_no?: number | string | null;
  roll?: number | string | null;
  guardian_phone?: string | null;
  father_name?: string | null;
  current_class?: string | null;
  admission_status?: string;
};

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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">
              পেন্ডিং ভর্তি অনুমোদন
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              পর্যালোচনার অপেক্ষায় আছে: {rows.length} জন
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`${adminBase}/students/list`)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 md:w-auto"
          >
            ছাত্র তালিকায় ফিরে যান
          </button>
        </div>

        {/* Content */}
        <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">লোড হচ্ছে...</div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600">{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              অনুমোদনের অপেক্ষায় কোনো ভর্তি নেই
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="flex flex-col gap-3 sm:hidden">
                {rows.map((student) => (
                  <div
                    key={student.id}
                    className="rounded-lg border border-gray-200 p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">
                        {student.name_bn || "নাম নেই"}
                      </span>
                      <span className="text-xs text-gray-500">
                        রোল: {student.roll ?? "নেই"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      পিতা: {student.father_name || "নেই"} | ফোন:{" "}
                      {student.guardian_phone || "নেই"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      শ্রেণি: {student.current_class || "নেই"}
                    </div>
                    <div className="mt-3 flex gap-2">
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
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="px-3 py-2">নাম</th>
                      <th className="px-3 py-2">রোল</th>
                      <th className="px-3 py-2">পিতার নাম</th>
                      <th className="px-3 py-2">ফোন</th>
                      <th className="px-3 py-2">শ্রেণি</th>
                      <th className="px-3 py-2 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {student.name_bn || "নাম নেই"}
                        </td>
                        <td className="px-3 py-2">{student.roll ?? "নেই"}</td>
                        <td className="px-3 py-2">{student.father_name || "নেই"}</td>
                        <td className="px-3 py-2">{student.guardian_phone || "নেই"}</td>
                        <td className="px-3 py-2">{student.current_class || "নেই"}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
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
          className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-100"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRejectTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
    </div>
  );
};

export default PendingAdmissionsPage;
