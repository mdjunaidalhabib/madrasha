import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Save } from "lucide-react";
import { useText, getText, useLang, localizeDigits, commonText } from "@madrasha/shared-ui/src/i18n";
import { studentProfilePageText } from "./StudentProfilePage.text";
import { useNavigate } from "react-router-dom";
import { useUnsavedChangesGuard } from "@madrasha/shared-ui/src/navigation/unsavedChanges";
import { studentPath, useStudentRoute } from "./studentRoute";
import api, { cachedGet } from "../../services/api";

import ImageUploadProfile from "../../components/studentProfile/ImageUploadProfile";
import StudentInfoProfile from "../../components/studentProfile/StudentInfoProfile";
import ParentInfoProfile from "../../components/studentProfile/ParentInfoProfile";
import AlternateGuardianInfoProfile from "../../components/studentProfile/AlternateGuardianInfoProfile";
import AddressInfoProfile from "../../components/studentProfile/AddressInfoProfile";
import ProfileQuickNav, { type QuickNavRecord } from "../../components/common/ProfileQuickNav";
import "../../components/studentProfile/studentEdit.css";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import StudentProfileSkeleton from "../../components/studentProfile/StudentProfileSkeleton";
import { studentProfilePageClass } from "../../components/studentProfile/profileStyles";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { STUDENT_STATUS_BADGE_CLASS, studentStatus, studentStatusLabel } from "../../utils/studentStatus";

const deepCopy = (data: any) => JSON.parse(JSON.stringify(data));
const saveButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500";

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
  const { id, resolved } = useStudentRoute();
  const navigate = useNavigate();

  const [student, setStudent] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);

  // এই পেজটা শুধু এডিট পেজ হিসেবেই কাজ করে — টগল করে রিড-মোডে যাওয়ার দরকার নেই।
  const isEditMode = true;
  const [editableField, setEditableField] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState<string>();
  const fetchSequence = useRef(0);
  const [saving, setSaving] = useState(false);
  const fetchStudent = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    if (!id) {
      setLoading(false);
      setStudent(null);
      return;
    }

    try {
      setLoading(true);

      const res = await cachedGet(`/students/${id}`);
      if (sequence !== fetchSequence.current) return;
      const data = normalizeStudent(res.data.data);

      setStudent(deepCopy(data));
      setOriginal(deepCopy(data));
    } catch (err) {
      if (sequence !== fetchSequence.current) return;
      setStudent(null);
      logger.error("FETCH STUDENT ERROR:", err);
      useToastStore.getState().show(getText(studentProfilePageText).loadFailed, "error");
    } finally {
      if (sequence === fetchSequence.current) {
        setLoadedId(id);
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    fetchStudent();
    return () => { fetchSequence.current++; };
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
  useUnsavedChangesGuard(Boolean(id && loadedId === id && isChanged()));

  const handleUpdate = async () => {
    if (!isChanged()) return;

    const changed = getChangedData();

    // Registration numbers are managed by the server; admins may adjust rolls.
    delete changed.registration_no;

    try {
      setSaving(true);

      await api.put(`/students/${id}`, changed);

      await fetchStudent();

      setEditableField(null);

      useToastStore.getState().show(getText(studentProfilePageText).updated, "success");
    } catch (error) {
      logger.error("UPDATE ERROR:", error);
      useToastStore.getState().show((error as any)?.response?.data?.message || getText(studentProfilePageText).updateFailed, "error");
    } finally {
      setSaving(false);
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

  if (!resolved || loading || (id && loadedId !== id)) return <StudentProfileSkeleton edit />;
  if (!student) return <p className="p-6">{t.notFound}</p>;
  const status = studentStatus(student.is_active);

  return (
    <div className={`${studentProfilePageClass} student-edit-page`}>
      {quickNav}

      <div className="mb-6 mt-4 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between dark:border-slate-700">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">{t.editTitle}</p>
          <div className="flex flex-wrap items-center gap-3">
          <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{(lang === "en" ? student.name_en || student.name_bn : student.name_bn || student.name_en) || t.title}</h1>
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STUDENT_STATUS_BADGE_CLASS[status]}`}
          >
            {studentStatusLabel(student.is_active)}
          </span>
          </div>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">{t.editHint}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => navigate(studentPath(student))} disabled={saving} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{c.cancel}</button>
          <button
            onClick={handleUpdate}
            disabled={!isChanged() || saving}
            className={saveButtonClass}
          >
            <Save size={16} aria-hidden="true" />
            {saving ? c.saving : c.update}
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

      <div className={`${isChanged() ? "sticky bottom-3" : ""} z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-900/5 backdrop-blur sm:p-4 dark:border-slate-700 dark:bg-slate-900/95`}>
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400" role="status">
          {isChanged() ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : <Check size={16} className="text-teal-600" aria-hidden="true" />}
          {isChanged() ? t.unsavedChanges : t.noChanges}
        </p>
        <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
          {isChanged() && <button disabled={saving} onClick={() => { setStudent(deepCopy(original)); setEditableField(null); }} className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">{t.resetChanges}</button>}
          <button onClick={handleUpdate} disabled={!isChanged() || saving} className={saveButtonClass}><Save size={16} aria-hidden="true" />{saving ? c.saving : c.update}</button>
        </div>
      </div>

    </div>
  );
};

export default StudentProfilePage;
