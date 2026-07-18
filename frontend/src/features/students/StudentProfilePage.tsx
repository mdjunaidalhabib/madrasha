import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { getTenantAdminBase } from "../../utils/tenantSlug";

import ImageUploadProfile from "../../components/studentProfile/ImageUploadProfile";
import StudentInfoProfile from "../../components/studentProfile/StudentInfoProfile";
import ParentInfoProfile from "../../components/studentProfile/ParentInfoProfile";
import AddressInfoProfile from "../../components/studentProfile/AddressInfoProfile";
import { logger } from "../../utils/logger";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";

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

  const fetchStudent = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      const res = await api.get(`/students/${id}`);
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
      title: "Delete Student",
      message: "Are you sure to delete this student?",
      confirmText: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/students/${id}`);
          useToastStore.getState().show("Deleted", "success");
          navigate(`${adminBase}/students/list`);
        } catch (error) {
          logger.error("DELETE ERROR:", error);
          useToastStore.getState().show("Delete failed", "error");
        }
      },
    });
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (!student) return <p className="p-6">No student found</p>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Student Profile</h1>

        <div className="flex flex-wrap gap-3">
          {!isEditMode ? (
            <button
              onClick={() => setIsEditMode(true)}
              className="rounded bg-blue-500 px-4 py-2 text-white"
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
              className="rounded bg-gray-500 px-4 py-2 text-white"
            >
              Cancel
            </button>
          )}

          {isEditMode && (
            <button
              onClick={handleUpdate}
              disabled={!isChanged() || saving}
              className={`rounded px-4 py-2 text-white ${
                isChanged() && !saving ? "bg-green-500" : "bg-gray-400"
              }`}
            >
              {saving ? "Saving..." : "Update"}
            </button>
          )}

          <button onClick={handleDelete} className="rounded bg-red-500 px-4 py-2 text-white">
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
    </div>
  );
};

export default StudentProfilePage;
