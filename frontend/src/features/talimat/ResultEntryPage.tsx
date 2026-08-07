import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { ABSENT_MARK } from "../../utils/reportUtils";

import ResultFilter from "../../components/ResultPanel/ResultFilter";
import MarksTable from "../../components/ResultPanel/MarksTable";
import ResultActions from "../../components/ResultPanel/ResultActions";
import { logger } from "../../utils/logger";

// A student/book entry maps to `null` once cleared — kept (not deleted from
// state) so buildMarksPayload() still emits a row telling the backend to
// remove the saved mark instead of silently omitting it.
type MarksState = Record<number, Record<number, number | null>>;

interface Division {
  division_id: number;
  division_name_bn: string;
}
interface Exam {
  id: number;
  name: string;
}
interface ClassItem {
  class_id: number;
  class_name_bn: string;
}
interface Student {
  id: number;
  name_bn: string;
  roll?: number | string | null;
  registration_no?: number | string | null;
}
interface Book {
  book_id: number;
  book_name_bn?: string;
  name_bn?: string;
  book_name?: string;
  full_marks?: number;
  is_miyari?: boolean;
  pass_mark?: number | null;
}

const extractArray = (res: any) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

// The dedicated "Number Entry" page — lives on its own route so it never
// shares screen space with the preview/summary. Reached either from the
// Preview page's "নাম্বার এন্ট্রি" button (with exam/class preset via query
// params) or directly, in which case the teacher picks division/exam/class
// here. "প্রিভিউ দেখুন" always sends them back to the Preview page.
export default function ResultEntryPage() {
  const push = useToastStore((state) => state.push);
  const navigate = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const [searchParams] = useSearchParams();

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [books, setBooks] = useState<Book[]>([]);

  const [divisionId, setDivisionId] = useState(searchParams.get("divisionId") || "");
  const [examId, setExamId] = useState(searchParams.get("examId") || "");
  const [classId, setClassId] = useState(searchParams.get("classId") || "");
  const requestedResultMasterId = Number(searchParams.get("resultMasterId")) || null;

  const [marks, setMarks] = useState<MarksState>({});
  const [failMark, setFailMark] = useState(33);
  const [loading, setLoading] = useState(false);
  const [resultMasterId, setResultMasterId] = useState<number | null>(requestedResultMasterId);
  const [editMode, setEditMode] = useState(false);

  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutosavedRef = useRef<string>("");
  const autosaveInFlightRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [d, e] = await Promise.all([
          cachedGet("/madrasa-divisions"),
          cachedGet("/exams"),
        ]);
        setDivisions(extractArray(d.data));
        setExams(extractArray(e.data));
      } catch (err) {
        logger.error("Init load error:", err);
        push("error", "বিভাগ / পরীক্ষা লোড ব্যর্থ হয়েছে");
      }
    };
    init();

    api
      .get("/fail-mark")
      .then((res) => {
        const value = Number(res.data);
        if (!Number.isNaN(value)) setFailMark(value);
      })
      .catch((err) => logger.error("Fail mark load error:", err));
  }, [push]);

  useEffect(() => {
    const loadClasses = async () => {
      if (!divisionId) {
        setClasses([]);
        return;
      }
      try {
        const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
        setClasses(extractArray(res.data));
      } catch (err) {
        logger.error("Class load error:", err);
        setClasses([]);
      }
    };
    loadClasses();
  }, [divisionId]);

  useEffect(() => {
    if (!classId) return;

    const loadDeps = async () => {
      try {
        setLoading(true);
        const [s, b] = await Promise.all([
          cachedGet(`/students?class_id=${classId}`),
          cachedGet(`/madrasa-books?class_id=${classId}`),
        ]);
        setStudents(extractArray(s.data));
        setBooks(extractArray(b.data));
      } catch (err) {
        logger.error("Students/Books load error:", err);
        setStudents([]);
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };
    loadDeps();
  }, [classId]);

  const loadExistingMarks = async () => {
    if (!examId || !classId) return;

    try {
      setLoading(true);
      const query = new URLSearchParams({ exam_id: examId, class_id: classId });
      const isInitialEditSelection =
        examId === (searchParams.get("examId") || "") &&
        classId === (searchParams.get("classId") || "");
      const sessionIdForRequest = isInitialEditSelection ? requestedResultMasterId : null;
      if (sessionIdForRequest) query.set("result_master_id", String(sessionIdForRequest));

      const res = await cachedGet(`/results/marks?${query.toString()}`);
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const masterId = Number(res.data?.result_master_id) || null;

      const formatted: MarksState = {};
      data.forEach((r: any) => {
        // Accept both formats so frontend/backend can be deployed separately.
        const studentId = Number(r.student_id ?? r.studentId);
        const bookId = Number(r.book_id ?? r.bookId);
        const isAbsent = Boolean(r.is_absent ?? r.isAbsent);
        const mark = isAbsent ? ABSENT_MARK : Number(r.mark);

        if (!Number.isFinite(studentId) || !Number.isFinite(bookId) || !Number.isFinite(mark)) {
          return;
        }

        if (!formatted[studentId]) formatted[studentId] = {};
        formatted[studentId][bookId] = mark;
      });

      setResultMasterId(masterId);
      setMarks(formatted);
      setEditMode(Object.keys(formatted).length > 0);
    } catch (err) {
      logger.error("Load marks error:", err);
      setResultMasterId(null);
      setMarks({});
      setEditMode(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isInitialEditSelection =
      examId === (searchParams.get("examId") || "") &&
      classId === (searchParams.get("classId") || "");
    setResultMasterId(isInitialEditSelection ? requestedResultMasterId : null);
    loadExistingMarks();
    setAutosaveStatus("idle");
    lastAutosavedRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, classId]);

  const buildMarksPayload = () => {
    const payload: any[] = [];
    Object.keys(marks).forEach((sid) => {
      Object.keys(marks[+sid] || {}).forEach((bid) => {
        const value = marks[+sid]?.[+bid];
        if (value === undefined) return;
        const isAbsent = value === ABSENT_MARK;
        payload.push({
          student_id: +sid,
          book_id: +bid,
          mark: value === null ? null : isAbsent ? 0 : Number(value),
          is_absent: isAbsent,
          exam_id: +examId,
          class_id: +classId,
        });
      });
    });
    return payload;
  };

  const performAutosave = async () => {
    if (!examId || !classId) return;

    const payload = buildMarksPayload();
    if (payload.length === 0) return;

    const snapshot = JSON.stringify(payload);
    if (snapshot === lastAutosavedRef.current) return;
    if (autosaveInFlightRef.current) return;

    autosaveInFlightRef.current = true;
    setAutosaveStatus("saving");

    try {
      let masterId = resultMasterId;

      if (!masterId) {
        const sessionRes = await api.post("/results/session", {
          exam_id: +examId,
          class_id: +classId,
        });
        masterId = sessionRes.data?.result_master_id ?? null;
        if (masterId) setResultMasterId(masterId);
      }

      if (!masterId) throw new Error("result_master_id missing");

      await api.post("/results/marks", { result_master_id: masterId, data: payload });

      lastAutosavedRef.current = snapshot;
      setAutosaveStatus("saved");
    } catch (err) {
      logger.error("Autosave error:", err);
      setAutosaveStatus("error");
    } finally {
      autosaveInFlightRef.current = false;
    }
  };

  const scheduleAutosave = (delay = 1200) => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => performAutosave(), delay);
  };

  useEffect(() => {
    scheduleAutosave();
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks]);

  const handleCellCommit = () => scheduleAutosave(150);

  const goToPreview = () => {
    const params = new URLSearchParams();
    if (examId) params.set("examId", examId);
    if (classId) params.set("classId", classId);
    navigate(`${adminBase}/talimat/results${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const saveMarks = async () => {
    const payload = buildMarksPayload();

    if (!examId || !classId) {
      return push("error", "পরীক্ষা ও শ্রেণি নির্বাচন করুন");
    }
    if (payload.length === 0) {
      return push("error", "কোনো নম্বর দেওয়া হয়নি!");
    }

    setLoading(true);

    try {
      const sessionRes = await api.post("/results/session", {
        exam_id: +examId,
        class_id: +classId,
      });
      const masterId = sessionRes.data?.result_master_id;
      if (!masterId) throw new Error("result_master_id missing");

      setResultMasterId(masterId);

      await api.post("/results/marks", { result_master_id: masterId, data: payload });
      await api.post("/results/process", {
        exam_id: +examId,
        class_id: +classId,
        result_master_id: masterId,
      });

      push("success", "সংরক্ষণ ও প্রসেস সফল হয়েছে");
      goToPreview();
    } catch (err: any) {
      logger.error("Save marks error:", err);
      push("error", err?.response?.data?.message || "নম্বর সংরক্ষণ করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    useConfirmStore.getState().show({
      title: "নম্বর রিসেট",
      message: "সব দেওয়া নম্বর রিসেট করতে চান?",
      confirmText: "রিসেট",
      danger: true,
      onConfirm: () => {
        // Null out every existing entry (rather than wiping to `{}`) so the
        // usual [marks] autosave effect picks these up as delete rows and
        // actually clears them server-side too — an empty `{}` has no rows
        // left to build a payload from, so the old marks would just reload
        // on the next fetch.
        setMarks((prev) => {
          const cleared: MarksState = {};
          Object.keys(prev).forEach((sid) => {
            cleared[+sid] = {};
            Object.keys(prev[+sid] || {}).forEach((bid) => {
              cleared[+sid][+bid] = null;
            });
          });
          return cleared;
        });
      },
    });
  };

  return (
    <div className="p-3 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex flex-wrap gap-3 justify-between items-center bg-white p-3 sm:p-4 rounded-xl shadow">
        <h1 className="text-lg sm:text-2xl font-bold">✍️ নাম্বার এন্ট্রি</h1>

        <button
          onClick={goToPreview}
          className="w-full sm:w-auto bg-gray-600 text-white px-5 py-2 rounded"
        >
          👁 প্রিভিউ দেখুন
        </button>
      </div>

      <ResultFilter
        divisions={divisions}
        exams={exams}
        classes={classes}
        divisionId={divisionId}
        examId={examId}
        classId={classId}
        setDivisionId={setDivisionId}
        setExamId={setExamId}
        setClassId={setClassId}
      />

      {editMode && (
        <div className="text-yellow-700 text-sm font-medium bg-yellow-50 border border-yellow-200 px-3 py-2 rounded">
          ✏️ পূর্বের রেজাল্ট পাওয়া গেছে — আপনি নম্বর আপডেট করতে পারবেন
        </div>
      )}

      {examId && classId ? (
        <>
          <MarksTable
            students={students}
            books={books}
            marks={marks}
            setMarks={setMarks}
            disabled={loading}
            failMark={failMark}
            onCommit={handleCellCommit}
            autosaveStatus={autosaveStatus}
          />

          <ResultActions onSave={saveMarks} onReset={handleReset} disabled={loading} />
        </>
      ) : (
        <div className="bg-white shadow-md rounded-xl p-6 text-center text-gray-500">
          নাম্বার এন্ট্রি শুরু করতে উপরে থেকে বিভাগ, পরীক্ষা এবং ক্লাস নির্বাচন করুন।
        </div>
      )}
    </div>
  );
}
