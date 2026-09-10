import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedGet } from "../../services/api";
import { classRoutineApi, examRoutineApi } from "../../services/phase1Api";
import { examRoomApi, ExamRoomRow } from "../../services/examOperationsApi";
import ExamInvigilatorPanel from "../exam-operations/ExamInvigilatorPanel";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string };
type Teacher = { id: number; name_bn: string };
type Exam = { id: number; name: string; year: string | number };

type ClassRoutineRow = {
  id: number;
  classId: number;
  dayOfWeek: number;
  subject: string;
  teacherId?: number | null;
  startTime: string;
  endTime: string;
  class?: { nameBn?: string };
  teacher?: { nameBn?: string } | null;
};

type ExamRoutineRow = {
  id: number;
  examId: number;
  classId: number;
  subject: string;
  examDate: string;
  startTime: string;
  endTime: string;
  roomNo?: string | null;
  roomId?: number | null;
  maxCapacity?: number | null;
  status?: string;
  instructions?: string | null;
  class?: { nameBn?: string };
  exam?: { name?: string; year?: string | number };
  room?: { name?: string } | null;
};

const DAY_LABELS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
const EXAM_ROUTINE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "খসড়া",
  PUBLISHED: "প্রকাশিত",
  CANCELLED: "বাতিল",
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyClassForm = { day_of_week: "0", subject: "", teacher_id: "", start_time: "", end_time: "" };
const emptyExamForm = {
  subject: "",
  exam_date: "",
  start_time: "",
  end_time: "",
  room_no: "",
  room_id: "",
  max_capacity: "",
  status: "DRAFT",
  instructions: "",
};

