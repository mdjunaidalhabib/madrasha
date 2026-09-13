import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  Eye,
  GraduationCap,
  Layers,
  MapPin,
  Plus,
  Printer,
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
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { ReportBackground, ReportBrandHeader, ReportWatermark } from "../../components/Report/ReportBranding";

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

type ClassRoutineOverviewRow = {
  classId: number;
  className: string | null;
  divisionId: number | null;
  divisionName: string | null;
  periodCount: number;
};

type ExamRoutineOverviewRow = {
  examId: number;
  examName: string;
  examYear: string | number;
  classId: number;
  className: string | null;
  divisionId: number | null;
  divisionName: string | null;
  subjectCount: number;
  status: "NONE" | "DRAFT" | "PUBLISHED" | "CANCELLED" | "MIXED";
};

const DAY_LABELS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
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

// পেজে ঢুকলেই "কোন ক্লাসের রুটিন তৈরি হয়েছে/হয়নি" — এই ওভারভিউ বোঝাতে
// DRAFT/PUBLISHED/CANCELLED-এর পাশাপাশি "রুটিন নেই" ও "আংশিক" (মিশ্র স্ট্যাটাস)
// দুটো বাড়তি অবস্থাও লাগে, তাই আলাদা ম্যাপ (রেজাল্ট প্যানেলের ওভারভিউ পেজের
// ধাঁচেই)।
const OVERVIEW_STATUS_LABELS: Record<string, string> = {
  ...EXAM_ROUTINE_STATUS_LABELS,
  NONE: "রুটিন নেই",
  MIXED: "আংশিক",
};
const OVERVIEW_STATUS_STYLES: Record<string, string> = {
  ...EXAM_ROUTINE_STATUS_STYLES,
  NONE: "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400",
  MIXED: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
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

// পরীক্ষার রুটিনে কোনো dayOfWeek কলাম নেই (শুধু examDate থাকে) — তাই "বার"
// তারিখ থেকেই বের করতে হয়।
function getExamDayLabel(examDate: string) {
  const d = new Date(examDate);
  if (Number.isNaN(d.getTime())) return "—";
  return `${DAY_LABELS[d.getDay()]}বার`;
}

function formatExamDateFull(examDate: string) {
  const d = new Date(examDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("bn-BD", { day: "numeric", month: "long" });
}

const ClassExamRoutinePage = () => {
  const [tab, setTab] = useState<"class" | "exam">("class");

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [rooms, setRooms] = useState<ExamRoomRow[]>([]);
  const [expandedRoutineId, setExpandedRoutineId] = useState<number | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // পেজে ঢুকলেই (কোনো বিভাগ/শ্রেণি নির্বাচনের আগেই) কোন ক্লাসের রুটিন তৈরি
  // হয়েছে/হয়নি তা এক নজরে দেখানোর জন্য — রেজাল্ট প্যানেলের ওভারভিউ পেজের
  // মতোই।
  const [classOverview, setClassOverview] = useState<ClassRoutineOverviewRow[]>([]);
  const [examOverview, setExamOverview] = useState<ExamRoutineOverviewRow[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

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

  const loadOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      const [classRes, examRes] = await Promise.all([classRoutineApi.overview(), examRoutineApi.overview()]);
      setClassOverview(normalizeArray(classRes));
      setExamOverview(normalizeArray(examRes));
    } catch (err) {
      logger.error("LOAD ROUTINE OVERVIEW ERROR:", err);
      setClassOverview([]);
      setExamOverview([]);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDivisions();
    loadTeachers();
    loadExams();
    loadRooms();
    loadOverview();
  }, [loadDivisions, loadTeachers, loadExams, loadRooms, loadOverview]);

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

  // এই শ্রেণি ও পরীক্ষার সবগুলো বিষয়ের স্ট্যাটাস একই কিনা — একই হলে সেই
  // মান দেখানো হয়, না হলে "MIXED" (তখন ড্রপডাউনে ফাঁকা দেখাবে)।
  const classExamStatus = useMemo(() => {
    if (!examRoutines.length) return "DRAFT";
    const first = examRoutines[0].status || "DRAFT";
    return examRoutines.every((r) => (r.status || "DRAFT") === first) ? first : "MIXED";
  }, [examRoutines]);

  // ব্রেডক্রাম্ব-হেডার ও প্রিভিউতে দেখানোর জন্য নির্বাচিত বিভাগ/শ্রেণি/পরীক্ষার
  // পুরো নাম বের করা — id নয়, id দিয়ে ম্যাচ করে আসল বাংলা নাম।
  const selectedDivisionName = useMemo(
    () => divisions.find((d) => String(d.division_id) === division)?.division_name_bn || "",
    [divisions, division],
  );
  const selectedClassName = useMemo(
    () => classes.find((c) => String(c.class_id) === classId)?.class_name_bn || "",
    [classes, classId],
  );
  const selectedExam = useMemo(
    () => exams.find((e) => String(e.id) === selectedExamId),
    [exams, selectedExamId],
  );

  // পরীক্ষা-ভিত্তিক ওভারভিউ রো-গুলো পরীক্ষা অনুযায়ী গ্রুপ করা — ব্যাকএন্ড
  // ইতিমধ্যে পরীক্ষা ও ক্লাস দুটোই sortOrder অনুসারে সাজিয়ে পাঠায়, তাই এখানে
  // শুধু গ্রুপ করলেই ক্রম ঠিক থাকে।
  const examOverviewGrouped = useMemo(() => {
    const map = new Map<
      number,
      { examId: number; examName: string; examYear: string | number; rows: ExamRoutineOverviewRow[] }
    >();
    for (const row of examOverview) {
      if (!map.has(row.examId)) {
        map.set(row.examId, { examId: row.examId, examName: row.examName, examYear: row.examYear, rows: [] });
      }
      map.get(row.examId)!.rows.push(row);
    }
    return Array.from(map.values());
  }, [examOverview]);

  // ওভারভিউ কার্ডে ক্লিক করলে সরাসরি সেই বিভাগ/শ্রেণি (ও পরীক্ষা) বেছে নিয়ে
  // এডিটিং ভিউতে চলে যাওয়া — ম্যানুয়ালি তিনটে ড্রপডাউন থেকে আবার বেছে নিতে
  // হয় না।
  const jumpToClass = (row: ClassRoutineOverviewRow) => {
    if (row.divisionId == null) return;
    const divStr = String(row.divisionId);
    setDivision(divStr);
    loadClasses(divStr);
    setClassId(String(row.classId));
  };

  const jumpToExamClass = (row: ExamRoutineOverviewRow) => {
    if (row.divisionId == null) return;
    const divStr = String(row.divisionId);
    setDivision(divStr);
    loadClasses(divStr);
    setClassId(String(row.classId));
    setSelectedExamId(String(row.examId));
  };

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
      loadOverview();
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
      loadOverview();
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
      loadOverview();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "রুটিন যোগ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  // প্রতিটা বিষয়ের আলাদা স্ট্যাটাস রাখা অপ্রয়োজনীয় জটিলতা — এই শ্রেণি ও
  // পরীক্ষার সবগুলো রুটিন এন্ট্রি একই সাথে খসড়া/প্রকাশিত/বাতিল করা হয়, তাই
  // একটাই বাটন দিয়ে সবগুলো একসাথে আপডেট করা হচ্ছে। ব্যর্থ হলে সার্ভার থেকে
  // পুনরায় লোড করে সঠিক অবস্থায় ফিরিয়ে আনা হয় (আংশিক ব্যর্থতা হতে পারে বলে)।
  const handleChangeClassExamStatus = async (nextStatus: string) => {
    if (!examRoutines.length) return;
    const prevRoutines = examRoutines;
    setStatusBusy(true);
    setExamRoutines((prev) => prev.map((r) => ({ ...r, status: nextStatus })));
    try {
      await Promise.all(prevRoutines.map((r) => examRoutineApi.update(r.id, { status: nextStatus as any })));
      useToastStore.getState().show("স্ট্যাটাস আপডেট হয়েছে", "success");
      loadOverview();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
      loadExamRoutines();
    } finally {
      setStatusBusy(false);
    }
  };

  const handleDeleteExamRoutine = async (id: number) => {
    try {
      await examRoutineApi.remove(id);
      useToastStore.getState().show("রুটিন মুছে ফেলা হয়েছে", "success");
      setExamRoutines((prev) => prev.filter((row) => row.id !== id));
      loadOverview();
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

        {/* Overview — পেজে ঢুকেই, কোনো বিভাগ/শ্রেণি না বেছেই কোন ক্লাসের
            রুটিন তৈরি হয়েছে/হয়নি এক নজরে দেখা যায় (রেজাল্ট প্যানেলের
            ওভারভিউ পেজের ধাঁচে) — কার্ডে ক্লিক করলে সরাসরি সেই ক্লাসের
            এডিটিং ভিউতে চলে যাওয়া যায়। */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-slate-300">
            <ClipboardList size={15} className="text-blue-600 dark:text-blue-400" />
            {tab === "class" ? "কোন ক্লাসের রুটিন তৈরি হয়েছে" : "কোন ক্লাসের পরীক্ষার রুটিন তৈরি হয়েছে"}
          </h2>

          {overviewLoading ? (
            <SkeletonList items={4} />
          ) : tab === "class" ? (
            classOverview.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400 dark:text-slate-500">
                কোনো সক্রিয় শ্রেণি পাওয়া যায়নি
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {classOverview.map((row) => {
                  const has = row.periodCount > 0;
                  const isActive = String(row.classId) === classId && String(row.divisionId) === division;
                  return (
                    <button
                      key={row.classId}
                      type="button"
                      onClick={() => jumpToClass(row)}
                      className={`flex flex-col gap-1 rounded-lg border p-2.5 text-left transition hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-700 ${
                        isActive
                          ? "border-blue-400 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20"
                          : "border-gray-200 dark:border-slate-700"
                      }`}
                    >
                      <span className="truncate text-[11px] text-gray-400 dark:text-slate-500">
                        {row.divisionName || "—"}
                      </span>
                      <span className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100">
                        {row.className || "—"}
                      </span>
                      <span
                        className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          has ? EXAM_ROUTINE_STATUS_STYLES.PUBLISHED : OVERVIEW_STATUS_STYLES.NONE
                        }`}
                      >
                        {has ? `রুটিন আছে (${row.periodCount})` : "রুটিন নেই"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : examOverviewGrouped.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-slate-500">
              কোনো সক্রিয় পরীক্ষা পাওয়া যায়নি
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {examOverviewGrouped.map((group) => (
                <div key={group.examId}>
                  <p className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400">
                    {group.examName} — {group.examYear}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {group.rows.map((row) => {
                      const isActive =
                        String(row.classId) === classId &&
                        String(row.divisionId) === division &&
                        String(row.examId) === selectedExamId;
                      return (
                        <button
                          key={`${row.examId}-${row.classId}`}
                          type="button"
                          onClick={() => jumpToExamClass(row)}
                          className={`flex flex-col gap-1 rounded-lg border p-2.5 text-left transition hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-700 ${
                            isActive
                              ? "border-blue-400 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20"
                              : "border-gray-200 dark:border-slate-700"
                          }`}
                        >
                          <span className="truncate text-[11px] text-gray-400 dark:text-slate-500">
                            {row.divisionName || "—"}
                          </span>
                          <span className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100">
                            {row.className || "—"}
                          </span>
                          <span
                            className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${OVERVIEW_STATUS_STYLES[row.status]}`}
                          >
                            {OVERVIEW_STATUS_LABELS[row.status]}
                            {row.status !== "NONE" ? ` (${row.subjectCount})` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-100">
                        <Layers size={14} className="text-blue-600 dark:text-blue-400" />
                        {selectedDivisionName}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-100">
                        <GraduationCap size={14} className="text-blue-600 dark:text-blue-400" />
                        {selectedClassName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPreview(true)}
                      className="flex h-8 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Eye size={13} />
                      প্রিভিউ
                    </button>
                  </div>
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
                </>
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
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-100">
                        <Layers size={14} className="text-blue-600 dark:text-blue-400" />
                        {selectedDivisionName}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-100">
                        <GraduationCap size={14} className="text-blue-600 dark:text-blue-400" />
                        {selectedClassName}
                      </span>
                      {selectedExam && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-100">
                          <ClipboardList size={14} className="text-blue-600 dark:text-blue-400" />
                          {selectedExam.name} — {selectedExam.year}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={classExamStatus === "MIXED" ? "" : classExamStatus}
                        disabled={statusBusy}
                        title="রুটিনের স্ট্যাটাস পরিবর্তন করুন"
                        onChange={(e) => handleChangeClassExamStatus(e.target.value)}
                        className={`h-8 rounded-full border-0 px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 ${EXAM_ROUTINE_STATUS_STYLES[classExamStatus] || "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300"}`}
                      >
                        {classExamStatus === "MIXED" && <option value="">বিভিন্ন</option>}
                        {Object.keys(EXAM_ROUTINE_STATUS_LABELS).map((s) => (
                          <option key={s} value={s}>
                            {EXAM_ROUTINE_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowPreview(true)}
                        className="flex h-8 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Eye size={13} />
                        প্রিভিউ
                      </button>
                    </div>
                  </div>
                  <p className="mb-1.5 text-center text-[11px] text-gray-400 dark:text-slate-500 sm:hidden">
                    ⟷ টেবিলটি পাশে স্ক্রল করে বাকি কলাম দেখুন
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-gray-300 dark:border-slate-700">
                    <table className="w-full min-w-[700px] border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border border-gray-300 bg-gray-50 px-3 py-2.5 text-left text-xs font-bold text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                            বার
                          </th>
                          <th className="border border-gray-300 bg-gray-50 px-3 py-2.5 text-left text-xs font-bold text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                            তারিখ ও সময়
                          </th>
                          <th className="border border-gray-300 bg-gray-50 px-3 py-2.5 text-left text-xs font-bold text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                            বিষয়
                          </th>
                          <th className="border border-gray-300 bg-gray-50 px-3 py-2.5 text-left text-xs font-bold text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                            রুম / ধারণক্ষমতা
                          </th>
                          <th className="border border-gray-300 bg-gray-50 px-3 py-2.5 text-center text-xs font-bold text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                            কার্যক্রম
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedExamRoutines.map((row) => {
                          return (
                            <Fragment key={row.id}>
                              <tr className="transition hover:bg-blue-50/50 dark:hover:bg-slate-800/50">
                                <td className="border border-gray-300 px-3 py-2.5 align-top text-sm font-semibold text-indigo-700 dark:border-slate-700 dark:text-indigo-400">
                                  {getExamDayLabel(row.examDate)}
                                </td>
                                <td className="border border-gray-300 px-3 py-2.5 align-top dark:border-slate-700">
                                  <div className="text-sm font-medium text-gray-800 dark:text-slate-100">
                                    {formatExamDateFull(row.examDate)}
                                  </div>
                                  <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                                    <Clock size={12} />
                                    {row.startTime}–{row.endTime}
                                  </div>
                                </td>
                                <td className="border border-gray-300 px-3 py-2.5 align-top dark:border-slate-700">
                                  <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                                    {row.subject}
                                  </div>
                                  {row.instructions && (
                                    <div className="mt-1 flex items-start gap-1 text-xs text-gray-500 dark:text-slate-400">
                                      <CalendarClock size={12} className="mt-0.5 shrink-0" />
                                      {row.instructions}
                                    </div>
                                  )}
                                </td>
                                <td className="border border-gray-300 px-3 py-2.5 align-top text-xs text-gray-600 dark:border-slate-700 dark:text-slate-300">
                                  <div className="flex flex-col gap-0.5">
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
                                    {!row.room?.name && !row.roomNo && row.maxCapacity == null && "—"}
                                  </div>
                                </td>
                                <td className="border border-gray-300 px-3 py-2.5 align-top dark:border-slate-700">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedRoutineId((prev) => (prev === row.id ? null : row.id))}
                                      className="flex h-8 items-center justify-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400"
                                    >
                                      <UserCheck size={13} />
                                      পরিদর্শক
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteExamRoutine(row.id)}
                                      className="flex h-8 items-center justify-center gap-1 rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                                    >
                                      <Trash2 size={13} />
                                      মুছুন
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {expandedRoutineId === row.id && (
                                <tr>
                                  <td colSpan={5} className="border border-gray-300 bg-gray-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                                    <ExamInvigilatorPanel examRoutineId={row.id} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        open={showPreview}
        title={tab === "class" ? "ক্লাস রুটিন প্রিভিউ" : "পরীক্ষার রুটিন প্রিভিউ"}
        onClose={() => setShowPreview(false)}
        maxWidthClassName="max-w-3xl"
      >
        <div className="print-area relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
          <ReportBackground />
          <ReportWatermark />
          <ReportBrandHeader />

          <div className="report-content-body relative text-black">
            <h2 className="mb-1 text-center text-xl font-bold">
              {tab === "class" ? "সাপ্তাহিক ক্লাস রুটিন" : "পরীক্ষার রুটিন"}
            </h2>
            {tab === "exam" && selectedExam && (
              <p className="mb-3 text-center text-sm font-semibold">
                {selectedExam.name} — {selectedExam.year}
              </p>
            )}

            <div className="mb-3 grid grid-cols-2 text-[13px]">
              <div className="flex min-h-9 items-center border border-black px-2">
                <b className="mr-1">বিভাগ:</b> {selectedDivisionName || "—"}
              </div>
              <div className="flex min-h-9 items-center border border-l-0 border-black px-2">
                <b className="mr-1">শ্রেণি:</b> {selectedClassName || "—"}
              </div>
            </div>

            <table className="w-full table-fixed border-collapse border border-black text-center">
              <thead>
                <tr>
                  <th className="border border-black px-1 py-2 text-sm font-bold">বার</th>
                  {tab === "exam" && (
                    <th className="border border-black px-1 py-2 text-sm font-bold">তারিখ</th>
                  )}
                  <th className="border border-black px-1 py-2 text-sm font-bold">শুরু</th>
                  <th className="border border-black px-1 py-2 text-sm font-bold">শেষ</th>
                  <th className="border border-black px-1 py-2 text-sm font-bold">বিষয়</th>
                  <th className="border border-black px-1 py-2 text-sm font-bold">
                    {tab === "class" ? "শিক্ষক" : "রুম"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(tab === "class" ? sortedClassRoutines : sortedExamRoutines).map((row: any) => (
                  <tr key={row.id}>
                    <td className="border border-black px-1 py-1.5 text-sm font-semibold">
                      {tab === "class" ? `${DAY_LABELS[row.dayOfWeek]}বার` : getExamDayLabel(row.examDate)}
                    </td>
                    {tab === "exam" && (
                      <td className="border border-black px-1 py-1.5 text-sm">
                        {formatExamDateFull(row.examDate)}
                      </td>
                    )}
                    <td className="border border-black px-1 py-1.5 text-sm">{row.startTime}</td>
                    <td className="border border-black px-1 py-1.5 text-sm">{row.endTime}</td>
                    <td className="border border-black px-1 py-1.5 text-left text-sm font-semibold">
                      {row.subject}
                    </td>
                    <td className="border border-black px-1 py-1.5 text-left text-sm">
                      {tab === "class" ? row.teacher?.nameBn || "—" : row.room?.name || row.roomNo || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="no-print mt-4 flex justify-end gap-2 px-1 pb-1">
          <Button variant="secondary" onClick={() => setShowPreview(false)}>
            বন্ধ করুন
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={16} className="mr-1 inline" />
            প্রিন্ট করুন
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ClassExamRoutinePage;
