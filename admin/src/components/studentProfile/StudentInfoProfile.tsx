import { profileSectionClass, profileHeadingClass, profileValueClass } from "./profileStyles";
import { useCallback, useEffect, useState } from "react";
import Field from "./Field";
import { cachedGet } from "../../services/api";
import { type Session } from "../../services/sessionApi";
import CustomDatePicker from "@madrasha/shared-ui/src/components/ui/CustomDatePicker";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useText, commonText, useIsMadrasa, useLang, formatDate } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "../admission/admission.text";
import { studentProfileText } from "./studentProfile.text";

/* =============================
   TYPES
============================= */
type Division = {
  division_id: number;
  division_name_bn: string;
};

type ClassItem = {
  class_id: number;
  class_name_bn: string;
};

const StudentInfoProfile = ({
  student,
  handleChange,
  setStudent,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  const t = useText(admissionText);
  const pt = useText(studentProfileText);
  const c = useText(commonText);
  const isMadrasa = useIsMadrasa();
  const lang = useLang();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(false);
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(false);
    try {
      const res = await cachedGet("/sessions");
      const data = res.data?.data || res.data?.result || res.data || [];
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error("Session load error:", err);
      setSessionsError(true);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isEditMode) loadSessions();
  }, [isEditMode, loadSessions]);

  const divisionId = student.division_id || student.academicDivision;
  const availableSessions = sessions.filter(
    (session) => session.divisionId == null || String(session.divisionId) === String(divisionId),
  );
  const selectedSessionId = student.session_id ?? availableSessions.find(
    (session) => session.name === student.academic_year,
  )?.id ?? "";

  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const res = await cachedGet("/madrasa-divisions");
        const data = res.data?.data || res.data?.result || res.data || [];
        setDivisions(Array.isArray(data) ? data : []);
      } catch (err) {
        logger.error("Division load error:", err);
        setDivisions([]);
      }
    };

    fetchDivisions();
  }, []);

  useEffect(() => {
    const divisionId = student.division_id || student.academicDivision;
    if (!divisionId) return;

    const fetchClasses = async () => {
      try {
        const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
        const data = res.data?.data || res.data?.result || res.data || [];
        setClasses(Array.isArray(data) ? data : []);
      } catch (err) {
        logger.error("Class load error:", err);
        setClasses([]);
      }
    };

    fetchClasses();
  }, [student.division_id, student.academicDivision]);

  useEffect(() => {
    if (!student?.dob) return;

    const d = new Date(student.dob);
    const today = new Date();

    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }

    setStudent((prev: any) => (prev.age === age ? prev : { ...prev, age }));
  }, [setStudent, student.dob]);

  useEffect(() => {
    if (!student) return;

    setStudent((prev: any) => {
      const divisionId = prev.division_id || prev.academicDivision;
      const classId = prev.class_id || prev.currentClass;
      const previousClassId = prev.previous_class_id || prev.previousClass;

      if (
        prev.division_id === divisionId &&
        prev.class_id === classId &&
        prev.previous_class_id === previousClassId
      ) {
        return prev;
      }

      return {
        ...prev,
        division_id: divisionId,
        class_id: classId,
        previous_class_id: previousClassId,
      };
    });
  }, [
    setStudent,
    student,
    student?.academicDivision,
    student?.class_id,
    student?.currentClass,
    student?.division_id,
    student?.previousClass,
    student?.previous_class_id,
  ]);

  const getGenderName = (gender: any) => {
    if (gender == 1) return t.male;
    if (gender == 2) return t.female;
    return pt.notAvailable;
  };

  const getDivisionName = (id: any) => {
    const div = divisions.find((d) => d.division_id == id);
    return div?.division_name_bn || pt.notAvailable;
  };

  const getClassName = (id: any) => {
    const cls = classes.find((c) => c.class_id == id);
    return cls?.class_name_bn || pt.notAvailable;
  };

  return (
    <div className={profileSectionClass}>
      <h2 className={profileHeadingClass}>{t.studentInfo}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        <Field
          label={pt.nameBn}
          name="name_bn"
          value={student.name_bn || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          scriptLang="bn"
        />

        <Field
          label={pt.registrationNo}
          name="registration_no"
          value={student.registration_no || ""}
          isEditMode={false}
        />

        <Field
          label={pt.rollAuto}
          name="roll"
          value={student.roll || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode && student.roll != null}
          numeric
        />

        {isMadrasa && (
          <Field
            label={t.studentNameAr}
            name="arabic_name"
            value={student.arabic_name || ""}
            onChange={handleChange}
            editableField={editableField}
            setEditableField={setEditableField}
            isEditMode={isEditMode}
            scriptLang="ar"
          />
        )}

        <Field
          label={t.studentNameEn}
          name="name_en"
          value={student.name_en || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          scriptLang="en"
        />

        <Field
          label={pt.studentNid}
          name="nid"
          value={student.nid || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          numeric
        />

        {/* GENDER */}
        <div>
          <label className="text-sm text-gray-500 dark:text-slate-400">{t.gender}</label>

          {isEditMode ? (
            <select
              name="gender"
              value={student.gender ?? ""}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{pt.selectGender}</option>
              <option value={1}>{t.male}</option>
              <option value={2}>{t.female}</option>
            </select>
          ) : (
            <p className={profileValueClass}>{getGenderName(student.gender)}</p>
          )}
        </div>

        {isEditMode ? <CustomDatePicker
          label={t.dob}
          value={student.dob}
          isEditMode={isEditMode}
          onChange={(date) =>
            setStudent((prev: any) => ({
              ...prev,
              dob: date,
            }))
          }
        /> : <div className="min-w-0">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t.dob}</p>
          <p className={profileValueClass}>{student.dob ? formatDate(student.dob, lang) : pt.notAvailable}</p>
        </div>}

        <Field label={t.age} name="age" value={student.age || ""} isEditMode={false} />

        {/* DIVISION */}
        <div>
          <label className="text-sm text-gray-500 dark:text-slate-400">{t.division}</label>

          {isEditMode ? (
            <select
              name="division_id"
              value={student.division_id || student.academicDivision || ""}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{pt.selectDivision}</option>
              {divisions.map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>
          ) : (
            <p className={profileValueClass}>
              {getDivisionName(student.division_id || student.academicDivision)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="student-academic-session" className="text-sm text-gray-500 dark:text-slate-400">{pt.academicYear}</label>
          {isEditMode ? (
            <>
              <select
                id="student-academic-session"
                name="session_id"
                value={selectedSessionId}
                disabled={sessionsLoading || sessionsError}
                onChange={(event) => {
                  const session = availableSessions.find((item) => String(item.id) === event.target.value);
                  if (!session) return;
                  setStudent((previous: any) => ({ ...previous, session_id: session.id, academic_year: session.name }));
                }}
                className="border p-2 rounded w-full disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="" disabled>{sessionsLoading ? c.loading : pt.selectAcademicYear}</option>
                {selectedSessionId !== "" && !availableSessions.some((session) => String(session.id) === String(selectedSessionId)) && (
                  <option value={selectedSessionId} disabled>{student.academic_year || pt.notAvailable}</option>
                )}
                {availableSessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
              </select>
              {sessionsError ? (
                <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {pt.sessionsFailed}{" "}<button type="button" onClick={loadSessions} className="underline">{pt.retrySessions}</button>
                </p>
              ) : <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{pt.academicYearHelp}</p>}
            </>
          ) : <p className={profileValueClass}>{student.academic_year || pt.notAvailable}</p>}
        </div>

        {/* PREVIOUS CLASS */}
        <div>
          <label className="text-sm text-gray-500 dark:text-slate-400">{t.previousClass}</label>

          {isEditMode ? (
            <select
              name="previous_class_id"
              value={student.previous_class_id || student.previousClass || ""}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t.previousClass}</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>
          ) : (
            <p className={profileValueClass}>
              {getClassName(student.previous_class_id || student.previousClass)}
            </p>
          )}
        </div>

        {/* CURRENT CLASS */}
        <div>
          <label className="text-sm text-gray-500 dark:text-slate-400">{t.currentClass}</label>

          {isEditMode ? (
            <select
              name="class_id"
              value={student.class_id || student.currentClass || ""}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t.currentClass}</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>
          ) : (
            <p className={profileValueClass}>
              {getClassName(student.class_id || student.currentClass)}
            </p>
          )}
        </div>

        <Field
          label={t.previousInstitution}
          name="previous_institution"
          value={student.previous_institution || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
        />

        <Field
          label={t.previousResult}
          name="previous_result"
          value={student.previous_result || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
        />

        {/* BLOOD GROUP */}
        <div>
          <label className="text-sm text-gray-500 dark:text-slate-400">{t.bloodGroup}</label>

          {isEditMode ? (
            <select
              name="blood_group"
              value={student.blood_group ?? ""}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{c.select}</option>
              {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          ) : (
            <p className={profileValueClass}>
              {student.blood_group || pt.notAvailable}
            </p>
          )}
        </div>

        {/* RESIDENCY TYPE */}
        <div>
          <label className="text-sm text-gray-500 dark:text-slate-400">{t.residency}</label>

          {isEditMode ? (
            <select
              name="residency_type"
              value={student.residency_type ?? ""}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{c.select}</option>
              <option value={1}>{t.residential}</option>
              <option value={2}>{t.nonResidential}</option>
            </select>
          ) : (
            <p className={profileValueClass}>
              {Number(student.residency_type) === 1
                ? t.residential
                : Number(student.residency_type) === 2
                  ? t.nonResidential
                  : pt.notAvailable}
            </p>
          )}
        </div>

        {/* IS ORPHAN */}
        <div>
          <label className="text-sm text-gray-500 dark:text-slate-400">{t.orphan}</label>

          {isEditMode ? (
            <select
              name="is_orphan"
              value={Number(student.is_orphan) === 1 ? "yes" : "no"}
              onChange={(e) =>
                setStudent((prev: any) => ({
                  ...prev,
                  is_orphan: e.target.value === "yes" ? 1 : 0,
                }))
              }
              className="border p-2 rounded w-full dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="no">{c.no}</option>
              <option value="yes">{c.yes}</option>
            </select>
          ) : (
            <p className={profileValueClass}>
              {Number(student.is_orphan) === 1 ? c.yes : c.no}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentInfoProfile;
