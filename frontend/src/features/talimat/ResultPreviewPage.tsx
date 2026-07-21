import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

import OverviewGrid from "../../components/ResultPanel/OverviewGrid";
import FullResultTable from "../../components/ResultPanel/FullResultTable";
import StudentMarksEditModal from "../../components/ResultPanel/StudentMarksEditModal";
import { logger } from "../../utils/logger";

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
  division_id: number;
}
interface StatusItem {
  class_id: number;
  division_id: number;
  exam_id: number;
  result_master_id: number | null;
  publish_status: "DRAFT" | "PUBLISHED" | null;
  total_students: number;
  entered_students: number;
}
interface SummaryMark {
  book_id: number;
  book_name: string;
  mark: number;
}
interface SummaryItem {
  result_master_id: number;
  student_id: number;
  name_bn: string;
  total: number;
  average: number;
  general_grade?: string;
  madrasa_grade?: string;
  status: string;
  rank_no: number;
  publish_status?: string;
  marks?: SummaryMark[];
}
interface Book {
  book_id: number;
  book_name?: string;
}

const extractArray = (res: any) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

// The "Preview" page: a single screen shows every division's every class,
// crossed with every exam, as a status grid — no more picking a division /
// exam first just to see what's already entered. Clicking a card loads that
// class's detailed result below. Actual number entry lives on its own page
// (ResultEntryPage); this page only links out to it.
export default function ResultPreviewPage() {
  const push = useToastStore((state) => state.push);
  const navigate = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const [searchParams, setSearchParams] = useSearchParams();

  const examId = searchParams.get("examId") || "";
  const classId = searchParams.get("classId") || "";

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [summaryBooks, setSummaryBooks] = useState<Book[]>([]);
  const [resultMasterId, setResultMasterId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [applyingRoll, setApplyingRoll] = useState(false);

  const [failMark, setFailMark] = useState(33);
  const [editingStudent, setEditingStudent] = useState<SummaryItem | null>(null);
  const [studentSaving, setStudentSaving] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      const res = await cachedGet("/results/overview");
      setDivisions(extractArray(res.data?.divisions));
      setExams(extractArray(res.data?.exams));
      setClasses(extractArray(res.data?.classes));
      setStatuses(extractArray(res.data?.statuses));
    } catch (err) {
      logger.error("Overview load error:", err);
      push("error", "প্রিভিউ লোড করা যায়নি");
    } finally {
      setOverviewLoading(false);
    }
  }, [push]);

  useEffect(() => {
    loadOverview();

    api
      .get("/fail-mark")
      .then((res) => {
        const value = Number(res.data);
        if (!Number.isNaN(value)) setFailMark(value);
      })
      .catch((err) => logger.error("Fail mark load error:", err));
  }, [loadOverview]);

  const loadSummary = async () => {
    if (!examId || !classId) return;

    try {
      setDetailLoading(true);

      const summaryRes = await cachedGet(
        `/results/summary?exam_id=${examId}&class_id=${classId}`,
      );
      const summaryData = extractArray(summaryRes.data);

      if (summaryData.length > 0) {
        const masterId = summaryData[0].result_master_id ?? null;
        setResultMasterId(masterId);

        const fullRes = await cachedGet(
          `/results/full-result?result_master_id=${masterId}`,
        );

        const fullStudents = extractArray(fullRes.data?.students);
        const fullBooks = extractArray(fullRes.data?.books);
        const publishStatus = summaryData[0]?.publish_status;

        setSummary(
          fullStudents.map((student: any) => ({ ...student, publish_status: publishStatus })),
        );
        setSummaryBooks(fullBooks);
      } else {
        setSummary([]);
        setSummaryBooks([]);
        setResultMasterId(null);
      }
    } catch (err) {
      logger.error("Load summary error:", err);
      setSummary([]);
      setSummaryBooks([]);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, classId]);

  const handleSelectFromGrid = (selExamId: number, selClassId: number) => {
    setSearchParams({ examId: String(selExamId), classId: String(selClassId) });
  };

  const handleClearSelection = () => {
    setSearchParams({});
    setSummary([]);
    setSummaryBooks([]);
    setResultMasterId(null);
  };

  // "নাম্বার এন্ট্রি" always goes to the dedicated entry page. If a class is
  // already selected here, that class/exam comes along as a preset.
  const goToEntry = () => {
    const params = new URLSearchParams();
    if (examId) params.set("examId", examId);
    if (classId) {
      params.set("classId", classId);
      const cls = classes.find((c) => String(c.class_id) === classId);
      if (cls) params.set("divisionId", String(cls.division_id));
    }
    if (resultMasterId) params.set("resultMasterId", String(resultMasterId));
    navigate(`${adminBase}/talimat/results/entry${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const handleEditStudent = (student_id: number) => {
    const found = summary.find((s) => s.student_id === student_id);
    if (!found) return;
    setEditingStudent(found);
  };

  const handleSaveStudentMarks = async (values: Record<number, number>) => {
    if (!editingStudent || !examId || !classId) return;

    const payload = Object.keys(values).map((bid) => ({
      student_id: editingStudent.student_id,
      book_id: +bid,
      mark: Number(values[+bid]),
      exam_id: +examId,
      class_id: +classId,
    }));

    if (payload.length === 0) {
      return push("error", "অন্তত একটি নাম্বার দিন");
    }

    setStudentSaving(true);

    try {
      await api.post("/results/marks", { result_master_id: resultMasterId, data: payload });
      await api.post("/results/process", {
        exam_id: +examId,
        class_id: +classId,
        result_master_id: resultMasterId,
      });

      await loadSummary();
      await loadOverview();

      setEditingStudent(null);
      push("success", "নাম্বার আপডেট হয়েছে");
    } catch (err: any) {
      logger.error("Save student marks error:", err);
      push("error", err?.response?.data?.message || "সেভ করা যায়নি");
    } finally {
      setStudentSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!resultMasterId) return push("error", "No processed result found");

    try {
      setPublishing(true);
      await api.post("/results/publish", { result_master_id: resultMasterId });
      await loadSummary();
      await loadOverview();
      push("success", "Result published successfully");
    } catch (err: any) {
      logger.error("Publish error:", err);
      push("error", err?.response?.data?.message || "ফলাফল প্রকাশ করা যায়নি");
    } finally {
      setPublishing(false);
    }
  };

  const handleApplyRollByRank = () => {
    if (!resultMasterId) return push("error", "No processed result found");

    useConfirmStore.getState().show({
      title: "রোল আপডেট নিশ্চিত করুন",
      message:
        "এই ফলাফলের মেধাক্রম অনুযায়ী পুরো ক্লাসের রোল নম্বর নতুন করে বসানো হবে (রোল ১ = সর্বোচ্চ নম্বরপ্রাপ্ত)। " +
        "পুরনো পরীক্ষার মার্কশিটে কোনো প্রভাব পড়বে না। এগিয়ে যেতে চান?",
      confirmText: "এগিয়ে যান",
      onConfirm: async () => {
        try {
          setApplyingRoll(true);
          await api.post("/results/apply-roll-by-rank", { result_master_id: resultMasterId });
          await loadSummary();
          await loadOverview();
          push("success", "মেধাক্রম অনুযায়ী রোল আপডেট হয়েছে");
        } catch (err) {
          logger.error("Apply roll by rank error:", err);
          push("error", "রোল আপডেট করা যায়নি");
        } finally {
          setApplyingRoll(false);
        }
      },
    });
  };

  const selectedClassName = classes.find((c) => String(c.class_id) === classId)?.class_name_bn;
  const selectedExamName = exams.find((e) => String(e.id) === examId)?.name;

  return (
    <div className="p-3 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex flex-wrap gap-3 justify-between items-center bg-white p-3 sm:p-4 rounded-xl shadow">
        <h1 className="text-lg sm:text-2xl font-bold">🎓 Result Preview</h1>

        <button
          onClick={goToEntry}
          className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2 rounded"
        >
          ➕ নাম্বার এন্ট্রি
        </button>
      </div>

      {examId && classId ? (
        <>
          <div className="flex flex-wrap gap-2 items-center justify-between bg-white p-3 rounded-xl shadow">
            <p className="text-sm text-gray-600 break-words">
              📌 {selectedExamName} — {selectedClassName}
            </p>
            <button
              onClick={handleClearSelection}
              className="text-sm text-blue-600 hover:underline shrink-0"
            >
              ← সব দেখুন
            </button>
          </div>

          <FullResultTable
            summary={summary}
            books={summaryBooks}
            loading={detailLoading}
            onEdit={goToEntry}
            onEditStudent={handleEditStudent}
            onPublish={handlePublish}
            publishing={publishing}
            onApplyRollByRank={handleApplyRollByRank}
            applyingRoll={applyingRoll}
          />
        </>
      ) : (
        <OverviewGrid
          divisions={divisions}
          exams={exams}
          classes={classes}
          statuses={statuses}
          loading={overviewLoading}
          onSelect={handleSelectFromGrid}
        />
      )}

      {editingStudent && (
        <StudentMarksEditModal
          student={editingStudent}
          books={summaryBooks}
          failMark={failMark}
          saving={studentSaving}
          onClose={() => setEditingStudent(null)}
          onSave={handleSaveStudentMarks}
        />
      )}
    </div>
  );
}
