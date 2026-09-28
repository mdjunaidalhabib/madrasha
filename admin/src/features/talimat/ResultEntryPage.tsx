import { useEffect, useRef, useState } from "react";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { resultsText } from "./results.text";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import { ABSENT_MARK, toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";

import ResultFilter from "../../components/ResultPanel/ResultFilter";
import MarksTable, { type SubmissionInfo } from "../../components/ResultPanel/MarksTable";
import ResultActions from "../../components/ResultPanel/ResultActions";
import ReasonPromptModal from "../../components/ResultPanel/ReasonPromptModal";
import PasswordPromptModal from "../../components/ResultPanel/PasswordPromptModal";
import { RESULT_PERMISSIONS } from "../../components/ResultPanel/resultStatus";
import { useClassFailMark } from "../../components/ResultPanel/useClassGrading";
import { correctionItemsForCell, type CorrectionItem } from "../../components/ResultPanel/correctionDiff";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

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
// Preview page's t.marksEntry button (with exam/class preset via query
// params) or directly, in which case the teacher picks division/exam/class
// here. t.viewPreview always sends them back to the Preview page.
export default function ResultEntryPage() {
  const t = useText(resultsText);
  const c = useText(commonText);
  const push = useToastStore((state) => state.push);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canSubmitSubject =
    hasPermission(user, permissions, RESULT_PERMISSIONS.marksSubmit) ||
    hasPermission(user, permissions, RESULT_PERMISSIONS.legacyFallback);
  const canVerifySubject =
    hasPermission(user, permissions, RESULT_PERMISSIONS.marksVerify) ||
    hasPermission(user, permissions, RESULT_PERMISSIONS.legacyFallback);
  // A single office/admin user who holds BOTH submit and verify rights (the
  // common case for a small madrasa with no separate verifier) shouldn't
  // have to click "জমা দিন" then "যাচাই" per subject before "সংরক্ষণ ও
  // প্রসেস করুন" even works — saveMarks() below chains submit+verify+process
  // into that one button for them instead. Anyone missing either right
  // keeps the manual per-subject workflow (see MarksTable's canSubmit/
  // canVerify props further down), preserving the maker/checker separation
  // for madrasas that actually staff it.
  const isSingleActorWorkflow = canSubmitSubject && canVerifySubject;

  // Once a result is PUBLISHED/LOCKED the backend refuses direct mark writes,
  // so this page switches to "সংশোধন" mode: the same whole-class grid, but
  // saving sends only the changed cells as a correction (see
  // handleSubmitCorrection). Whoever holds full result authority - তালিমাত /
  // মুহতামিম, or verify+approve - has it applied on the spot; anyone else
  // files a request for a separate approver.
  const canCorrect =
    hasPermission(user, permissions, RESULT_PERMISSIONS.resultCorrect) ||
    hasPermission(user, permissions, RESULT_PERMISSIONS.legacyFallback);
  const canApplyCorrectionDirectly =
    hasPermission(user, permissions, RESULT_PERMISSIONS.resultVerify) &&
    hasPermission(user, permissions, RESULT_PERMISSIONS.resultApprove);

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
  const [notes, setNotes] = useState<Record<number, Record<number, string>>>({});
  // Division-scoped: re-fetched whenever the selected class changes; null
  // while loading so cells don't flash a wrong pass/fail colour.
  const failMark = useClassFailMark(classId);
  const [loading, setLoading] = useState(false);
  const [resultMasterId, setResultMasterId] = useState<number | null>(requestedResultMasterId);
  const [editMode, setEditMode] = useState(false);
  const [submissions, setSubmissions] = useState<Record<number, SubmissionInfo>>({});
  const [submittingBookId, setSubmittingBookId] = useState<number | null>(null);
  const [rejectBookId, setRejectBookId] = useState<number | null>(null);
  const [rejectingBook, setRejectingBook] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetVerifying, setResetVerifying] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [correctionReasonOpen, setCorrectionReasonOpen] = useState(false);
  const [correctionSaving, setCorrectionSaving] = useState(false);
  // The marks exactly as stored when the page loaded - what a correction is
  // diffed against, so only genuinely changed cells are sent.
  const baselineRef = useRef<
    Record<number, Record<number, { mark: number; is_absent: boolean; note: string }>>
  >({});
  const isPublished = sessionStatus === "PUBLISHED" || sessionStatus === "LOCKED";
  const isPublishedRef = useRef(false);
  isPublishedRef.current = isPublished;

  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutosavedRef = useRef<string>("");
  const autosaveInFlightRef = useRef(false);
  // Fingerprint of {marks, notes} as of the last successful "সংরক্ষণ ও
  // প্রসেস করুন" — while the current state matches it, that button has
  // nothing new to do, so it stays disabled instead of inviting a
  // redundant re-submit/re-verify/re-process click. Starts empty (never
  // processed this session), which never matches a real snapshot, so a
  // fresh page always starts with the button enabled.
  const lastProcessedSnapshotRef = useRef<string>("");
  const marksSnapshot = JSON.stringify({ marks, notes });
  const hasUnprocessedChanges = marksSnapshot !== lastProcessedSnapshotRef.current;

  // Mirrors MarksTable's own filled/total progress check - a null cell is
  // "not yet entered" (absent/exempted/withheld are non-null sentinel
  // values, so they count as entered). Gates the Save & Process button
  // client-side with the same completeness rule the backend enforces
  // server-side (findStudentsMissingMarkForBook), so the button itself
  // signals "not ready" instead of letting the click through to a 409.
  const allMarksEntered =
    students.length > 0 &&
    books.length > 0 &&
    students.every((s) => books.every((b) => marks?.[s.id]?.[b.book_id] != null));

  const saveDisabledReason = !allMarksEntered
    ? t.notAllEntered
    : !hasUnprocessedChanges
      ? t.noNewChanges
      : undefined;

  useEffect(() => {
    const init = async () => {
      try {
        const [d, e] = await Promise.all([
          cachedGet("/madrasa-divisions"),
          cachedGet("/exams", { params: { active_only: true } }),
        ]);
        setDivisions(extractArray(d.data));
        setExams(extractArray(e.data));
      } catch (err) {
        logger.error("Init load error:", err);
        push("error", t.filtersLoadFailed);
      }
    };
    init();
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
      const formattedNotes: Record<number, Record<number, string>> = {};
      const baseline: typeof baselineRef.current = {};
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

        if (!baseline[studentId]) baseline[studentId] = {};
        baseline[studentId][bookId] = {
          mark: Number(r.mark),
          is_absent: isAbsent,
          note: r.note ? String(r.note) : "",
        };

        if (r.note) {
          if (!formattedNotes[studentId]) formattedNotes[studentId] = {};
          formattedNotes[studentId][bookId] = String(r.note);
        }
      });

      baselineRef.current = baseline;
      setSessionStatus(typeof res.data?.status === "string" ? res.data.status : null);
      setResultMasterId(masterId);
      setMarks(formatted);
      setNotes(formattedNotes);
      setEditMode(Object.keys(formatted).length > 0);
      if (masterId) loadSubmissions(masterId);
      else setSubmissions({});
    } catch (err) {
      logger.error("Load marks error:", err);
      baselineRef.current = {};
      setSessionStatus(null);
      setResultMasterId(null);
      setMarks({});
      setNotes({});
      setSubmissions({});
      setEditMode(false);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (masterId: number) => {
    try {
      const res = await cachedGet(`/results/${masterId}/submissions`);
      const list = extractArray(res.data);
      const map: Record<number, SubmissionInfo> = {};
      list.forEach((row: any) => {
        const bookId = Number(row.book_id);
        if (!Number.isFinite(bookId)) return;
        map[bookId] = row;
      });
      setSubmissions(map);
    } catch (err) {
      // Non-fatal — the entry-grid still works fully unlocked if this
      // endpoint isn't reachable yet (e.g. backend still in progress).
      logger.error("Load submissions error:", err);
      setSubmissions({});
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
    lastProcessedSnapshotRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, classId]);

  // Re-opening an entry that's already fully submitted+verified (e.g. via
  // "✏️ Edit Marks" from the Preview page) should start with "সংরক্ষণ ও
  // প্রসেস করুন" disabled — every book already reaching VERIFIED is this
  // codebase's only path to that state (the single-actor chain in
  // saveMarks always runs submit+verify+process together), so it's a
  // reliable proxy for "already processed, nothing pending". Freezes the
  // CURRENT marks/notes as the clean baseline the moment that's detected;
  // any edit afterward naturally drifts away from it again.
  useEffect(() => {
    if (!books.length) return;
    const allVerified = books.every((b) => submissions[b.book_id]?.status === "VERIFIED");
    if (allVerified) {
      lastProcessedSnapshotRef.current = JSON.stringify({ marks, notes });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, books]);

  // A subject already SUBMITTED/VERIFIED is locked in MarksTable, but any
  // marks entered before that submission are still sitting in local state —
  // leaving them in the autosave payload would just draw the backend's 409
  // rejection on every autosave tick, so they're filtered out here instead.
  // A single-actor user (see isSingleActorWorkflow above) is the one
  // exception: the backend's saveMarks now lets THEIR edits through
  // regardless of lock status (hasFullMarksAuthority bypass) and quietly
  // re-drafts that subject's submission, so keeping the client-side filter
  // for them would just silently drop edits the server was ready to accept.
  const isBookLocked = (bookId: number) => {
    if (isSingleActorWorkflow) return false;
    const status = submissions[bookId]?.status;
    return status === "SUBMITTED" || status === "VERIFIED";
  };

  const buildMarksPayload = () => {
    const payload: any[] = [];
    Object.keys(marks).forEach((sid) => {
      Object.keys(marks[+sid] || {}).forEach((bid) => {
        if (isBookLocked(+bid)) return;
        const value = marks[+sid]?.[+bid];
        if (value === undefined) return;
        const isAbsent = value === ABSENT_MARK;
        const note = notes[+sid]?.[+bid];
        payload.push({
          student_id: +sid,
          book_id: +bid,
          mark: value === null ? null : isAbsent ? 0 : Number(value),
          is_absent: isAbsent,
          ...(note ? { note } : {}),
          exam_id: +examId,
          class_id: +classId,
        });
      });
    });
    return payload;
  };

  const performAutosave = async () => {
    if (!examId || !classId) return;
    // A published result rejects direct writes - edits stay local until the
    // user submits them as a correction.
    if (isPublishedRef.current) return;

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

  // ---- সংশোধন mode (PUBLISHED/LOCKED) -------------------------------------
  // What the user has changed relative to the stored marks, as correction
  // requests. A cleared cell can't be corrected (a mark can be changed, not
  // deleted from a published result), and a cell that had no stored mark has
  // no row to correct - both block submission with a clear message.
  const computeCorrection = () => {
    const items: CorrectionItem[] = [];
    let clearedCells = 0;
    let newCells = 0;

    Object.keys(baselineRef.current).forEach((sid) => {
      Object.keys(baselineRef.current[+sid] || {}).forEach((bid) => {
        const next = marks[+sid]?.[+bid];
        if (next === null) {
          clearedCells += 1;
          return;
        }
        if (next === undefined) return;
        items.push(
          ...correctionItemsForCell(+sid, +bid, baselineRef.current[+sid][+bid], next, notes[+sid]?.[+bid] ?? ""),
        );
      });
    });

    Object.keys(marks).forEach((sid) => {
      Object.keys(marks[+sid] || {}).forEach((bid) => {
        if (marks[+sid][+bid] != null && !baselineRef.current[+sid]?.[+bid]) newCells += 1;
      });
    });

    const changedCells = new Set(items.map((i) => `${i.student_id}:${i.book_id}`)).size;
    return { items, changedCells, clearedCells, newCells };
  };
  const correction = isPublished ? computeCorrection() : null;

  const handleSubmitCorrection = async (reason: string) => {
    if (!resultMasterId || !correction) return;

    if (correction.clearedCells > 0) {
      setCorrectionReasonOpen(false);
      return push("error", t.publishedNoClear);
    }
    if (correction.newCells > 0) {
      setCorrectionReasonOpen(false);
      return push("error", t.publishedNoAdd);
    }
    if (correction.items.length === 0) {
      setCorrectionReasonOpen(false);
      return push("error", t.noMarksChanged);
    }

    setCorrectionSaving(true);
    try {
      // All changed cells of the class in one all-or-nothing request. With
      // apply_now the server applies it immediately, but only after
      // independently confirming full result authority - otherwise it stays
      // PENDING for a separate approver and `applied` is false.
      const res = await api.post(`/results/${resultMasterId}/corrections/batch`, {
        items: correction.items,
        reason,
        apply_now: canApplyCorrectionDirectly,
      });

      setCorrectionReasonOpen(false);
      push(
        "success",
        res.data?.applied
          ? t.cellsCorrectionApplied(toBanglaDigits(correction.changedCells))
          : t.correctionRequested,
      );
      goToPreview();
    } catch (err: any) {
      logger.error("Submit correction error:", err);
      push("error", err?.response?.data?.message || t.correctionFailed);
    } finally {
      setCorrectionSaving(false);
    }
  };

  const goToPreview = () => {
    const params = new URLSearchParams();
    if (examId) params.set("examId", examId);
    if (classId) params.set("classId", classId);
    navigate(`/talimat/results${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const saveMarks = async () => {
    const payload = buildMarksPayload();

    if (!examId || !classId) {
      return push("error", t.pickExamClass);
    }
    if (payload.length === 0 && !resultMasterId) {
      return push("error", t.noMarksGiven);
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

      if (payload.length > 0) {
        await api.post("/results/marks", { result_master_id: masterId, data: payload });
      }

      if (isSingleActorWorkflow) {
        for (const book of books) {
          const status = submissions[book.book_id]?.status;
          if (status === "SUBMITTED" || status === "VERIFIED") continue;
          await api.post(`/results/${masterId}/books/${book.book_id}/submit`, {});
          await api.post(`/results/${masterId}/books/${book.book_id}/verify`, {});
        }
      }

      await api.post("/results/process", {
        exam_id: +examId,
        class_id: +classId,
        result_master_id: masterId,
      });

      lastProcessedSnapshotRef.current = marksSnapshot;
      push("success", t.savedProcessed);
      goToPreview();
    } catch (err: any) {
      logger.error("Save marks error:", err);
      push("error", err?.response?.data?.message || t.marksSaveFailed);
    } finally {
      setLoading(false);
    }
  };

  // Submits one subject's marks for verification — the completeness check
  // (e.g. "৩ জন শিক্ষার্থীর নম্বর দেওয়া হয়নি") lives on the backend; a 409
  // there is surfaced verbatim via toast rather than duplicated client-side.
  const handleSubmitBook = async (bookId: number) => {
    if (!resultMasterId) {
      return push("error", t.saveFirst);
    }

    setSubmittingBookId(bookId);
    try {
      const res = await api.post(`/results/${resultMasterId}/books/${bookId}/submit`, {});
      push("success", res.data?.message || t.subjectSubmitted);
      await loadSubmissions(resultMasterId);
    } catch (err: any) {
      logger.error("Submit book error:", err);
      push("error", err?.response?.data?.message || t.subjectSubmitFailed);
    } finally {
      setSubmittingBookId(null);
    }
  };

  const handleVerifyBook = async (bookId: number) => {
    if (!resultMasterId) return;
    try {
      await api.post(`/results/${resultMasterId}/books/${bookId}/verify`, {});
      push("success", t.subjectVerified);
      await loadSubmissions(resultMasterId);
    } catch (err: any) {
      logger.error("Verify book error:", err);
      push("error", err?.response?.data?.message || t.verifyFailed);
    }
  };

  const handleConfirmRejectBook = async (reason: string) => {
    if (!resultMasterId || rejectBookId == null) return;
    setRejectingBook(true);
    try {
      await api.post(`/results/${resultMasterId}/books/${rejectBookId}/reject`, { reason });
      push("success", t.subjectRejected);
      await loadSubmissions(resultMasterId);
      setRejectBookId(null);
    } catch (err: any) {
      logger.error("Reject book error:", err);
      push("error", err?.response?.data?.message || t.subjectRejectFailed);
    } finally {
      setRejectingBook(false);
    }
  };

  // Wipes every mark for the WHOLE class at once and can't be undone once
  // autosave syncs the clears server-side, so this is the most destructive
  // single click on this page - double-confirms like handleApplyRollByRank,
  // then requires the acting user to re-type their own password (verified
  // server-side, see handleConfirmResetPassword) before anything actually
  // clears.
  const handleReset = () => {
    useConfirmStore.getState().show({
      title: t.resetTitle,
      message: t.resetMessage,
      confirmText: t.proceed,
      onConfirm: () => {
        useConfirmStore.getState().show({
          title: t.finalConfirm,
          message:
            t.resetFinalMessage,
          confirmText: t.resetFinalConfirm,
          danger: true,
          onConfirm: () => {
            setResetPasswordError(null);
            setResetPasswordOpen(true);
          },
        });
      },
    });
  };

  const performReset = () => {
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
  };

  const handleConfirmResetPassword = async (password: string) => {
    setResetVerifying(true);
    setResetPasswordError(null);
    try {
      await api.post("/auth/verify-password", { password });
      setResetPasswordOpen(false);
      performReset();
      push("success", t.resetDone);
    } catch (err: any) {
      setResetPasswordError(err?.response?.data?.message || t.wrongPassword);
    } finally {
      setResetVerifying(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen">
      <div className="flex flex-wrap gap-3 justify-between items-center bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl shadow">
        <h1 className="text-lg sm:text-2xl font-bold dark:text-slate-100">✍️ {t.marksEntry}</h1>

        <div className="flex w-full sm:w-auto flex-wrap gap-2">
          <button
            onClick={goToPreview}
            className="flex-1 sm:flex-none bg-gray-600 text-white px-5 py-2 rounded"
          >
            👁 {t.viewPreview}
          </button>
        </div>
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

      {isPublished ? (
        <div className="text-amber-800 text-sm font-medium bg-amber-50 border border-amber-200 px-3 py-2 rounded dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-900/50">
          {canCorrect
            ? canApplyCorrectionDirectly
              ? t.publishedCanApply
              : t.publishedCanRequest
            : t.publishedReadOnly}
        </div>
      ) : (
        editMode && (
          <div className="text-yellow-700 text-sm font-medium bg-yellow-50 border border-yellow-200 px-3 py-2 rounded dark:text-yellow-400 dark:bg-yellow-950/30 dark:border-yellow-900/50">
            {t.existingFound}
          </div>
        )
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
            autosaveStatus={isPublished ? "idle" : autosaveStatus}
            notes={notes}
            setNotes={setNotes}
            submissions={submissions}
            onSubmitBook={handleSubmitBook}
            submittingBookId={submittingBookId}
            canSubmit={canSubmitSubject && !isSingleActorWorkflow && !isPublished}
            canVerify={canVerifySubject && !isSingleActorWorkflow && !isPublished}
            onVerifyBook={handleVerifyBook}
            onRequestRejectBook={setRejectBookId}
            // Published: every subject is VERIFIED, which would lock all
            // columns - correction mode unlocks them for whoever may correct.
            lockOverride={isPublished ? canCorrect : isSingleActorWorkflow}
          />

          {isSingleActorWorkflow && !isPublished && (
            <p className="text-xs text-gray-500 dark:text-slate-400 px-1">
              {t.bothPermsInfo}
            </p>
          )}

          {/* Sticky so "সংরক্ষণ ও প্রসেস করুন"/"রিসেট" stay reachable without
              scrolling past a long class roster — sticks to the bottom of
              the page's own scroll container (the app shell's <main>).
              Styled as the same floating card as every other section on
              this page, just pinned in place, rather than a full-width
              divider bar. */}
          <div className="sticky bottom-3 z-20">
            <div className="bg-white dark:bg-slate-900 shadow-lg rounded-xl p-3 sm:p-4 border border-gray-100 dark:border-slate-800">
              {isPublished ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setCorrectionReasonOpen(true)}
                    disabled={loading || !canCorrect || !correction || correction.items.length === 0}
                    title={
                      !canCorrect
                        ? t.noCorrectPermission
                        : correction && correction.items.length === 0
                          ? t.noMarksChanged
                          : undefined
                    }
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                  >
                    {canApplyCorrectionDirectly ? `📝 ${t.applyCorrection}` : `📝 ${t.sendCorrectionRequest}`}
                  </button>
                  <button
                    onClick={() => loadExistingMarks()}
                    disabled={loading || !correction || correction.changedCells === 0}
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {t.discardChanges}
                  </button>
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {correction && correction.changedCells > 0
                      ? t.cellsChanged(toBanglaDigits(correction.changedCells))
                      : t.noCellsChanged}
                    {correction && correction.clearedCells > 0
                      ? t.cellsCleared(toBanglaDigits(correction.clearedCells))
                      : ""}
                  </span>
                </div>
              ) : (
                <ResultActions
                  onSave={saveMarks}
                  onReset={handleReset}
                  disabled={loading}
                  saveDisabledReason={saveDisabledReason}
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-slate-900 shadow-md rounded-xl p-6 text-center text-gray-500 dark:text-slate-400">
          {t.pickToStart}
        </div>
      )}

      <ReasonPromptModal
        open={rejectBookId != null}
        title={t.rejectSubjectTitle}
        message={t.rejectSubjectMessage}
        label={t.rejectSubjectReason}
        confirmText={t.rejectSubjectConfirm}
        loading={rejectingBook}
        onCancel={() => setRejectBookId(null)}
        onConfirm={handleConfirmRejectBook}
      />

      <ReasonPromptModal
        open={correctionReasonOpen}
        title={t.correctionReason}
        message={
          canApplyCorrectionDirectly
            ? t.correctionApplyNow(correction ? toBanglaDigits(correction.changedCells) : "")
            : t.correctionGoesToApprover
        }
        label={t.correctionReasonRequired}
        confirmText={canApplyCorrectionDirectly ? t.applyCorrection : t.sendRequest}
        confirmVariant="primary"
        loading={correctionSaving}
        onCancel={() => setCorrectionReasonOpen(false)}
        onConfirm={handleSubmitCorrection}
      />

      <PasswordPromptModal
        open={resetPasswordOpen}
        title={t.passwordConfirmTitle}
        message={t.passwordConfirmMessage}
        loading={resetVerifying}
        error={resetPasswordError}
        onCancel={() => {
          setResetPasswordOpen(false);
          setResetPasswordError(null);
        }}
        onConfirm={handleConfirmResetPassword}
      />
    </div>
  );
}
