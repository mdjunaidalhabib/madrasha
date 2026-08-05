import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import { getTenantAdminBase } from "../../utils/tenantSlug";

import ImageUploadProfile from "../../components/studentProfile/ImageUploadProfile";
import StudentInfoProfile from "../../components/studentProfile/StudentInfoProfile";
import ParentInfoProfile from "../../components/studentProfile/ParentInfoProfile";
import AddressInfoProfile from "../../components/studentProfile/AddressInfoProfile";
import { logger } from "../../utils/logger";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import AdmissionFormPrintButton from "../../components/admission/AdmissionFormPrintButton";

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
  const [expelBusy, setExpelBusy] = useState(false);

  const fetchStudent = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      const res = await cachedGet(`/students/${id}`);
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
      title: "শিক্ষার্থী মুছবেন?",
      message: "এই শিক্ষার্থীকে ট্র্যাশে সরাতে চান? পরে প্রয়োজনে ট্র্যাশ থেকে ফিরিয়ে আনা যাবে।",
      confirmText: "ট্র্যাশে সরান",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/students/${id}`);
          useToastStore.getState().show("ট্র্যাশে সরানো হয়েছে", "success");
          navigate(`${adminBase}/students/list`);
        } catch (error) {
          logger.error("DELETE ERROR:", error);
          useToastStore.getState().show("মুছে ফেলা যায়নি", "error");
        }
      },
    });
  };

  const isExpelled = Number(student?.is_active) === 0;

  const handleExpelToggle = () => {
    const expelling = !isExpelled;

    useConfirmStore.getState().show({
      title: expelling ? "শিক্ষার্থীকে বহিষ্কার করবেন?" : "বহিষ্কার বাতিল করবেন?",
      message: expelling
        ? "এই শিক্ষার্থীকে বহিষ্কার করা হবে। রেকর্ড ট্র্যাশে যাবে না, পরে চাইলে বহিষ্কার বাতিল করা যাবে।"
        : "এই শিক্ষার্থীর বহিষ্কার অবস্থা বাতিল করে আবার সক্রিয় করতে চান?",
      confirmText: expelling ? "বহিষ্কার করুন" : "সক্রিয় করুন",
      danger: expelling,
      onConfirm: async () => {
        try {
          setExpelBusy(true);
          await api.patch(`/students/${id}/expel`, { expelled: expelling });
          setStudent((prev: any) => ({ ...prev, is_active: expelling ? 0 : 1 }));
          setOriginal((prev: any) => ({ ...prev, is_active: expelling ? 0 : 1 }));
          useToastStore
            .getState()
            .show(expelling ? "বহিষ্কার করা হয়েছে" : "বহিষ্কার বাতিল করা হয়েছে", "success");
        } catch (error) {
          logger.error("EXPEL STUDENT ERROR:", error);
          useToastStore.getState().show("করা যায়নি", "error");
        } finally {
          setExpelBusy(false);
        }
      },
    });
  };

  if (loading)
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={4} />
      </div>
    );
  if (!student) return <p className="p-6">No student found</p>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Student Profile</h1>
          <span
            className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${
              isExpelled
                ? "border-red-300 bg-red-100 text-red-700"
                : "border-green-300 bg-green-100 text-green-700"
            }`}
          >
            {isExpelled ? "বহিষ্কৃত" : "সক্রিয়"}
          </span>
        </div>

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

          <AdmissionFormPrintButton
            row={student}
            className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          />

          <button
            onClick={handleExpelToggle}
            disabled={expelBusy}
            className={`rounded px-4 py-2 text-white disabled:opacity-60 ${
              isExpelled ? "bg-amber-500" : "bg-orange-600"
            }`}
          >
            {isExpelled ? "বহিষ্কার বাতিল করুন" : "বহিষ্কার করুন"}
          </button>

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
