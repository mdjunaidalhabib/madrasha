import { useCallback, useEffect, useState } from "react";
import { useText, getText, useLang, localizeDigits, commonText } from "@madrasha/shared-ui/src/i18n";
import { studentProfilePageText } from "./StudentProfilePage.text";
import { useNavigate } from "react-router-dom";
import { studentPath, useStudentIdParam } from "./studentRoute";
import api, { cachedGet } from "../../services/api";

import ImageUploadProfile from "../../components/studentProfile/ImageUploadProfile";
import StudentInfoProfile from "../../components/studentProfile/StudentInfoProfile";
import ParentInfoProfile from "../../components/studentProfile/ParentInfoProfile";
import AlternateGuardianInfoProfile from "../../components/studentProfile/AlternateGuardianInfoProfile";
import AddressInfoProfile from "../../components/studentProfile/AddressInfoProfile";
import ProfileQuickNav, { type QuickNavRecord } from "../../components/common/ProfileQuickNav";
import {
  profileActionButtonClass as actionButtonClass,
  profileOutlineButtonClass as outlineButtonClass,
} from "../../components/common/profileActionStyles";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import AdmissionFormPrintButton from "../../components/admission/AdmissionFormPrintButton";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { sessionApi, type Session } from "../../services/sessionApi";
import { assignStudentCard } from "../../services/phase1Api";
import { STUDENT_STATUS_BADGE_CLASS, studentStatus, studentStatusLabel } from "../../utils/studentStatus";

const deepCopy = (data: any) => JSON.parse(JSON.stringify(data));

// StudentInfoProfile-এর ভেতরে dob থেকে age এবং division/class ফিল্ড
// অটো-নরমালাইজ করার useEffect আছে — সেগুলো user edit না, কিন্তু student
// state-কে original থেকে আলাদা করে দেয় বলে Update বাটন সবসময় active
// দেখাত। fetch করার সময়েই একই নরমালাইজেশন করে student ও original দুটোকেই
// সমান রাখা হচ্ছে, যাতে শুধু আসল edit হলেই isChanged() true হয়।
const computeAge = (dob: any) => {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};

const normalizeStudent = (raw: any) => {
  if (!raw) return raw;
  return {
    ...raw,
    division_id: raw.division_id || raw.academicDivision,
    class_id: raw.class_id || raw.currentClass,
    previous_class_id: raw.previous_class_id || raw.previousClass,
    age: raw.dob ? computeAge(raw.dob) : raw.age,
  };
};

