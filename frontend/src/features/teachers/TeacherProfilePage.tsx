import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

import TeacherInfoProfile from "../../components/teacherProfile/TeacherInfoProfile";
import TeacherParentInfoProfile from "../../components/teacherProfile/TeacherParentInfoProfile";
import TeacherAddressProfile from "../../components/teacherProfile/TeacherAddressProfile";
import ImageUploadProfile from "../../components/teacherProfile/ImageUploadProfile";

import ProfileQuickNav, { type QuickNavRecord } from "../../components/common/ProfileQuickNav";
import { profileActionButtonClass as actionButtonClass } from "../../components/common/profileActionStyles";

import { getTenantAdminBase } from "../../utils/tenantSlug";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { toBanglaDigits } from "../../utils/reportUtils";
import { logger } from "../../utils/logger";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";

const deepCopy = (data: any) => JSON.parse(JSON.stringify(data));

const TeacherProfilePage = () => {
  const { id, madrasaSlug = "" } = useParams();

  const navigate = useNavigate();

  const adminBase = getTenantAdminBase(madrasaSlug);

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
      .catch(() => useToastStore.getState().show("❌ Failed to load teacher", "error"))
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

      useToastStore.getState().show("✅ Teacher Updated Successfully", "success");

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

      useToastStore.getState().show("❌ Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  /* =============================
     DELETE
  ============================= */

  const handleDelete = () => {
    useConfirmStore.getState().show({
      title: "শিক্ষক মুছবেন?",
      message: "এই শিক্ষককে ট্র্যাশে সরাতে চান? পরে প্রয়োজনে ট্র্যাশ থেকে ফিরিয়ে আনা যাবে।",
      confirmText: "ট্র্যাশে সরান",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/teachers/${id}`);

          useToastStore.getState().show("🗑️ ট্র্যাশে সরানো হয়েছে", "success");

          navigate(`${adminBase}/ihtemam/all_teacher`);
        } catch {
          useToastStore.getState().show("❌ মুছে ফেলা যায়নি", "error");
        }
      },
    });
  };

  /* =============================
     QUICK NAV
  ============================= */

  const quickNavPath = useCallback(
    (teacherId: string | number) => `${adminBase}/ihtemam/${teacherId}`,
    [adminBase],
  );

  const quickNavMeta = useCallback(
    (record: QuickNavRecord) => [
      record.designation as string,
      `রেজি. ${record.registration_no ? toBanglaDigits(record.registration_no as number) : "নেই"}`,
      record.phone as string,
    ],
    [],
  );

  const quickNavSearchFields = useCallback(
    (record: QuickNavRecord) => [
      record.designation as string,
      record.phone as string,
      record.qualification as string,
    ],
    [],
  );

  // লোডিং অবস্থাতেও দেখানো হয় — এক প্রোফাইল থেকে আরেকটায় গেলে সার্চ বক্সটা
  // যেন হঠাৎ উধাও হয়ে না যায়।
  const quickNav = id ? (
    <ProfileQuickNav
      endpoint="/teachers"
      currentId={id}
      profilePath={quickNavPath}
      placeholder="অন্য শিক্ষক খুঁজুন — নাম / রেজি. / পদবি"
      ariaLabel="অন্য শিক্ষক খুঁজুন"
      metaParts={quickNavMeta}
      extraSearchFields={quickNavSearchFields}
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

  if (!teacher) return <p className="p-6 text-gray-900 dark:text-slate-100">No teacher found</p>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {quickNav}

      {/* HEADER */}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl text-gray-900 dark:text-slate-100">
          Teacher Profile
        </h1>

        <div className="flex flex-wrap items-center gap-1.5">
          {!isEditMode ? (
            <button
              onClick={() => setIsEditMode(true)}
              className={`${actionButtonClass} bg-blue-500`}
            >
              Edit
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
                Cancel
              </button>

              <button
                onClick={handleUpdate}
                disabled={!isChanged() || saving}
                className={`${actionButtonClass} ${isChanged() ? "bg-green-500" : "bg-gray-400"}`}
              >
                {saving ? "Saving..." : "Update"}
              </button>
            </>
          )}

          <button onClick={handleDelete} className={`${actionButtonClass} bg-red-500`}>
            Delete
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
