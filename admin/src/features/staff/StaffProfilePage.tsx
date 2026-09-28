import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

import StaffInfoProfile from "../../components/staffProfile/StaffInfoProfile";
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
import { teacherStaffText } from "../teachers/teacherStaff.text";

const deepCopy = (data: any) => JSON.parse(JSON.stringify(data));

const StaffProfilePage = () => {
  const { id } = useParams();

  const navigate = useNavigate();
  const t = useText(teacherStaffText);
  const c = useText(commonText);
  const lang = useLang();

  const [staff, setStaff] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editableField, setEditableField] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);

    api
      .get(`/staff/${id}`)
      .then((res) => {
        const data = res.data.data;

        setStaff(deepCopy(data));
        setOriginal(deepCopy(data));
      })
      .catch(() => useToastStore.getState().show(getText(teacherStaffText).loadStaffProfileFailed, "error"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;

    setStaff((prev: any) => ({
      ...prev,
      [name]: name === "gender" ? (value === "" ? null : Number(value)) : value,
    }));
  };

  const getChangedData = () => {
    const changed: any = {};

    if (!staff || !original) return changed;

    for (const key in staff) {
      if (JSON.stringify(staff[key]) !== JSON.stringify(original[key])) {
        changed[key] = staff[key];
      }
    }

    return changed;
  };

  const isChanged = () => Object.keys(getChangedData()).length > 0;

  const handleUpdate = async () => {
    if (!isChanged()) return;

    try {
      setSaving(true);

      const changed = getChangedData();

      await api.put(`/staff/${id}`, changed);

      useToastStore.getState().show(getText(teacherStaffText).staffUpdated, "success");

      const newData = { ...original, ...changed };

      setOriginal(deepCopy(newData));
      setStaff(deepCopy(newData));

      setIsEditMode(false);
      setEditableField(null);
    } catch (error) {
      logger.error("Update failed:", error);

      useToastStore.getState().show(getText(teacherStaffText).updateFailed, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    useConfirmStore.getState().show({
      title: getText(teacherStaffText).deleteStaffTitle,
      message: getText(teacherStaffText).deleteStaffMessage,
      confirmText: getText(teacherStaffText).moveToTrash,
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/staff/${id}`);

          useToastStore.getState().show(getText(teacherStaffText).movedToTrash, "success");

          navigate(`/teacher_staff/all_staff`);
        } catch {
          useToastStore.getState().show(getText(teacherStaffText).deleteFailed, "error");
        }
      },
    });
  };

  const quickNavPath = useCallback(
    (staffId: string | number) => `/teacher_staff/staff/${staffId}`,
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

  const quickNav = id ? (
    <ProfileQuickNav
      endpoint="/staff"
      currentId={id}
      profilePath={quickNavPath}
      placeholder={t.searchOtherStaff}
      ariaLabel={t.searchOtherStaffAria}
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

  if (!staff) return <p className="p-6 text-gray-900 dark:text-slate-100">{t.noStaffFound}</p>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {quickNav}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl text-gray-900 dark:text-slate-100">{t.staffProfile}</h1>

        <div className="flex flex-wrap items-center gap-1.5">
          {!isEditMode ? (
            <button onClick={() => setIsEditMode(true)} className={`${actionButtonClass} bg-blue-500`}>
              {c.edit}
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setEditableField(null);
                  setStaff(deepCopy(original));
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

      <ImageUploadProfile data={staff} setData={setStaff} isEditMode={isEditMode} folder="staff" />

      <StaffInfoProfile
        data={staff}
        handleChange={handleChange}
        setFormData={setStaff}
        editableField={editableField}
        setEditableField={setEditableField}
        isEditMode={isEditMode}
      />

      <TeacherParentInfoProfile
        data={staff}
        handleChange={handleChange}
        editableField={editableField}
        setEditableField={setEditableField}
        isEditMode={isEditMode}
      />

      <TeacherAddressProfile
        data={staff}
        handleChange={handleChange}
        editableField={editableField}
        setEditableField={setEditableField}
        isEditMode={isEditMode}
      />
    </div>
  );
};

export default StaffProfilePage;