const StudentProfilePage = () => {
  const t = useText(studentProfilePageText);
  const c = useText(commonText);
  const lang = useLang();
  const id = useStudentIdParam();
  const navigate = useNavigate();

  const [student, setStudent] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);

  // এই পেজটা শুধু এডিট পেজ হিসেবেই কাজ করে — টগল করে রিড-মোডে যাওয়ার দরকার নেই।
  const isEditMode = true;
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

  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardUid, setCardUid] = useState("");
  const [cardBusy, setCardBusy] = useState(false);

  const fetchStudent = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      const res = await cachedGet(`/students/${id}`);
      const data = normalizeStudent(res.data.data);

      setStudent(deepCopy(data));
      setOriginal(deepCopy(data));
    } catch (err) {
      logger.error("FETCH STUDENT ERROR:", err);
      useToastStore.getState().show(getText(studentProfilePageText).loadFailed, "error");
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

      setEditableField(null);

      useToastStore.getState().show(getText(studentProfilePageText).updated, "success");
    } catch (error) {
      logger.error("UPDATE ERROR:", error);
      useToastStore.getState().show(getText(studentProfilePageText).updateFailed, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    useConfirmStore.getState().show({
      title: t.deleteTitle,
      message: t.deleteMessage,
      confirmText: t.moveToTrash,
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/students/${id}`);
          useToastStore.getState().show(getText(studentProfilePageText).movedToTrash, "success");
          navigate(`/students`);
        } catch (error) {
          logger.error("DELETE ERROR:", error);
          useToastStore.getState().show(getText(commonText).deleteFailed, "error");
        }
      },
    });
  };

  const status = studentStatus(student?.is_active);
  const isExpelled = status === "EXPELLED";
  const isInactive = status === "INACTIVE";

  const handleInactiveToggle = () => {
    const deactivating = !isInactive;

    useConfirmStore.getState().show({
      title: deactivating ? t.deactivateTitle : t.activateTitle,
      message: deactivating
        ? t.deactivateMessage
        : t.activateMessage,
      confirmText: deactivating ? t.deactivate : t.activate,
      onConfirm: async () => {
        try {
          setExpelBusy(true);
          await api.patch(`/students/${id}/inactive`, { inactive: deactivating });
          const next = deactivating ? 2 : 1;
          setStudent((prev: any) => ({ ...prev, is_active: next }));
          setOriginal((prev: any) => ({ ...prev, is_active: next }));
          useToastStore
            .getState()
            .show(deactivating ? getText(studentProfilePageText).deactivated : getText(studentProfilePageText).activated, "success");
        } catch (error) {
          logger.error("SET STUDENT INACTIVE ERROR:", error);
          useToastStore.getState().show(getText(studentProfilePageText).actionFailed, "error");
        } finally {
          setExpelBusy(false);
        }
      },
    });
  };

  const handleExpelToggle = () => {
    const expelling = !isExpelled;

    useConfirmStore.getState().show({
      title: expelling ? t.expelTitle : t.unexpelTitle,
      message: expelling
        ? t.expelMessage
        : t.unexpelMessage,
      confirmText: expelling ? t.expel : t.activate,
      danger: expelling,
      onConfirm: async () => {
        try {
          setExpelBusy(true);
          await api.patch(`/students/${id}/expel`, { expelled: expelling });
          setStudent((prev: any) => ({ ...prev, is_active: expelling ? 0 : 1 }));
          setOriginal((prev: any) => ({ ...prev, is_active: expelling ? 0 : 1 }));
          useToastStore
            .getState()
            .show(expelling ? getText(studentProfilePageText).expelled : getText(studentProfilePageText).unexpelled, "success");
        } catch (error) {
          logger.error("EXPEL STUDENT ERROR:", error);
          useToastStore.getState().show(getText(studentProfilePageText).actionFailed, "error");
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
      const res = await sessionApi.list({ activeOnly: true });
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
      useToastStore.getState().show(getText(studentProfilePageText).selectSession, "error");
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
        .show(getText(studentProfilePageText).transferDone(String(newRoll ?? "-")), "success");
      setTransferModalOpen(false);
      fetchStudent();
    } catch (error: any) {
      const msg = error?.response?.data?.message || getText(studentProfilePageText).transferFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setTransferBusy(false);
    }
  };

  const openCardModal = () => {
    setCardUid("");
    setCardModalOpen(true);
  };

  const handleAssignCard = async () => {
    if (!cardUid.trim()) {
      useToastStore.getState().show(getText(studentProfilePageText).enterCardUid, "error");
      return;
    }
    try {
      setCardBusy(true);
      await assignStudentCard(Number(id), cardUid.trim());
      useToastStore.getState().show(getText(studentProfilePageText).cardAssigned, "success");
      setCardModalOpen(false);
      fetchStudent();
    } catch (error: any) {
      const msg = error?.response?.data?.message || getText(studentProfilePageText).cardFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setCardBusy(false);
    }
  };

  const quickNavPath = useCallback(
    // রেজি. নং থাকলে সেটাই URL-এ, না থাকলে `a-<id>`।
    (studentId: string | number, record?: QuickNavRecord) =>
      studentPath({ id: studentId, registration_no: record?.registration_no }, "/edit"),
    [],
  );

  const quickNavMeta = useCallback(
    (record: QuickNavRecord) => [
      (record.current_class || record.class_name || record.class) as string,
      t.roll(record.roll ? localizeDigits(record.roll as number, lang) : t.none),
      t.reg(record.registration_no ? localizeDigits(record.registration_no as number, lang) : t.none),
    ],
    [t, lang],
  );

  const quickNavSearchFields = useCallback(
    (record: QuickNavRecord) => [
      record.current_class as string,
      record.class_name as string,
      record.father_name as string,
    ],
    [],
  );

  const quickNavPhoneFields = useCallback(
    (record: QuickNavRecord) => [record.guardian_phone as string],
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
      placeholder={t.searchOther}
      ariaLabel={t.searchOtherAria}
      metaParts={quickNavMeta}
      extraSearchFields={quickNavSearchFields}
      phoneFields={quickNavPhoneFields}
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
  if (!student) return <p className="p-6">{t.notFound}</p>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {quickNav}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">{t.title}</h1>
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STUDENT_STATUS_BADGE_CLASS[status]}`}
          >
            {studentStatusLabel(student.is_active)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleUpdate}
            disabled={!isChanged() || saving}
            className={`${actionButtonClass} ${isChanged() && !saving ? "bg-green-500" : "bg-gray-400"}`}
          >
            {saving ? c.saving : c.update}
          </button>

          <AdmissionFormPrintButton row={student} className={outlineButtonClass} />

          <button onClick={openTransferModal} className={`${actionButtonClass} bg-indigo-600`}>
            {t.sessionTransfer}
          </button>

          <button onClick={openCardModal} className={`${actionButtonClass} bg-teal-600`}>
            {t.assignCard}
          </button>

          {!isExpelled && (
            <button
              onClick={handleInactiveToggle}
              disabled={expelBusy}
              className={`${actionButtonClass} ${isInactive ? "bg-green-600" : "bg-slate-500"}`}
            >
              {isInactive ? t.activate : t.inactive}
            </button>
          )}

          <button
            onClick={handleExpelToggle}
            disabled={expelBusy}
            className={`${actionButtonClass} ${isExpelled ? "bg-amber-500" : "bg-orange-600"}`}
          >
            {isExpelled ? t.unexpel : t.expelShort}
          </button>

          <button onClick={handleDelete} className={`${actionButtonClass} bg-red-500`}>
            {c.delete}
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

      <AlternateGuardianInfoProfile
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
        title={t.sessionTransfer}
        onClose={() => setTransferModalOpen(false)}
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t.currentSession}{" "}
            <span className="font-medium text-gray-700 dark:text-slate-300">
              {student.academic_year}
            </span>{" "}
            {t.transferNote}
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {t.newSession}
            </label>
            <select
              value={transferSessionId}
              onChange={(e) => setTransferSessionId(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{c.select}</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isActive ? t.activeSuffix : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {t.rollOptional}
            </label>
            <input
              type="number"
              placeholder={t.rollPlaceholder}
              value={transferRoll}
              onChange={(e) => setTransferRoll(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {t.reasonOptional}
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
            {c.cancel}
          </button>
          <button
            type="button"
            disabled={transferBusy}
            onClick={handleTransferSession}
            className="h-9 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {transferBusy ? t.transferring : t.transfer}
          </button>
        </div>
      </Modal>

      <Modal
        open={cardModalOpen}
        title={t.assignCard}
        onClose={() => setCardModalOpen(false)}
      >
        <div className="flex flex-col gap-3">
          {student.card_uid && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t.currentCard}{" "}
              <span className="font-medium text-gray-700 dark:text-slate-300">
                {student.card_uid}
              </span>
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t.tapCard}
          </p>
          <input
            type="text"
            value={cardUid}
            onChange={(e) => setCardUid(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAssignCard();
            }}
            autoFocus
            className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setCardModalOpen(false)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {c.cancel}
          </button>
          <button
            type="button"
            disabled={cardBusy}
            onClick={handleAssignCard}
            className="h-9 rounded-md bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {cardBusy ? c.saving : c.save}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default StudentProfilePage;
