import { useCallback, useEffect, useState } from "react";
import { cachedGet } from "../../services/api";
import {
  examInvigilatorApi,
  ExamInvigilatorAssignmentRow,
  InvigilatorType,
} from "../../services/examOperationsApi";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

type Person = { id: number; name_bn?: string; name?: string };

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const personLabel = (people: Person[], id: number) => {
  const person = people.find((p) => p.id === id);
  return person?.name_bn || person?.name || `#${id}`;
};

const ExamInvigilatorPanel = ({ examRoutineId }: { examRoutineId: number }) => {
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<ExamInvigilatorAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<InvigilatorType>("TEACHER");
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState<"CHIEF" | "ASSISTANT">("ASSISTANT");
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [teacherRes, staffRes, assignmentRes] = await Promise.all([
        cachedGet("/teachers"),
        cachedGet("/staff"),
        examInvigilatorApi.listByRoutine(examRoutineId),
      ]);
      setTeachers(normalizeArray(teacherRes));
      setStaff(normalizeArray(staffRes));
      setAssignments(normalizeArray(assignmentRes));
    } catch (err) {
      logger.error("LOAD INVIGILATOR PANEL ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, [examRoutineId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const people = type === "TEACHER" ? teachers : staff;

  const handleAssign = async () => {
    if (!personId) {
      useToastStore.getState().show("একজন শিক্ষক/স্টাফ নির্বাচন করুন", "error");
      return;
    }
    try {
      setSaving(true);
      await examInvigilatorApi.assign({
        exam_routine_id: examRoutineId,
        invigilator_type: type,
        invigilator_id: Number(personId),
        role,
      });
      useToastStore.getState().show("পরিদর্শক নিয়োগ করা হয়েছে", "success");
      setPersonId("");
      loadAll();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "নিয়োগ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await examInvigilatorApi.remove(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সরাতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <h3 className="mb-2 text-xs font-semibold text-gray-600 dark:text-slate-400">পরিদর্শক নিয়োগ</h3>

      {loading ? (
        <div className="text-xs text-gray-400">লোড হচ্ছে...</div>
      ) : (
        <>
          {assignments.length > 0 && (
            <div className="mb-2 flex flex-col gap-1">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span>
                    {personLabel(a.invigilatorType === "TEACHER" ? teachers : staff, a.invigilatorId)}{" "}
                    <span className="text-gray-500 dark:text-slate-400">
                      ({a.invigilatorType === "TEACHER" ? "শিক্ষক" : "স্টাফ"} · {a.role === "CHIEF" ? "প্রধান" : "সহকারী"})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(a.id)}
                    className="text-red-600 hover:underline dark:text-red-400"
                  >
                    সরান
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as InvigilatorType);
                setPersonId("");
              }}
              className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[110px]"
            >
              <option value="TEACHER">শিক্ষক</option>
              <option value="STAFF">স্টাফ</option>
            </select>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">নির্বাচন করুন</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_bn || p.name}
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "CHIEF" | "ASSISTANT")}
              className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[110px]"
            >
              <option value="ASSISTANT">সহকারী</option>
              <option value="CHIEF">প্রধান</option>
            </select>
            <button
              type="button"
              disabled={saving}
              onClick={handleAssign}
              className="h-8 w-full rounded-md bg-blue-600 px-3 text-xs font-medium text-white disabled:opacity-60 sm:w-auto"
            >
              নিয়োগ করুন
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ExamInvigilatorPanel;
