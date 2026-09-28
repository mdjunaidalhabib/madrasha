import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

import TeacherInfoProfile from "../../components/teacherProfile/TeacherInfoProfile";
import TeacherParentInfoProfile from "../../components/teacherProfile/TeacherParentInfoProfile";
import TeacherAddressProfile from "../../components/teacherProfile/TeacherAddressProfile";
import ImageUploadProfile from "../../components/teacherProfile/ImageUploadProfile";

import ProfileQuickNav, { type QuickNavRecord } from "../../components/common/ProfileQuickNav";
import { profileActionButtonClass as actionButtonClass } from "../../components/common/profileActionStyles";

import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { commonText, getText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "./teacherStaff.text";

const deepCopy = (data: any) => JSON.parse(JSON.stringify(data));

const TeacherProfilePage = () => {
  const { id } = useParams();

  const navigate = useNavigate();
  const t = useText(teacherStaffText);
  const c = useText(commonText);
  const lang = useLang();

  const [teacher, setTeacher] = useState<any>(null);

  const [original, setOriginal] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);

  const [editableField, setEditableField] = useState<string | null>(null);

  /* =============================
     FETCH TEACHER
  ============================= */

  useEffect(() => {
    if (!id) return;

    setLoading(true);

    api
      .get(`/teachers/${id}`)
      .then((res) => {
        const data = res.data.data;

        setTeacher(deepCopy(data));
        setOriginal(deepCopy(data));
      })
      .catch(() => useToastStore.getState().show(getText(teacherStaffText).loadTeacherFailed, "error"))
      .finally(() => setLoading(false));
  }, [id]);

  /* =============================
     HANDLE CHANGE
  ============================= */

  const handleChange = (e: any) => {
    const { name, value } = e.target;

    setTeacher((prev: any) => ({
      ...prev,
      [name]: name === "gender" ? (value === "" ? null : Number(value)) : value,
    }));
  };

  /* =============================
     DETECT CHANGES
  ============================= */

  const getChangedData = () => {
    const changed: any = {};

    if (!teacher || !original) return changed;

    for (const key in teacher) {
      if (JSON.stringify(teacher[key]) !== JSON.stringify(original[key])) {
        changed[key] = teacher[key];
      }
    }

    return changed;
  };

  const isChanged = () => Object.keys(getChangedData()).length > 0;

  /* =============================
     UPDATE
  ============================= */

  const handleUpdate = async () => {
    if (!isChanged()) return;

    try {
      setSaving(true);

      const changed = getChangedData();

      await api.put(`/teachers/${id}`, changed);

      useToastStore.getState().show(getText(teacherStaffText).teacherUpdated, "success");

      const newData = {
        ...original,
        ...changed,
      };

      setOriginal(deepCopy(newData));
      setTeacher(deepCopy(newData));

      setIsEditMode(false);
      setEditableField(null);
    } catch (error) {
      logger.error("Update failed:", error);

      useToastStore.getState().show(getText(teacherStaffText).updateFailed, "error");
    } finally {
      setSaving(false);
    }
  };

  /* =============================
     DELETE
  ============================= */

  const handleDelete = () => {
    useConfirmStore.getState().show({
      title: getText(teacherStaffText).deleteTeacherTitle,
      message: getText(teacherStaffText).deleteTeacherMessage,
      confirmText: getText(teacherStaffText).moveToTrash,
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/teachers/${id}`);

          useToastStore.getState().show(getText(teacherStaffText).movedToTrash, "success");

          navigate(`/teacher_staff/all_teacher`);
        } catch {
          useToastStore.getState().show(getText(teacherStaffText).deleteFailed, "error");
        }
      },
    });
  };

  /* =============================
     QUICK NAV
  ============================= */

  const quickNavPath = useCallback(
    (teacherId: string | number) => `/teacher_staff/teacher/${teacherId}`,
    [],
  );

  const quickNavMeta = useCallback(
    (record: QuickNavRecord) => [
      record.designation as string,
      t.regShort(record.registration_no ? localizeDigits(record.registration_no as number, lang) : t.none),
      record.phone as string,
    ],
    [t, lang],
  );

  const quickNavSearchFields = useCallback(
    (record: QuickNavRecord) => [record.designation as string, record.qualification as string],
    [],
  );

  const quickNavPhoneFields = useCallback((record: QuickNavRecord) => [record.phone as string], []);

  // লোডিং অবস্থাতেও দেখানো হয় — এক প্রোফাইল থেকে আরেকটায় গেলে সার্চ বক্সটা
  // যেন হঠাৎ উধাও হয়ে না যায়।
  const quickNav = id ? (
    <ProfileQuickNav
      endpoint="/teachers"
      currentId={id}
      profilePath={quickNavPath}
      placeholder={t.searchOtherTeacher}
      ariaLabel={t.searchOtherTeacherAria}
      metaParts={quickNavMeta}
      extraSearchFields={quickNavSearchFields}
      phoneFields={quickNavPhoneFields}
    />
  ) : null;

  /* =============================
     LOADING STATE
  ============================= */

  if (loading)
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        {quickNav}
        <SkeletonCard lines={6} />
        <SkeletonCard lines={4} />
      </div>
    );

  if (!teacher) return <p className="p-6 text-gray-900 dark:text-slate-100">{t.noTeacherFound}</p>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {quickNav}

      {/* HEADER */}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl text-gray-900 dark:text-slate-100">
          {t.teacherProfile}
        </h1>

        <div className="flex flex-wrap items-center gap-1.5">
          {!isEditMode ? (
            <button
              onClick={() => setIsEditMode(true)}
              className={`${actionButtonClass} bg-blue-500`}
            >
              {c.edit}
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsEditMode(false);

                  setEditableField(null);

                  setTeacher(deepCopy(original));
                }}
                className={`${actionButtonClass} bg-gray-500`}
              >
                {c.cancel}
              </button>

              <button
                onClick={handleUpdate}
                disabled={!isChanged() || saving}
                className={`${actionButtonClass} ${isChanged() ? "bg-green-500" : "bg-gray-400"}`}
              >
                {saving ? c.saving : c.update}
              </button>
            </>
          )}

          <button onClick={handleDelete} className={`${actionButtonClass} bg-red-500`}>
            {c.delete}
          </button>
        </div>
      </div>

      {/* IMAGE */}

      <ImageUploadProfile data={teacher} setData={setTeacher} isEditMode={isEditMode} />

      {/* BASIC INFO */}

      <TeacherInfoProfile
        data={teacher}
        handleChange={handleChange}
        setFormData={setTeacher}
        editableField={editableField}
        setEditableField={setEditableField}
        isEditMode={isEditMode}
      />

      {/* PARENT INFO */}

      <TeacherParentInfoProfile
        data={teacher}
        handleChange={handleChange}
        editableField={editableField}
        setEditableField={setEditableField}
        isEditMode={isEditMode}
      />

      {/* ADDRESS */}

      <TeacherAddressProfile
        data={teacher}
        handleChange={handleChange}
        editableField={editableField}
        setEditableField={setEditableField}
        isEditMode={isEditMode}
      />
    </div>
  );
};

export default TeacherProfilePage;
