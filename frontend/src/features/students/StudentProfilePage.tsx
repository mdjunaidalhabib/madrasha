import { useCallback, useEffect, useState } from "react";
import { toBanglaDigits } from "../../utils/reportUtils";
import { useParams, useNavigate } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import { getTenantAdminBase } from "../../utils/tenantSlug";

import ImageUploadProfile from "../../components/studentProfile/ImageUploadProfile";
import StudentInfoProfile from "../../components/studentProfile/StudentInfoProfile";
import ParentInfoProfile from "../../components/studentProfile/ParentInfoProfile";
import AddressInfoProfile from "../../components/studentProfile/AddressInfoProfile";
import ProfileQuickNav, { type QuickNavRecord } from "../../components/common/ProfileQuickNav";
import {
  profileActionButtonClass as actionButtonClass,
  profileOutlineButtonClass as outlineButtonClass,
} from "../../components/common/profileActionStyles";
import { logger } from "../../utils/logger";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import AdmissionFormPrintButton from "../../components/admission/AdmissionFormPrintButton";
import Modal from "../../components/ui/Modal";
import { sessionApi, type Session } from "../../services/sessionApi";

const deepCopy = (data: any) => JSON.parse(JSON.stringify(data));

const StudentProfilePage = () => {
  const { id, madrasaSlug = "" } = useParams();
  const navigate = useNavigate();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const [student, setStudent] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editableField, setEditableField] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expelBusy, setExpelBusy] = useState(false);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transferSessionId, setTransferSessionId] = useState("");
  const [transferRoll, setTransferRoll] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  const fetchStudent = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      const res = await cachedGet(`/students/${id}`);
      const data = res.data.data;

      setStudent(deepCopy(data));
      setOriginal(deepCopy(data));
    } catch (err) {
      logger.error("FETCH STUDENT ERROR:", err);
      useToastStore.getState().show("Failed to load student", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;

    setStudent((prev: any) => ({
      ...prev,
      [name]: name === "gender" ? (value === "" ? null : Number(value)) : value,
    }));
  };

  const getChangedData = () => {
    const changed: any = {};

    if (!student || !original) return changed;

    for (const key in student) {
      if (JSON.stringify(student[key]) !== JSON.stringify(original[key])) {
        changed[key] = student[key];
      }
    }

    return changed;
  };

  const isChanged = () => Object.keys(getChangedData()).length > 0;

  const handleUpdate = async () => {
    if (!isChanged()) return;

    const changed = getChangedData();

    // Roll and registration numbers are immutable, server-managed identifiers.
    delete changed.roll;
    delete changed.registration_no;

    try {
      setSaving(true);

      await api.put(`/students/${id}`, changed);

      await fetchStudent();

      setIsEditMode(false);
      setEditableField(null);

      useToastStore.getState().show("Updated successfully", "success");
    } catch (error) {
      logger.error("UPDATE ERROR:", error);
      useToastStore.getState().show("Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    useConfirmStore.getState().show({
      title: "শিক্ষার্থী মুছবেন?",
      message: "এই শিক্ষার্থীকে ট্র্যাশে সরাতে চান? পরে প্রয়োজনে ট্র্যাশ থেকে ফিরিয়ে আনা যাবে।",
      confirmText: "ট্র্যাশে সরান",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/students/${id}`);
          useToastStore.getState().show("ট্র্যাশে সরানো হয়েছে", "success");
          navigate(`${adminBase}/students/list`);
        } catch (error) {
          logger.error("DELETE ERROR:", error);
          useToastStore.getState().show("মুছে ফেলা যায়নি", "error");
        }
      },
    });
  };

  const isExpelled = Number(student?.is_active) === 0;

  const handleExpelToggle = () => {
    const expelling = !isExpelled;

    useConfirmStore.getState().show({
      title: expelling ? "শিক্ষার্থীকে বহিষ্কার করবেন?" : "বহিষ্কার বাতিল করবেন?",
      message: expelling
        ? "এই শিক্ষার্থীকে বহিষ্কার করা হবে। রেকর্ড ট্র্যাশে যাবে না, পরে চাইলে বহিষ্কার বাতিল করা যাবে।"
        : "এই শিক্ষার্থীর বহিষ্কার অবস্থা বাতিল করে আবার সক্রিয় করতে চান?",
      confirmText: expelling ? "বহিষ্কার করুন" : "সক্রিয় করুন",
      danger: expelling,
      onConfirm: async () => {
        try {
          setExpelBusy(true);
          await api.patch(`/students/${id}/expel`, { expelled: expelling });
          setStudent((prev: any) => ({ ...prev, is_active: expelling ? 0 : 1 }));
          setOriginal((prev: any) => ({ ...prev, is_active: expelling ? 0 : 1 }));
          useToastStore
            .getState()
            .show(expelling ? "বহিষ্কার করা হয়েছে" : "বহিষ্কার বাতিল করা হয়েছে", "success");
        } catch (error) {
          logger.error("EXPEL STUDENT ERROR:", error);
          useToastStore.getState().show("করা যায়নি", "error");
        } finally {
          setExpelBusy(false);
        }
      },
    });
  };

  const openTransferModal = async () => {
    setTransferSessionId("");
    setTransferRoll("");
    setTransferReason("");
    setTransferModalOpen(true);
    try {
      const res = await sessionApi.list(true);
      const data = (res.data as any)?.data || [];
      setSessions(
        (Array.isArray(data) ? data : []).filter((s: Session) => s.id !== student?.session_id),
      );
    } catch (error) {
      logger.error("LOAD SESSIONS ERROR:", error);
      setSessions([]);
    }
  };

  const handleTransferSession = async () => {
    if (!transferSessionId) {
      useToastStore.getState().show("সেশন নির্বাচন করুন", "error");
      return;
    }
    try {
      setTransferBusy(true);
      const res = await api.patch(`/students/${id}/transfer-session`, {
        session_id: Number(transferSessionId),
        roll: transferRoll ? Number(transferRoll) : undefined,
        reason: transferReason.trim() || undefined,
      });
      const newRoll = (res.data as any)?.data?.roll;
      useToastStore
        .getState()
        .show(`সেশন ট্রান্সফার সফল হয়েছে (নতুন রোল: ${newRoll ?? "-"})`, "success");
      setTransferModalOpen(false);
      fetchStudent();
    } catch (error: any) {
      const msg = error?.response?.data?.message || "সেশন ট্রান্সফার করা যায়নি";
      useToastStore.getState().show(msg, "error");
    } finally {
      setTransferBusy(false);
    }
  };

  const quickNavPath = useCallback(
    (studentId: string | number) => `${adminBase}/students/${studentId}`,
    [adminBase],
  );

  const quickNavMeta = useCallback(
    (record: QuickNavRecord) => [
      (record.current_class || record.class_name || record.class) as string,
      `রোল ${record.roll ? toBanglaDigits(record.roll as number) : "নেই"}`,
      `রেজি. ${record.registration_no ? toBanglaDigits(record.registration_no as number) : "নেই"}`,
    ],
    [],
  );

  const quickNavSearchFields = useCallback(
    (record: QuickNavRecord) => [
      record.current_class as string,
      record.class_name as string,
      record.father_name as string,
    ],
    [],
  );

  // লোডিং অবস্থাতেও কুইক নেভ দেখানো হয় — এক প্রোফাইল থেকে আরেকটায় গেলে
  // সার্চ বক্সটা যেন হঠাৎ উধাও হয়ে না যায়। `student` তখনও আগের রেকর্ড ধরে
  // রাখে, তাই সেশন স্কোপ ঠিক থাকে।
  const quickNav = id ? (
    <ProfileQuickNav
      endpoint={
        student
          ? student.session_id
            ? `/students?session_id=${student.session_id}`
            : "/students"
          : null
      }
      currentId={id}
      profilePath={quickNavPath}
      placeholder="অন্য ছাত্র খুঁজুন — নাম / রোল / রেজি. / শ্রেণি"
      ariaLabel="অন্য ছাত্র খুঁজুন"
      metaParts={quickNavMeta}
      extraSearchFields={quickNavSearchFields}
    />
  ) : null;

  if (loading)
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        {quickNav}
        <SkeletonCard lines={6} />
        <SkeletonCard lines={4} />
      </div>
    );
  if (!student) return <p className="p-6">No student found</p>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {quickNav}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">Student Profile</h1>
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              isExpelled
                ? "border-red-300 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
                : "border-green-300 bg-green-100 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-400"
            }`}
          >
            {isExpelled ? "বহিষ্কৃত" : "সক্রিয়"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!isEditMode ? (
            <button
              onClick={() => setIsEditMode(true)}
              className={`${actionButtonClass} bg-blue-500`}
            >
              Edit
            </button>
          ) : (
            <button
              onClick={() => {
                setIsEditMode(false);
                setEditableField(null);
                setStudent(deepCopy(original));
              }}
              className={`${actionButtonClass} bg-gray-500`}
            >
              Cancel
            </button>
          )}

          {isEditMode && (
            <button
              onClick={handleUpdate}
              disabled={!isChanged() || saving}
              className={`${actionButtonClass} ${isChanged() && !saving ? "bg-green-500" : "bg-gray-400"}`}
            >
              {saving ? "Saving..." : "Update"}
            </button>
          )}

          <AdmissionFormPrintButton row={student} className={outlineButtonClass} />

          <button onClick={openTransferModal} className={`${actionButtonClass} bg-indigo-600`}>
            সেশন ট্রান্সফার
          </button>

          <button
            onClick={handleExpelToggle}
            disabled={expelBusy}
            className={`${actionButtonClass} ${isExpelled ? "bg-amber-500" : "bg-orange-600"}`}
          >
            {isExpelled ? "বহিষ্কার বাতিল" : "বহিষ্কার"}
          </button>

          <button onClick={handleDelete} className={`${actionButtonClass} bg-red-500`}>
            Delete
          </button>
        </div>
      </div>

      <ImageUploadProfile student={student} setStudent={setStudent} isEditMode={isEditMode} />

      <StudentInfoProfile
        student={student}
        handleChange={handleChange}
        setStudent={setStudent}
        editableField={editableField}
        setEditableField={setEditableField}
        isEditMode={isEditMode}
      />

      <ParentInfoProfile
        student={student}
        handleChange={handleChange}
        editableField={editableField}
        setEditableField={setEditableField}
        isEditMode={isEditMode}
      />

      <AddressInfoProfile
        student={student}
        handleChange={handleChange}
        editableField={editableField}
        setEditableField={setEditableField}
        isEditMode={isEditMode}
      />

      <Modal
        open={transferModalOpen}
        title="সেশন ট্রান্সফার"
        onClose={() => setTransferModalOpen(false)}
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            বর্তমান সেশন:{" "}
            <span className="font-medium text-gray-700 dark:text-slate-300">
              {student.academic_year}
            </span>{" "}
            — এই শিক্ষার্থীকে সরাসরি নতুন সেশনে নিয়ে যাওয়া হবে, রোল স্বয়ংক্রিয়ভাবে নতুন করে
            বসবে।
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              নতুন সেশন
            </label>
            <select
              value={transferSessionId}
              onChange={(e) => setTransferSessionId(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">নির্বাচন করুন</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isCurrent ? " (চলমান)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              রোল নম্বর (ঐচ্ছিক)
            </label>
            <input
              type="number"
              placeholder="খালি রাখলে স্বয়ংক্রিয়ভাবে পরবর্তী রোল বসবে"
              value={transferRoll}
              onChange={(e) => setTransferRoll(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              কারণ (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setTransferModalOpen(false)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={transferBusy}
            onClick={handleTransferSession}
            className="h-9 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {transferBusy ? "ট্রান্সফার হচ্ছে..." : "ট্রান্সফার করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default StudentProfilePage;
