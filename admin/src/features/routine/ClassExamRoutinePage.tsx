import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  GraduationCap,
  Layers,
  MapPin,
  Plus,
  Trash2,
  UserRound,
  Users,
  UserCheck,
} from "lucide-react";
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
const BN_MONTHS_SHORT = [
  "জানু",
  "ফেব্রু",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্ট",
  "অক্টো",
  "নভে",
  "ডিসে",
];
const EXAM_ROUTINE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "খসড়া",
  PUBLISHED: "প্রকাশিত",
  CANCELLED: "বাতিল",
};
const EXAM_ROUTINE_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  PUBLISHED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  CANCELLED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
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

// একটাই ইনপুট/সিলেক্ট স্টাইল সবখানে — ফর্মজুড়ে একই লুক বজায় রাখতে।
const inputClass =
  "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function formatExamDateBadge(examDate: string) {
  const d = new Date(examDate);
  if (Number.isNaN(d.getTime())) return { day: "?", month: "" };
  return { day: String(d.getDate()), month: BN_MONTHS_SHORT[d.getMonth()] };
}

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

  // নির্বাচিত শ্রেণির কিতাব/বিষয় তালিকা (তালিমাত সেটিংস থেকে) — রুটিনের
  // "বিষয়" ফিল্ড এখান থেকেই বেছে নিতে হবে, আলাদা করে টাইপ করতে হয় না।
  const [classBooks, setClassBooks] = useState<{ book_id: number; book_name_bn: string }[]>([]);

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

  const loadClassBooks = useCallback(async (selectedClassId: string) => {
    if (!selectedClassId) {
      setClassBooks([]);
      return;
    }
    try {
      const res = await cachedGet(`/madrasa-books?class_id=${selectedClassId}`);
      setClassBooks(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD CLASS BOOKS ERROR:", err);
      setClassBooks([]);
    }
  }, []);

  useEffect(() => {
    loadClassBooks(classId);
  }, [classId, loadClassBooks]);

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

  // শ্রেণি ও পরীক্ষা — দুটোই নির্বাচিত না হওয়া পর্যন্ত পরীক্ষার রুটিন লোড/প্রদর্শন
  // করা হয় না, নাহলে ক্লাস বাছাই করামাত্রই সব পরীক্ষার এন্ট্রি একসাথে দেখিয়ে
  // বিভ্রান্তিকর হয়ে যায় (কোন এন্ট্রি কোন পরীক্ষার, বোঝা যায় না)।
  const loadExamRoutines = useCallback(async () => {
    if (!selectedExamId || !classId) {
      setExamRoutines([]);
      return;
    }
    try {
      setListLoading(true);
      const res = await examRoutineApi.list({
        exam_id: Number(selectedExamId),
        class_id: Number(classId),
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
    if (classForm.start_time >= classForm.end_time) {
      useToastStore
        .getState()
        .show(
          `শুরুর সময় (${classForm.start_time}) শেষের সময় (${classForm.end_time}) এর সমান বা পরে হয়ে গেছে। ` +
            `দুপুর ১২টা = 12:00, রাত ১২টা (মধ্যরাত) = 00:00 — AM/PM ঠিক আছে কিনা আবার দেখুন।`,
          "error",
        );
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
    if (examForm.start_time >= examForm.end_time) {
      useToastStore
        .getState()
        .show(
          `শুরুর সময় (${examForm.start_time}) শেষের সময় (${examForm.end_time}) এর সমান বা পরে হয়ে গেছে। ` +
            `দুপুর ১২টা = 12:00, রাত ১২টা (মধ্যরাত) = 00:00 — AM/PM ঠিক আছে কিনা আবার দেখুন।`,
          "error",
        );
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
        <div className="mb-4 inline-flex rounded-xl bg-gray-100 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTab("class")}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition ${
              tab === "class"
                ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <CalendarDays size={15} />
            ক্লাস রুটিন
          </button>
          <button
            type="button"
            onClick={() => setTab("exam")}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition ${
              tab === "exam"
                ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <ClipboardList size={15} />
            পরীক্ষার রুটিন
          </button>
        </div>

        {/* Division/Class/Exam picker (shared) */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="বিভাগ">
              <select
                value={division}
                onChange={(event) => {
                  const value = event.target.value;
                  setDivision(value);
                  loadClasses(value);
                }}
                className={inputClass}
              >
                <option value="">বিভাগ নির্বাচন করুন</option>
                {divisions.map((d) => (
                  <option key={d.division_id} value={d.division_id}>
                    {d.division_name_bn}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="শ্রেণি">
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                disabled={!division || classLoading}
                className={inputClass}
              >
                <option value="">{classLoading ? "লোড হচ্ছে..." : "শ্রেণি নির্বাচন করুন"}</option>
                {classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name_bn}
                  </option>
                ))}
              </select>
            </Field>

            {tab === "exam" && (
              <Field label="পরীক্ষা">
                <select
                  value={selectedExamId}
                  onChange={(event) => setSelectedExamId(event.target.value)}
                  disabled={!classId}
                  className={inputClass}
                >
                  <option value="">{classId ? "পরীক্ষা নির্বাচন করুন" : "প্রথমে শ্রেণি নির্বাচন করুন"}</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} — {exam.year}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </div>

        {tab === "class" ? (
          <>
            {/* Add class routine form */}
            {classId && (
              <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-slate-300">
                  <Plus size={15} className="text-blue-600 dark:text-blue-400" />
                  নতুন ক্লাস রুটিন যোগ করুন
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="বার">
                    <select
                      value={classForm.day_of_week}
                      onChange={(e) => setClassForm((p) => ({ ...p, day_of_week: e.target.value }))}
                      className={inputClass}
                    >
                      {DAY_LABELS.map((label, index) => (
                        <option key={index} value={index}>
                          {label}বার
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="বিষয়">
                    <select
                      value={classForm.subject}
                      onChange={(e) => setClassForm((p) => ({ ...p, subject: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">
                        {classBooks.length ? "বিষয় নির্বাচন করুন" : "কিতাব/বিষয় সেট করা নেই"}
                      </option>
                      {classBooks.map((book) => (
                        <option key={book.book_id} value={book.book_name_bn}>
                          {book.book_name_bn}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="শিক্ষক (ঐচ্ছিক)">
                    <select
                      value={classForm.teacher_id}
                      onChange={(e) => setClassForm((p) => ({ ...p, teacher_id: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">শিক্ষক নির্বাচন করুন</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name_bn}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="শুরুর সময়">
                    <input
                      type="time"
                      value={classForm.start_time}
                      onChange={(e) => setClassForm((p) => ({ ...p, start_time: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="শেষের সময়">
                    <input
                      type="time"
                      value={classForm.end_time}
                      onChange={(e) => setClassForm((p) => ({ ...p, end_time: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>

                  <div className="flex items-end lg:col-start-4">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleAddClassRoutine}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      <Plus size={15} />
                      যোগ করুন
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* List */}
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
              {!classId ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                  <Layers size={22} className="text-gray-300 dark:text-slate-700" />
                  রুটিন দেখতে প্রথমে বিভাগ ও শ্রেণি নির্বাচন করুন
                </div>
              ) : listLoading ? (
                <SkeletonList items={6} />
              ) : sortedClassRoutines.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                  <CalendarDays size={22} className="text-gray-300 dark:text-slate-700" />
                  এই শ্রেণিতে এখনো কোনো রুটিন যোগ করা হয়নি
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedClassRoutines.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 transition hover:border-blue-200 dark:border-slate-700 dark:hover:border-blue-800 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                          {DAY_LABELS[row.dayOfWeek]}বার
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100">
                            {row.subject}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              {row.startTime}–{row.endTime}
                            </span>
                            {row.teacher?.nameBn && (
                              <span className="inline-flex items-center gap-1">
                                <UserRound size={12} />
                                {row.teacher.nameBn}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteClassRoutine(row.id)}
                        className="flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 sm:w-auto"
                      >
                        <Trash2 size={13} />
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
              <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-slate-300">
                  <Plus size={15} className="text-blue-600 dark:text-blue-400" />
                  নতুন পরীক্ষার রুটিন যোগ করুন
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="বিষয়">
                    <select
                      value={examForm.subject}
                      onChange={(e) => setExamForm((p) => ({ ...p, subject: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">
                        {classBooks.length ? "বিষয় নির্বাচন করুন" : "কিতাব/বিষয় সেট করা নেই"}
                      </option>
                      {classBooks.map((book) => (
                        <option key={book.book_id} value={book.book_name_bn}>
                          {book.book_name_bn}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="তারিখ">
                    <input
                      type="date"
                      value={examForm.exam_date}
                      onChange={(e) => setExamForm((p) => ({ ...p, exam_date: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="শুরুর সময়">
                    <input
                      type="time"
                      value={examForm.start_time}
                      onChange={(e) => setExamForm((p) => ({ ...p, start_time: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="শেষের সময়">
                    <input
                      type="time"
                      value={examForm.end_time}
                      onChange={(e) => setExamForm((p) => ({ ...p, end_time: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="রুম নং (ফ্রি-টেক্সট, ঐচ্ছিক)">
                    <input
                      type="text"
                      placeholder="যেমনঃ ২০৩"
                      value={examForm.room_no}
                      onChange={(e) => setExamForm((p) => ({ ...p, room_no: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="রুম (তালিকা থেকে, ঐচ্ছিক)">
                    <select
                      value={examForm.room_id}
                      onChange={(e) => setExamForm((p) => ({ ...p, room_id: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">রুম নির্বাচন করুন</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="সর্বোচ্চ ধারণক্ষমতা (ঐচ্ছিক)">
                    <input
                      type="number"
                      min={0}
                      placeholder="যেমনঃ ৪০"
                      value={examForm.max_capacity}
                      onChange={(e) => setExamForm((p) => ({ ...p, max_capacity: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="স্ট্যাটাস">
                    <select
                      value={examForm.status}
                      onChange={(e) => setExamForm((p) => ({ ...p, status: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="DRAFT">খসড়া</option>
                      <option value="PUBLISHED">প্রকাশিত</option>
                      <option value="CANCELLED">বাতিল</option>
                    </select>
                  </Field>

                  <Field label="নির্দেশনা (ঐচ্ছিক)" className="sm:col-span-2 lg:col-span-3">
                    <input
                      type="text"
                      placeholder="যেমনঃ ক্যালকুলেটর সাথে আনা যাবে না"
                      value={examForm.instructions}
                      onChange={(e) => setExamForm((p) => ({ ...p, instructions: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>

                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleAddExamRoutine}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      <Plus size={15} />
                      যোগ করুন
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* List */}
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
              {!classId ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                  <Layers size={22} className="text-gray-300 dark:text-slate-700" />
                  রুটিন দেখতে প্রথমে বিভাগ ও শ্রেণি নির্বাচন করুন
                </div>
              ) : !selectedExamId ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                  <GraduationCap size={22} className="text-gray-300 dark:text-slate-700" />
                  এবার উপরে থেকে একটি পরীক্ষা নির্বাচন করুন — তাহলে এই শ্রেণির রুটিন দেখা ও যোগ করা যাবে
                </div>
              ) : listLoading ? (
                <SkeletonList items={6} />
              ) : sortedExamRoutines.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                  <ClipboardList size={22} className="text-gray-300 dark:text-slate-700" />
                  এই পরীক্ষা ও শ্রেণির জন্য এখনো কোনো রুটিন যোগ করা হয়নি
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedExamRoutines.map((row) => {
                    const dateBadge = formatExamDateBadge(row.examDate);
                    const status = row.status || "DRAFT";
                    return (
                      <div
                        key={row.id}
                        className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 transition hover:border-blue-200 dark:border-slate-700 dark:hover:border-blue-800"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                              <span className="text-sm font-bold leading-none">{dateBadge.day}</span>
                              <span className="text-[10px] leading-none">{dateBadge.month}</span>
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100">
                                  {row.subject}
                                </p>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${EXAM_ROUTINE_STATUS_STYLES[status] || EXAM_ROUTINE_STATUS_STYLES.DRAFT}`}
                                >
                                  {EXAM_ROUTINE_STATUS_LABELS[status] || status}
                                </span>
                              </div>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <Clock size={12} />
                                  {row.startTime}–{row.endTime}
                                </span>
                                {row.class?.nameBn && (
                                  <span className="inline-flex items-center gap-1">
                                    <BookOpen size={12} />
                                    {row.class.nameBn}
                                  </span>
                                )}
                                {(row.room?.name || row.roomNo) && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin size={12} />
                                    {row.room?.name || row.roomNo}
                                  </span>
                                )}
                                {row.maxCapacity != null && (
                                  <span className="inline-flex items-center gap-1">
                                    <Users size={12} />
                                    {row.maxCapacity}
                                  </span>
                                )}
                              </p>
                              {row.instructions && (
                                <p className="mt-1 flex items-start gap-1 text-xs text-gray-500 dark:text-slate-400">
                                  <CalendarClock size={12} className="mt-0.5 shrink-0" />
                                  {row.instructions}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2 sm:self-start">
                            <button
                              type="button"
                              onClick={() => setExpandedRoutineId((prev) => (prev === row.id ? null : row.id))}
                              className="flex h-8 w-full items-center justify-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 sm:w-auto"
                            >
                              <UserCheck size={13} />
                              পরিদর্শক
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExamRoutine(row.id)}
                              className="flex h-8 w-full items-center justify-center gap-1 rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 sm:w-auto"
                            >
                              <Trash2 size={13} />
                              মুছুন
                            </button>
                          </div>
                        </div>
                        {expandedRoutineId === row.id && (
                          <div className="border-t border-gray-100 pt-2 dark:border-slate-800">
                            <ExamInvigilatorPanel examRoutineId={row.id} />
                          </div>
                        )}
                      </div>
                    );
                  })}
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
