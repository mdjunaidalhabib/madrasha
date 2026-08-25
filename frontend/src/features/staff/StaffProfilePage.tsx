import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

import StaffInfoProfile from "../../components/staffProfile/StaffInfoProfile";
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

const StaffProfilePage = () => {
  const { id, madrasaSlug = "" } = useParams();

  const navigate = useNavigate();

  const adminBase = getTenantAdminBase(madrasaSlug);

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
      .catch(() => useToastStore.getState().show("❌ Failed to load staff", "error"))
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

      useToastStore.getState().show("✅ Staff Updated Successfully", "success");

      const newData = { ...original, ...changed };

      setOriginal(deepCopy(newData));
      setStaff(deepCopy(newData));

      setIsEditMode(false);
      setEditableField(null);
    } catch (error) {
      logger.error("Update failed:", error);

      useToastStore.getState().show("❌ Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    useConfirmStore.getState().show({
      title: "স্টাফ মুছবেন?",
      message: "এই স্টাফকে ট্র্যাশে সরাতে চান? পরে প্রয়োজনে ট্র্যাশ থেকে ফিরিয়ে আনা যাবে।",
      confirmText: "ট্র্যাশে সরান",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/staff/${id}`);

          useToastStore.getState().show("🗑️ ট্র্যাশে সরানো হয়েছে", "success");

          navigate(`${adminBase}/teacher_staff/all_staff`);
        } catch {
          useToastStore.getState().show("❌ মুছে ফেলা যায়নি", "error");
        }
      },
    });
  };

  const quickNavPath = useCallback(
    (staffId: string | number) => `${adminBase}/teacher_staff/staff/${staffId}`,
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

  const quickNav = id ? (
    <ProfileQuickNav
      endpoint="/staff"
      currentId={id}
      profilePath={quickNavPath}
      placeholder="অন্য স্টাফ খুঁজুন — নাম / রেজি. / পদবি"
      ariaLabel="অন্য স্টাফ খুঁজুন"
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

  if (!staff) return <p className="p-6 text-gray-900 dark:text-slate-100">No staff found</p>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {quickNav}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl text-gray-900 dark:text-slate-100">Staff Profile</h1>

        <div className="flex flex-wrap items-center gap-1.5">
          {!isEditMode ? (
            <button onClick={() => setIsEditMode(true)} className={`${actionButtonClass} bg-blue-500`}>
              Edit
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
