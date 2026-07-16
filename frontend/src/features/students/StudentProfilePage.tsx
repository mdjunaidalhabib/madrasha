import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { getTenantAdminBase } from "../../utils/tenantSlug";

import ImageUploadProfile from "../../components/studentProfile/ImageUploadProfile";
import StudentInfoProfile from "../../components/studentProfile/StudentInfoProfile";
import ParentInfoProfile from "../../components/studentProfile/ParentInfoProfile";
import AddressInfoProfile from "../../components/studentProfile/AddressInfoProfile";

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

  const fetchStudent = async () => {
    if (!id) return;

    try {
      setLoading(true);

      const res = await api.get(`/students/${id}`);
      const data = res.data.data;

      setStudent(deepCopy(data));
      setOriginal(deepCopy(data));
    } catch (err) {
      console.error("FETCH STUDENT ERROR:", err);
      alert("Failed to load student");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudent();
  }, [id]);

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

    try {
      setSaving(true);

      await api.put(`/students/${id}`, changed);

      await fetchStudent();

      setIsEditMode(false);
      setEditableField(null);

      alert("Updated successfully");
    } catch (error) {
      console.error("UPDATE ERROR:", error);
      alert("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm("Are you sure to delete this student?");

    if (!confirmDelete) return;

    try {
      await api.delete(`/students/${id}`);
      alert("Deleted");
      navigate(`${adminBase}/students/list`);
    } catch (error) {
      console.error("DELETE ERROR:", error);
      alert("Delete failed");
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (!student) return <p className="p-6">No student found</p>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Student Profile</h1>

        <div className="flex gap-3">
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
