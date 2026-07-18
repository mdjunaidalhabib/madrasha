import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

import TeacherInfoProfile from "../../components/teacherProfile/TeacherInfoProfile";
import TeacherParentInfoProfile from "../../components/teacherProfile/TeacherParentInfoProfile";
import TeacherAddressProfile from "../../components/teacherProfile/TeacherAddressProfile";
import ImageUploadProfile from "../../components/teacherProfile/ImageUploadProfile";

import { getTenantAdminBase } from "../../utils/tenantSlug";
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
      title: "Delete Teacher",
      message: "Are you sure to delete this teacher?",
      confirmText: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/teachers/${id}`);

          useToastStore.getState().show("🗑️ Teacher Deleted", "success");

          navigate(`${adminBase}/ihtemam/all_teacher`);
        } catch {
          useToastStore.getState().show("❌ Delete failed", "error");
        }
      },
    });
  };

  /* =============================
     LOADING STATE
  ============================= */

  if (loading) return <p className="p-6">Loading...</p>;

  if (!teacher) return <p className="p-6">No teacher found</p>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Teacher Profile</h1>

        <div className="flex flex-wrap gap-3">
          {!isEditMode ? (
            <button
              onClick={() => setIsEditMode(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded"
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
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>

              <button
                onClick={handleUpdate}
                disabled={!isChanged() || saving}
                className={`px-4 py-2 rounded text-white ${
                  isChanged() ? "bg-green-500" : "bg-gray-400"
                }`}
              >
                {saving ? "Saving..." : "Update"}
              </button>
            </>
          )}

          <button onClick={handleDelete} className="bg-red-500 text-white px-4 py-2 rounded">
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