const ClassExamRoutinePage = () => {
  const [tab, setTab] = useState<"class" | "exam">("class");

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [rooms, setRooms] = useState<ExamRoomRow[]>([]);
  const [expandedRoutineId, setExpandedRoutineId] = useState<number | null>(null);

  // shared division/class picker
  const [division, setDivision] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [classLoading, setClassLoading] = useState(false);

  const [selectedExamId, setSelectedExamId] = useState("");

  const [classRoutines, setClassRoutines] = useState<ClassRoutineRow[]>([]);
  const [examRoutines, setExamRoutines] = useState<ExamRoutineRow[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [classForm, setClassForm] = useState(emptyClassForm);
  const [examForm, setExamForm] = useState(emptyExamForm);
  const [saving, setSaving] = useState(false);

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD DIVISIONS ERROR:", err);
      setDivisions([]);
    }
  }, []);

  const loadTeachers = useCallback(async () => {
    try {
      const res = await cachedGet("/teachers");
      setTeachers(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD TEACHERS ERROR:", err);
      setTeachers([]);
    }
  }, []);

  const loadExams = useCallback(async () => {
    try {
      const res = await cachedGet("/exams", { params: { active_only: true } });
      setExams(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD EXAMS ERROR:", err);
      setExams([]);
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const res = await examRoomApi.list(true);
      setRooms(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD EXAM ROOMS ERROR:", err);
      setRooms([]);
    }
  }, []);

  useEffect(() => {
    loadDivisions();
    loadTeachers();
    loadExams();
    loadRooms();
  }, [loadDivisions, loadTeachers, loadExams, loadRooms]);

  const loadClasses = async (divisionId: string) => {
    setClassId("");
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      setClassLoading(true);
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("CLASS LOAD ERROR:", err);
      setClasses([]);
    } finally {
      setClassLoading(false);
    }
  };

  const loadClassRoutines = useCallback(async () => {
    if (!classId) {
      setClassRoutines([]);
      return;
    }
    try {
      setListLoading(true);
      const res = await classRoutineApi.list(Number(classId));
      setClassRoutines(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD CLASS ROUTINE ERROR:", err);
      setClassRoutines([]);
    } finally {
      setListLoading(false);
    }
  }, [classId]);

  const loadExamRoutines = useCallback(async () => {
    if (!selectedExamId && !classId) {
      setExamRoutines([]);
      return;
    }
    try {
      setListLoading(true);
      const res = await examRoutineApi.list({
        exam_id: selectedExamId ? Number(selectedExamId) : undefined,
        class_id: classId ? Number(classId) : undefined,
      });
      setExamRoutines(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD EXAM ROUTINE ERROR:", err);
      setExamRoutines([]);
    } finally {
      setListLoading(false);
    }
  }, [selectedExamId, classId]);

  useEffect(() => {
    if (tab === "class") loadClassRoutines();
    else loadExamRoutines();
  }, [tab, loadClassRoutines, loadExamRoutines]);

  const sortedClassRoutines = useMemo(
    () =>
      classRoutines
        .slice()
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    [classRoutines],
  );

  const sortedExamRoutines = useMemo(
    () =>
      examRoutines
        .slice()
        .sort(
          (a, b) =>
            a.examDate.localeCompare(b.examDate) || a.startTime.localeCompare(b.startTime),
        ),
    [examRoutines],
  );

  const handleAddClassRoutine = async () => {
    if (!classId) {
      useToastStore.getState().show("প্রথমে বিভাগ ও শ্রেণি নির্বাচন করুন", "error");
      return;
    }
    if (!classForm.subject.trim() || !classForm.start_time || !classForm.end_time) {
      useToastStore.getState().show("বিষয়, শুরু ও শেষ সময় দিন", "error");
      return;
    }

    try {
      setSaving(true);
      await classRoutineApi.create({
        class_id: Number(classId),
        day_of_week: Number(classForm.day_of_week),
        subject: classForm.subject.trim(),
        teacher_id: classForm.teacher_id ? Number(classForm.teacher_id) : undefined,
        start_time: classForm.start_time,
        end_time: classForm.end_time,
      });
      useToastStore.getState().show("রুটিন যোগ করা হয়েছে", "success");
      setClassForm(emptyClassForm);
      loadClassRoutines();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "রুটিন যোগ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClassRoutine = async (id: number) => {
    try {
      await classRoutineApi.remove(id);
      useToastStore.getState().show("রুটিন মুছে ফেলা হয়েছে", "success");
      setClassRoutines((prev) => prev.filter((row) => row.id !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  const handleAddExamRoutine = async () => {
    if (!selectedExamId || !classId) {
      useToastStore.getState().show("প্রথমে পরীক্ষা ও শ্রেণি নির্বাচন করুন", "error");
      return;
    }
    if (!examForm.subject.trim() || !examForm.exam_date || !examForm.start_time || !examForm.end_time) {
      useToastStore.getState().show("বিষয়, তারিখ, শুরু ও শেষ সময় দিন", "error");
      return;
    }

    try {
      setSaving(true);
      await examRoutineApi.create({
        exam_id: Number(selectedExamId),
        class_id: Number(classId),
        division_id: division ? Number(division) : undefined,
        subject: examForm.subject.trim(),
        exam_date: examForm.exam_date,
        start_time: examForm.start_time,
        end_time: examForm.end_time,
        room_no: examForm.room_no.trim() || undefined,
        room_id: examForm.room_id ? Number(examForm.room_id) : undefined,
        max_capacity: examForm.max_capacity ? Number(examForm.max_capacity) : undefined,
        status: examForm.status as any,
        instructions: examForm.instructions.trim() || undefined,
      });
      useToastStore.getState().show("পরীক্ষার রুটিন যোগ করা হয়েছে", "success");
      setExamForm(emptyExamForm);
      loadExamRoutines();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "রুটিন যোগ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExamRoutine = async (id: number) => {
    try {
      await examRoutineApi.remove(id);
      useToastStore.getState().show("রুটিন মুছে ফেলা হয়েছে", "success");
      setExamRoutines((prev) => prev.filter((row) => row.id !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">ক্লাস ও পরীক্ষার রুটিন</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">সাপ্তাহিক ক্লাস রুটিন ও পরীক্ষার সময়সূচি তৈরি করুন</p>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("class")}
            className={`h-9 rounded-md px-4 text-sm font-medium transition ${
              tab === "class" ? "bg-blue-600 text-white" : "bg-white text-gray-600 shadow-sm dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            ক্লাস রুটিন
          </button>
          <button
            type="button"
            onClick={() => setTab("exam")}
            className={`h-9 rounded-md px-4 text-sm font-medium transition ${
              tab === "exam" ? "bg-blue-600 text-white" : "bg-white text-gray-600 shadow-sm dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            পরীক্ষার রুটিন
          </button>
        </div>

        {/* Division/Class picker (shared) */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={division}
              onChange={(event) => {
                const value = event.target.value;
                setDivision(value);
                loadClasses(value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">বিভাগ নির্বাচন করুন</option>
              {divisions.map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>

            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={!division || classLoading}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 sm:w-[180px]"
            >
              <option value="">{classLoading ? "লোড হচ্ছে..." : "শ্রেণি নির্বাচন করুন"}</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>

            {tab === "exam" && (
              <select
                value={selectedExamId}
                onChange={(event) => setSelectedExamId(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[200px]"
              >
                <option value="">পরীক্ষা নির্বাচন করুন</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} — {exam.year}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {tab === "class" ? (
          <>
            {/* Add class routine form */}
            {classId && (
              <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
                <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">নতুন ক্লাস রুটিন যোগ করুন</h2>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <select
                    value={classForm.day_of_week}
                    onChange={(e) => setClassForm((p) => ({ ...p, day_of_week: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[110px]"
                  >
                    {DAY_LABELS.map((label, index) => (
                      <option key={index} value={index}>
                        {label}বার
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="বিষয়"
                    value={classForm.subject}
                    onChange={(e) => setClassForm((p) => ({ ...p, subject: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
                  />

                  <select
                    value={classForm.teacher_id}
                    onChange={(e) => setClassForm((p) => ({ ...p, teacher_id: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
                  >
                    <option value="">শিক্ষক (ঐচ্ছিক)</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name_bn}
                      </option>
                    ))}
                  </select>

                  <input
                    type="time"
                    value={classForm.start_time}
                    onChange={(e) => setClassForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[110px]"
                  />
                  <input
                    type="time"
                    value={classForm.end_time}
                    onChange={(e) => setClassForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[110px]"
                  />

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleAddClassRoutine}
                    className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                  >
                    যোগ করুন
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
              {!classId ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                  রুটিন দেখতে প্রথমে বিভাগ ও শ্রেণি নির্বাচন করুন
                </div>
              ) : listLoading ? (
                <SkeletonList items={6} />
              ) : sortedClassRoutines.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                  এই শ্রেণিতে এখনো কোনো রুটিন যোগ করা হয়নি
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedClassRoutines.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-1 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"
                    >
                      <div className="text-sm">
                        <span className="font-semibold text-gray-800 dark:text-slate-100">
                          {DAY_LABELS[row.dayOfWeek]}বার
                        </span>{" "}
                        <span className="text-gray-600 dark:text-slate-400">
                          {row.startTime}–{row.endTime}
                        </span>{" "}
                        <span className="font-medium text-gray-800 dark:text-slate-200">{row.subject}</span>
                        {row.teacher?.nameBn && (
                          <span className="text-gray-500 dark:text-slate-400"> · {row.teacher.nameBn}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteClassRoutine(row.id)}
                        className="h-8 w-full rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 sm:w-auto"
                      >
                        মুছুন
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Add exam routine form */}
            {selectedExamId && classId && (
              <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
                <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
                  নতুন পরীক্ষার রুটিন যোগ করুন
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <input
                    type="text"
                    placeholder="বিষয়"
                    value={examForm.subject}
                    onChange={(e) => setExamForm((p) => ({ ...p, subject: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
                  />
                  <input
                    type="date"
                    value={examForm.exam_date}
                    onChange={(e) => setExamForm((p) => ({ ...p, exam_date: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[150px]"
                  />
                  <input
                    type="time"
                    value={examForm.start_time}
                    onChange={(e) => setExamForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[110px]"
                  />
                  <input
                    type="time"
                    value={examForm.end_time}
                    onChange={(e) => setExamForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[110px]"
                  />
                  <input
                    type="text"
                    placeholder="রুম নং (ঐচ্ছিক, ফ্রি-টেক্সট)"
                    value={examForm.room_no}
                    onChange={(e) => setExamForm((p) => ({ ...p, room_no: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[150px]"
                  />
                  <select
                    value={examForm.room_id}
                    onChange={(e) => setExamForm((p) => ({ ...p, room_id: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
                  >
                    <option value="">রুম (তালিকা থেকে, ঐচ্ছিক)</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    placeholder="সর্বোচ্চ ধারণক্ষমতা"
                    value={examForm.max_capacity}
                    onChange={(e) => setExamForm((p) => ({ ...p, max_capacity: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[140px]"
                  />
                  <select
                    value={examForm.status}
                    onChange={(e) => setExamForm((p) => ({ ...p, status: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[120px]"
                  >
                    <option value="DRAFT">খসড়া</option>
                    <option value="PUBLISHED">প্রকাশিত</option>
                    <option value="CANCELLED">বাতিল</option>
                  </select>
                  <input
                    type="text"
                    placeholder="নির্দেশনা (ঐচ্ছিক)"
                    value={examForm.instructions}
                    onChange={(e) => setExamForm((p) => ({ ...p, instructions: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[200px]"
                  />

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleAddExamRoutine}
                    className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                  >
                    যোগ করুন
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
              {!selectedExamId && !classId ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                  রুটিন দেখতে প্রথমে পরীক্ষা এবং/অথবা শ্রেণি নির্বাচন করুন
                </div>
              ) : listLoading ? (
                <SkeletonList items={6} />
              ) : sortedExamRoutines.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                  এখনো কোনো পরীক্ষার রুটিন যোগ করা হয়নি
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedExamRoutines.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-1 rounded-lg border border-gray-200 p-3 dark:border-slate-700"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm">
                          <span className="font-semibold text-gray-800 dark:text-slate-100">
                            {String(row.examDate).slice(0, 10)}
                          </span>{" "}
                          <span className="text-gray-600 dark:text-slate-400">
                            {row.startTime}–{row.endTime}
                          </span>{" "}
                          <span className="font-medium text-gray-800 dark:text-slate-200">{row.subject}</span>
                          {row.class?.nameBn && (
                            <span className="text-gray-500 dark:text-slate-400"> · {row.class.nameBn}</span>
                          )}
                          {(row.room?.name || row.roomNo) && (
                            <span className="text-gray-500 dark:text-slate-400"> · রুম {row.room?.name || row.roomNo}</span>
                          )}
                          {row.maxCapacity != null && (
                            <span className="text-gray-500 dark:text-slate-400"> · ধারণক্ষমতা {row.maxCapacity}</span>
                          )}
                          {row.status && row.status !== "DRAFT" && (
                            <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                              {EXAM_ROUTINE_STATUS_LABELS[row.status] || row.status}
                            </span>
                          )}
                          {row.instructions && (
                            <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{row.instructions}</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedRoutineId((prev) => (prev === row.id ? null : row.id))}
                            className="h-8 w-full rounded-md border border-blue-300 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 sm:w-auto"
                          >
                            পরিদর্শক
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExamRoutine(row.id)}
                            className="h-8 w-full rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 sm:w-auto"
                          >
                            মুছুন
                          </button>
                        </div>
                      </div>
                      {expandedRoutineId === row.id && <ExamInvigilatorPanel examRoutineId={row.id} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClassExamRoutinePage;
