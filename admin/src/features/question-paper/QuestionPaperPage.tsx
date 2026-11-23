import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import {
  Bold,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FilePlus2,
  FileText,
  FolderOpen,
  ListChecks,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { formatNumber, useLang } from "@madrasha/shared-ui/src/i18n";
import { useAuthStore } from "../../store/authStore";
import {
  appendSubquestion,
  defaultPaperLayout,
  defaultPaperExam,
  paperExamTitle,
  newPaper,
  newQuestion,
  printPaper,
  questionError,
  totalMarks,
  type Question,
  type QuestionPaper,
} from "./questionPaper";
import {
  questionPaperApi,
  paperTemplateApi,
  type ClosingTemplate,
  type QuestionPaperReferences,
} from "../../services/questionPaperApi";
import { isAxiosError } from "axios";
import { readQuestionDraft, writeQuestionDraft } from "./questionPaperDraft";
import PaperTemplateSelector from "./PaperTemplateSelector";
import "./question-paper.css";

export default function QuestionPaperPage() {
  const slug = useAuthStore((s) => s.madrasaSlug);
  const user = useAuthStore((s) => s.user);
  const tenantKey = JSON.stringify([slug, user?.madrasa_id, user?.id]);
  const storageKey =
    user?.id && (slug || user.madrasa_id) ? `question-paper-draft:v1:${tenantKey}` : null;
  return <QuestionPaperWorkspace key={tenantKey} storageKey={storageKey} />;
}

function QuestionPaperWorkspace({ storageKey }: { storageKey: string | null }) {
  const lang = useLang();
  const t = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const n = (v: number) => formatNumber(v, lang);
  const [recovery] = useState(() => readQuestionDraft(storageKey));
  const [paperState, setPaper] = useState<QuestionPaper>(
    () => recovery.draft?.paper ?? newPaper(lang),
  );
  const [saved, setSaved] = useState<QuestionPaper[]>([]);
  const [closingTemplates, setClosingTemplates] = useState<ClosingTemplate[]>([]);
  const [instructionTemplates, setInstructionTemplates] = useState<ClosingTemplate[]>([]);
  const [references, setReferences] = useState<QuestionPaperReferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const paper = {
    ...paperState,
    layout: { ...defaultPaperLayout(lang), ...paperState.layout },
    institution: references?.branding.name || "",
    address: references?.branding.address || "",
  };
  const layout = { ...defaultPaperLayout(lang), ...paper.layout };
  const classes = references?.classes.filter((c) => c.divisionId === paper.divisionId) || [];
  const subjects = references?.subjects.filter((s) => s.classId === paper.classId) || [];
  const exams =
    references?.exams.filter(
      (exam) =>
        !exam.divisionIds.length ||
        (paper.divisionId !== null && exam.divisionIds.includes(paper.divisionId)),
    ) || [];

  useEffect(() => {
    if (!references) return;
    setPaper((current) => {
      if (current.title) return current;
      const exam = defaultPaperExam(references.exams, current.divisionId);
      return exam ? { ...current, title: paperExamTitle(exam) } : current;
    });
  }, [references, paperState.id]);
  const serverError = (error: unknown) =>
    isAxiosError(error) && typeof error.response?.data?.message === "string"
      ? error.response.data.message
      : t(
          "সার্ভারের সাথে সংযোগ হয়নি। আবার চেষ্টা করুন।",
          "Could not connect to the server. Please retry.",
        );
  const [draft, setDraft] = useState<Question>(() => recovery.draft?.question ?? newQuestion());
  const [editing, setEditing] = useState<string | null>(recovery.draft?.editing ?? null);
  const [tab, setTab] = useState<"editor" | "library">("editor");
  const [search, setSearch] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);
  const [customClosingNote, setCustomClosingNote] = useState(
    recovery.draft?.customClosingNote ?? "",
  );
  const [customInstructionNote, setCustomInstructionNote] = useState(
    recovery.draft?.customInstructionNote ?? "",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ action: () => void; label: string } | null>(null);
  const [dirty, setDirty] = useState(recovery.draft?.dirty ?? false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    recovery.failed ? "error" : recovery.draft ? "saved" : "idle",
  );
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const focusQuestionEnd = useRef(false);
  const closingNoteInput = useRef<HTMLInputElement>(null);
  const instructionNoteInput = useRef<HTMLInputElement>(null);
  const hasPendingClosingNote = Boolean(customClosingNote.trim() || customInstructionNote.trim());
  const hasPendingQuestion = Boolean(
    editing ||
    draft.text.trim() ||
    draft.answer.trim() ||
    draft.options.some((option) => option.trim()),
  );
  useLayoutEffect(() => {
    if (!storageKey) return;
    const pending = dirty || hasPendingQuestion || hasPendingClosingNote;
    if (recovery.failed && !pending) return;
    const success = writeQuestionDraft(
      storageKey,
      pending
        ? {
            version: 1,
            paper: paperState,
            question: draft,
            editing,
            customClosingNote,
            customInstructionNote,
            dirty,
          }
        : null,
    );
    if (!success || !pending) {
      setAutosaveStatus(success ? "idle" : "error");
      return;
    }
    // Keep the data safe immediately; settle the status when typing pauses.
    setAutosaveStatus("saving");
    const timer = setTimeout(() => setAutosaveStatus("saved"), 400);
    return () => clearTimeout(timer);
  }, [
    storageKey,
    paperState,
    draft,
    editing,
    customClosingNote,
    customInstructionNote,
    dirty,
    hasPendingQuestion,
    hasPendingClosingNote,
    recovery.failed,
  ]);
  useLayoutEffect(() => {
    if (!focusQuestionEnd.current) return;
    focusQuestionEnd.current = false;
    const input = questionInput.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, [draft.text]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void Promise.all([
      questionPaperApi.references(controller.signal),
      questionPaperApi.list(controller.signal),
      questionPaperApi.closingTemplates(controller.signal),
      paperTemplateApi("instruction").list(controller.signal),
    ])
      .then(([refs, papers, templates, instructions]) => {
        if (!controller.signal.aborted) {
          setReferences(refs);
          setSaved(papers);
          setClosingTemplates(templates);
          setInstructionTemplates(instructions);
          setPaper((current) => {
            const defaults = defaultPaperLayout(lang);
            if (recovery.draft || papers.some((item) => item.id === current.id)) return current;
            const footerText =
              current.layout?.footerText === defaults.footerText &&
              !templates.some((item) => item.text === defaults.footerText)
                ? ""
                : (current.layout?.footerText ?? defaults.footerText);
            const defaultInstructions = newPaper(lang).instructions;
            return {
              ...current,
              instructions:
                current.instructions === defaultInstructions &&
                !instructions.some((item) => item.text === defaultInstructions)
                  ? ""
                  : current.instructions,
              layout: { ...defaults, ...current.layout, footerText },
            };
          });
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(serverError(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (autosaveStatus !== "error" || (!dirty && !hasPendingQuestion && !hasPendingClosingNote))
      return;
    const handle = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [dirty, hasPendingQuestion, hasPendingClosingNote, autosaveStatus]);

  const patch = (value: Partial<QuestionPaper>) => {
    setPaper((p) => ({ ...p, ...value }));
    setDirty(true);
    setMessage("");
  };
  const patchLayout = (value: Partial<typeof layout>) => patch({ layout: { ...layout, ...value } });
  const notify = (value: string) => {
    setMessage(value);
    setError("");
  };
  const resetDraft = () => {
    setDraft(newQuestion());
    setEditing(null);
  };
  const addSubquestion = () => {
    const next = appendSubquestion(draft.text);
    if (next === draft.text) return;
    focusQuestionEnd.current = true;
    setDraft((q) => ({ ...q, text: next }));
  };
  const savePaper = async () => {
    if (hasPendingClosingNote) {
      setError(
        t(
          "নতুন লেখাটি আগে টেমপ্লেট হিসেবে তৈরি করুন।",
          "Create a template from your new text first.",
        ),
      );
      (customInstructionNote.trim() ? instructionNoteInput : closingNoteInput).current?.focus();
      return;
    }
    if (hasPendingQuestion) {
      setError(
        t("লেখা প্রশ্নটি আগে যোগ বা আপডেট করুন।", "Add or update your pending question first."),
      );
      questionInput.current?.focus();
      return;
    }
    if (!paper.title.trim() || !paper.divisionId || !paper.classId || !paper.subjectId) {
      setError(
        t(
          "পরীক্ষার নাম লিখুন এবং বিভাগ, শ্রেণি ও বিষয় নির্বাচন করুন।",
          "Enter an exam title and select division, class and subject.",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const result = saved.some((p) => p.id === paper.id)
        ? await questionPaperApi.update(paper)
        : await questionPaperApi.create(paper);
      setPaper(result);
      setSaved((items) => [result, ...items.filter((p) => p.id !== result.id)]);
      setDirty(false);
      notify(t("প্রশ্নপত্র সংরক্ষিত হয়েছে।", "Question paper saved."));
    } catch (error) {
      setError(serverError(error));
    } finally {
      setBusy(false);
    }
  };
  const duplicatePaper = async (p: QuestionPaper) => {
    setBusy(true);
    try {
      const result = await questionPaperApi.create({
        ...p,
        layout: { ...defaultPaperLayout(lang), ...p.layout },
        title: p.title.slice(0, 190) + " (" + t("কপি", "copy") + ")",
      });
      setSaved((items) => [result, ...items]);
      notify(t("প্রশ্নপত্র কপি হয়েছে।", "Paper duplicated."));
    } catch (error) {
      setError(serverError(error));
    } finally {
      setBusy(false);
    }
  };
  const deletePaper = async (p: QuestionPaper) => {
    setBusy(true);
    try {
      await questionPaperApi.remove(p.id);
      setSaved((items) => items.filter((item) => item.id !== p.id));
      if (paper.id === p.id) {
        setPaper((current) => ({ ...current, id: crypto.randomUUID() }));
        setDirty(true);
      }
      notify(t("প্রশ্নপত্র মুছে ফেলা হয়েছে।", "Question paper deleted."));
    } catch (error) {
      setError(serverError(error));
    } finally {
      setBusy(false);
    }
  };
  const guardChanges = (action: () => void) => {
    if (dirty || hasPendingQuestion || hasPendingClosingNote)
      setConfirm({
        action,
        label: t(
          "সংরক্ষণ না করা পরিবর্তন বাদ দিয়ে এগোবেন?",
          "Discard unsaved changes and continue?",
        ),
      });
    else action();
  };
  const startNew = () =>
    guardChanges(() => {
      const next = newPaper(lang);
      if (!closingTemplates.some((item) => item.text === next.layout?.footerText)) {
        next.layout = { ...defaultPaperLayout(lang), footerText: "" };
      }
      if (!instructionTemplates.some((item) => item.text === next.instructions))
        next.instructions = "";
      setPaper(next);
      setCustomClosingNote("");
      setCustomInstructionNote("");
      resetDraft();
      setDirty(false);
      setTab("editor");
      setError("");
      setMessage("");
    });
  const addQuestion = (event: FormEvent) => {
    event.preventDefault();
    if (questionError(draft)) {
      setError(
        t(
          "প্রশ্ন ও সঠিক নম্বর দিন। MCQ-এর চারটি অপশন ও সঠিক উত্তর নির্বাচন করুন।",
          "Enter a question and positive marks. MCQs need four options and a correct answer.",
        ),
      );
      return;
    }
    patch({
      questions: editing
        ? paper.questions.map((q) => (q.id === editing ? draft : q))
        : [...paper.questions, draft],
    });
    resetDraft();
    notify(
      t(
        "প্রশ্নটি প্রশ্নপত্রে যোগ হয়েছে। সংরক্ষণ করতে ভুলবেন না।",
        "Question added. Save your paper to keep changes.",
      ),
    );
    questionInput.current?.focus();
  };
  const move = (index: number, offset: number) => {
    const questions = [...paper.questions];
    [questions[index], questions[index + offset]] = [questions[index + offset], questions[index]];
    patch({ questions });
  };
  const doPrint = () => {
    if (
      ![paper.institution, paper.title, paper.subject, paper.className, paper.duration].every((s) =>
        s.trim(),
      ) ||
      !paper.questions.length ||
      paper.questions.some(questionError)
    ) {
      setError(
        t(
          "প্রিন্টের আগে প্রতিষ্ঠানের নাম, পরীক্ষার নাম, বিষয়, শ্রেণি, সময় ও অন্তত একটি সম্পূর্ণ প্রশ্ন দিন।",
          "Before printing, complete institution, exam title, subject, class, duration and at least one valid question.",
        ),
      );
      return;
    }
    try {
      printPaper(
        paper,
        {
          className: t("শ্রেণি", "Class"),
          subject: t("বিষয়", "Subject"),
          duration: t("সময়", "Duration"),
          marks: t("পূর্ণমান", "Total marks"),
          question: t("প্রশ্ন", "Question"),
        },
        n,
      );
    } catch {
      setError(
        t("প্রিন্ট চালু করা যায়নি। আবার চেষ্টা করুন।", "Unable to open print. Please try again."),
      );
    }
  };

  return (
    <fieldset className="qp-workspace" disabled={busy} aria-busy={busy || loading}>
      <header className="qp-header">
        <div>
          <h1>{t("প্রশ্নপত্র তৈরি", "Create question paper")}</h1>
        </div>
        <div className="qp-actions">
          <button className="qp-button" onClick={startNew}>
            <FilePlus2 size={17} />
            {t("নতুন প্রশ্নপত্র", "New paper")}
          </button>
          <button className="qp-button" disabled={loading || !references} onClick={doPrint}>
            <Printer size={17} />
            {t("প্রিন্ট / PDF", "Print / PDF")}
          </button>
          <button
            className="qp-button qp-primary"
            disabled={loading || !references}
            onClick={() => void savePaper()}
          >
            <Save size={17} />
            {busy ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save paper")}
          </button>
        </div>
      </header>
      {storageKey && (
        <p
          className={`qp-autosave-status${autosaveStatus === "error" ? " qp-autosave-error" : ""}`}
          role="status"
          title={
            autosaveStatus === "error"
              ? t(
                  "খসড়া সংরক্ষণে সমস্যা হয়েছে। সংরক্ষণ বাটন ব্যবহার করুন।",
                  "Could not autosave the draft. Use Save paper.",
                )
              : t("খসড়া এই ব্রাউজারে সংরক্ষিত থাকে।", "Drafts are kept in this browser.")
          }
        >
          {autosaveStatus === "saving" ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : autosaveStatus === "saved" ? (
            <Check size={14} aria-hidden="true" />
          ) : autosaveStatus === "error" ? (
            <X size={14} aria-hidden="true" />
          ) : (
            <Save size={14} aria-hidden="true" />
          )}
          <span>
            {autosaveStatus === "error"
              ? t("সেভ হয়নি", "Could not save")
              : autosaveStatus === "saving"
                ? t("সেভ হচ্ছে…", "Saving…")
                : autosaveStatus === "saved"
                  ? t("সেভ হয়েছে", "Saved")
                  : t("অটো সেভ চালু", "Autosave on")}
          </span>
        </p>
      )}

      <div className="qp-toolbar">
        <div className="qp-tabs" role="tablist" aria-label={t("প্রশ্নপত্রের বিভাগ", "Paper views")}>
          <button
            role="tab"
            aria-selected={tab === "editor"}
            onClick={() => setTab("editor")}
            className={tab === "editor" ? "active" : ""}
          >
            <Pencil size={16} />
            {t("প্রশ্নপত্র তৈরি", "Paper builder")}
          </button>
          <button
            role="tab"
            aria-selected={tab === "library"}
            onClick={() => setTab("library")}
            className={tab === "library" ? "active" : ""}
          >
            <FolderOpen size={16} />
            {t("আমার প্রশ্নপত্র", "My papers")}
            <span>{n(saved.length)}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="qp-notice" role="status">
          {t(
            "প্রশ্নপত্র ও একাডেমিক তথ্য লোড হচ্ছে…",
            "Loading question papers and academic details…",
          )}
        </div>
      )}
      {!loading && !references && (
        <button className="qp-button" onClick={() => setReload((v) => v + 1)}>
          {t("আবার চেষ্টা করুন", "Retry")}
        </button>
      )}
      {(error || message) && (
        <div className={`qp-notice ${error ? "qp-error" : ""}`} role={error ? "alert" : "status"}>
          {error ? <X size={18} /> : <CheckCircle2 size={18} />}
          <span>{error || message}</span>
          <button
            aria-label={t("বন্ধ করুন", "Dismiss")}
            onClick={() => {
              setError("");
              setMessage("");
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {confirm && (
        <div
          className="qp-confirm"
          role="alertdialog"
          aria-modal="false"
          aria-label={confirm.label}
        >
          <strong>{confirm.label}</strong>
          <div>
            <button className="qp-button" onClick={() => setConfirm(null)}>
              {t("ফিরে যান", "Cancel")}
            </button>
            <button
              className="qp-button qp-danger"
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              {t("নিশ্চিত করুন", "Confirm")}
            </button>
          </div>
        </div>
      )}

      {tab === "editor" ? (
        <div className="qp-columns">
          <div className="qp-editor">
            <section className="qp-card qp-paper-details">
              <div className="qp-section-heading">
                <span className="qp-section-icon">
                  <FileText size={19} />
                </span>
                <div>
                  <h2>{t("পরীক্ষার তথ্য", "Paper details")}</h2>
                  <p>
                    {t(
                      "প্রশ্নপত্রের প্রয়োজনীয় তথ্য পূরণ করুন",
                      "Set the essentials for your question paper",
                    )}
                  </p>
                </div>
                <span className={`qp-save-state ${dirty ? "unsaved" : ""}`}>
                  {dirty
                    ? t("খসড়া", "Draft")
                    : saved.some((p) => p.id === paper.id)
                      ? t("সংরক্ষিত", "Saved")
                      : t("খসড়া", "Draft")}
                </span>
              </div>
              <div className="qp-fields">
                <label className="qp-exam-field">
                  {t("পরীক্ষা", "Exam")}
                  {exams.length ? (
                    <select
                      value={paper.title}
                      disabled={loading}
                      onChange={(e) => patch({ title: e.target.value })}
                    >
                      {!exams.some((exam) => paperExamTitle(exam) === paper.title) && (
                        <option value={paper.title}>
                          {paper.title || t("পরীক্ষা নির্বাচন করুন", "Select exam")}
                        </option>
                      )}
                      {exams.map((exam) => (
                        <option key={exam.id} value={paperExamTitle(exam)}>
                          {paperExamTitle(exam)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      maxLength={200}
                      value={paper.title}
                      disabled={loading}
                      onChange={(e) => patch({ title: e.target.value })}
                      placeholder={t(
                        "যেমন: প্রথম সাময়িক পরীক্ষা ২০২৬",
                        "e.g. First term examination 2026",
                      )}
                    />
                  )}
                  {!exams.length && (
                    <span className="qp-reference-note">
                      {!paper.divisionId
                        ? t(
                            "বিভাগ নির্বাচন করলে পরীক্ষা স্বয়ংক্রিয়ভাবে বসবে।",
                            "Select a division to set the exam automatically.",
                          )
                        : t(
                            "এই বিভাগের সক্রিয় পরীক্ষা নেই। পরীক্ষার নাম লিখুন অথবা সেটিংসে পরীক্ষা যোগ করুন।",
                            "No active exam for this division. Enter a title or add an exam in settings.",
                          )}
                    </span>
                  )}
                </label>
                <label>
                  {t("বিভাগ", "Division")}
                  <select
                    aria-label={t("বিভাগ", "Division")}
                    value={paper.divisionId || ""}
                    disabled={!references || loading}
                    onChange={(e) => {
                      const division = references?.divisions.find(
                        (d) => d.id === Number(e.target.value),
                      );
                      patch({
                        title: (() => {
                          const exam = defaultPaperExam(
                            references?.exams || [],
                            division?.id || null,
                          );
                          return exam ? paperExamTitle(exam) : "";
                        })(),
                        divisionId: division?.id || null,
                        divisionName: division?.name || "",
                        classId: null,
                        className: "",
                        subjectId: null,
                        subject: "",
                      });
                    }}
                  >
                    <option value="">
                      {loading
                        ? t("লোড হচ্ছে…", "Loading…")
                        : t("বিভাগ নির্বাচন করুন", "Select division")}
                    </option>
                    {paper.divisionId &&
                      !references?.divisions.some((d) => d.id === paper.divisionId) && (
                        <option value={paper.divisionId} disabled>
                          {paper.divisionName} ({t("নিষ্ক্রিয়", "Inactive")})
                        </option>
                      )}
                    {references?.divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="qp-class-field">
                  {t("শ্রেণি / জামাত", "Class")}
                  <select
                    aria-label={t("শ্রেণি / জামাত", "Class")}
                    value={paper.classId || ""}
                    disabled={!paper.divisionId || loading}
                    onChange={(e) => {
                      const cls = classes.find((c) => c.id === Number(e.target.value));
                      patch({
                        classId: cls?.id || null,
                        className: cls?.name || "",
                        subjectId: null,
                        subject: "",
                      });
                    }}
                  >
                    <option value="">{t("শ্রেণি নির্বাচন করুন", "Select class")}</option>
                    {paper.classId && !classes.some((c) => c.id === paper.classId) && (
                      <option value={paper.classId} disabled>
                        {paper.className} ({t("নিষ্ক্রিয়", "Inactive")})
                      </option>
                    )}
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="qp-subject-field">
                  {t("বিষয় / কিতাব", "Subject / book")}
                  <select
                    aria-label={t("বিষয় / কিতাব", "Subject / book")}
                    value={paper.subjectId || ""}
                    disabled={!paper.classId || loading}
                    onChange={(e) => {
                      const subject = subjects.find((s) => s.id === Number(e.target.value));
                      patch({ subjectId: subject?.id || null, subject: subject?.name || "" });
                    }}
                  >
                    <option value="">{t("বিষয় নির্বাচন করুন", "Select subject")}</option>
                    {paper.subjectId && !subjects.some((s) => s.id === paper.subjectId) && (
                      <option value={paper.subjectId} disabled>
                        {paper.subject} ({t("নিষ্ক্রিয়", "Inactive")})
                      </option>
                    )}
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {references && !references.divisions.length && (
                  <p className="qp-full qp-reference-note">
                    {t(
                      "তালিমাতের সেটিংস থেকে আগে বিভাগ, শ্রেণি ও বিষয় যোগ করুন।",
                      "Add divisions, classes and subjects in academic settings first.",
                    )}
                  </p>
                )}
                <label className="qp-meta-field">
                  {t("পরীক্ষার সময়", "Exam duration")}
                  <input
                    value={paper.duration}
                    maxLength={100}
                    onChange={(e) => patch({ duration: e.target.value })}
                    placeholder={t("২ ঘণ্টা ৩০ মিনিট", "2h 30m")}
                  />
                </label>
                <label className="qp-meta-field">
                  {t("মোট নম্বর", "Total marks")}
                  <input value={n(totalMarks(paper))} readOnly />
                </label>
                <PaperTemplateSelector
                  kind="instruction"
                  templates={instructionTemplates}
                  onTemplatesChange={setInstructionTemplates}
                  text={paper.instructions}
                  onTextChange={(instructions) => patch({ instructions })}
                  customText={customInstructionNote}
                  onCustomTextChange={setCustomInstructionNote}
                  inputRef={instructionNoteInput}
                  busy={busy}
                  loading={loading || !references}
                  onBusyChange={setBusy}
                  onError={setError}
                  errorMessage={serverError}
                  onSuccess={notify}
                  confirmDelete={(text, action) =>
                    setConfirm({
                      label: `${t("এই টেমপ্লেটটি মুছবেন?", "Delete this template?")} ${text}`,
                      action,
                    })
                  }
                />
                <PaperTemplateSelector
                  kind="closing"
                  templates={closingTemplates}
                  onTemplatesChange={setClosingTemplates}
                  text={layout.footerText}
                  onTextChange={(footerText) => patchLayout({ footerText })}
                  customText={customClosingNote}
                  onCustomTextChange={setCustomClosingNote}
                  inputRef={closingNoteInput}
                  busy={busy}
                  loading={loading || !references}
                  onBusyChange={setBusy}
                  onError={setError}
                  errorMessage={serverError}
                  onSuccess={notify}
                  confirmDelete={(text, action) =>
                    setConfirm({
                      label: `${t("এই টেমপ্লেটটি মুছবেন?", "Delete this template?")} ${text}`,
                      action,
                    })
                  }
                />
                <div className="qp-full qp-subsection-heading">
                  <h3>{t("সাজসজ্জা", "Formatting")}</h3>
                  <span className="qp-section-rule" aria-hidden="true" />
                </div>
                <div className="qp-full qp-layout-controls">
                  <label>
                    {t("সময় ও পূর্ণমানের নিচের দাগ", "Line below time and marks")}
                    <select
                      value={layout.headerLineStyle}
                      onChange={(e) =>
                        patchLayout({
                          headerLineStyle: e.target.value as typeof layout.headerLineStyle,
                        })
                      }
                    >
                      <option value="none">{t("দাগ নেই", "None")}</option>
                      <option value="solid">{t("সোজা দাগ ━━━", "Solid ━━━")}</option>
                      <option value="double">{t("ডাবল দাগ ═══", "Double ═══")}</option>
                      <option value="dashed">{t("ড্যাশ দাগ ┄┄┄", "Dashed ┄┄┄")}</option>
                      <option value="dotted">{t("বিন্দু দাগ ······", "Dotted ······")}</option>
                    </select>
                  </label>
                  <label>
                    {t("দাগের পুরুত্ব", "Line thickness")}
                    <select
                      value={layout.headerLineThickness}
                      disabled={layout.headerLineStyle === "none"}
                      onChange={(e) => patchLayout({ headerLineThickness: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4].map((size) => (
                        <option key={size} value={size}>
                          {n(size)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div
                    className="qp-spacing-control"
                    role="group"
                    aria-labelledby="qp-spacing-label"
                  >
                    <span id="qp-spacing-label">
                      {t("প্রশ্নের মাঝের ফাঁক", "Question spacing")}
                    </span>
                    <div className="qp-spacing-stepper">
                      <button
                        type="button"
                        className="qp-button"
                        aria-label={t("ফাঁক কমান", "Decrease spacing")}
                        disabled={layout.questionSpacing <= 0}
                        onClick={() =>
                          patchLayout({ questionSpacing: Math.max(0, layout.questionSpacing - 1) })
                        }
                      >
                        <Minus size={16} />
                      </button>
                      <output aria-live="polite">{n(layout.questionSpacing)}</output>
                      <button
                        type="button"
                        className="qp-button"
                        aria-label={t("ফাঁক বাড়ান", "Increase spacing")}
                        disabled={layout.questionSpacing >= 60}
                        onClick={() =>
                          patchLayout({ questionSpacing: Math.min(60, layout.questionSpacing + 1) })
                        }
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="qp-button qp-format-button"
                    aria-pressed={layout.instructionsBold}
                    onClick={() => patchLayout({ instructionsBold: !layout.instructionsBold })}
                  >
                    <Bold size={15} />
                    {t("নির্দেশনা বোল্ড", "Bold instructions")}
                  </button>
                  <button
                    type="button"
                    className="qp-button qp-format-button"
                    aria-pressed={layout.footerBold}
                    onClick={() => patchLayout({ footerBold: !layout.footerBold })}
                  >
                    <Bold size={15} />
                    {t("সমাপ্তির লেখা বোল্ড", "Bold closing text")}
                  </button>
                </div>
              </div>
            </section>

            <section className="qp-card">
              <div className="qp-section-heading">
                <span className="qp-section-icon purple">
                  <Plus size={19} />
                </span>
                <div>
                  <h2>
                    {editing
                      ? t("প্রশ্ন সম্পাদনা", "Edit question")
                      : t("নতুন প্রশ্ন যোগ করুন", "Add a question")}
                  </h2>
                  <p>
                    {t(
                      "প্রশ্নের ধরন বেছে নিয়ে লেখা শুরু করুন",
                      "Choose a format and start writing",
                    )}
                  </p>
                </div>
              </div>
              <form onSubmit={addQuestion}>
                <div className="qp-type-picker">
                  {(["written", "short", "mcq"] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      aria-pressed={draft.type === type}
                      className={draft.type === type ? "selected" : ""}
                      onClick={() => setDraft((q) => ({ ...q, type, answer: "" }))}
                    >
                      {type === "written" ? (
                        <FileText size={17} />
                      ) : type === "short" ? (
                        <Pencil size={17} />
                      ) : (
                        <ListChecks size={17} />
                      )}
                      {type === "written"
                        ? t("লিখিত", "Written")
                        : type === "short"
                          ? t("সংক্ষিপ্ত", "Short answer")
                          : t("বহুনির্বাচনি", "MCQ")}
                      {draft.type === type && <Check size={14} />}
                    </button>
                  ))}
                </div>
                <div className="qp-fields">
                  <label className="qp-full">
                    {t("প্রশ্ন লিখুন", "Question")}
                    <textarea
                      ref={questionInput}
                      maxLength={10000}
                      aria-label={t("প্রশ্ন লিখুন", "Question")}
                      rows={4}
                      required
                      dir="auto"
                      value={draft.text}
                      onChange={(e) => setDraft((q) => ({ ...q, text: e.target.value }))}
                      onKeyDown={(e) => {
                        if (
                          draft.type !== "mcq" &&
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.ctrlKey &&
                          !e.altKey &&
                          !e.metaKey &&
                          !e.nativeEvent.isComposing &&
                          e.currentTarget.selectionStart === draft.text.length &&
                          e.currentTarget.selectionEnd === draft.text.length &&
                          /^[\t ]*[ক-হ][.)।]\s*\S/.test(
                            draft.text.split("\n").slice(-1)[0] || "",
                          ) &&
                          appendSubquestion(draft.text) !== draft.text
                        ) {
                          e.preventDefault();
                          addSubquestion();
                        }
                      }}
                      placeholder={t("এখানে আপনার প্রশ্নটি লিখুন…", "Write your question here…")}
                    />
                  </label>
                  <div className="qp-full qp-subquestion-action">
                    <button
                      type="button"
                      className="qp-button qp-format-button"
                      aria-pressed={Boolean(draft.bold)}
                      onClick={() => setDraft((q) => ({ ...q, bold: !q.bold }))}
                    >
                      <Bold size={15} />
                      {t("প্রশ্ন বোল্ড", "Bold question")}
                    </button>
                    {draft.type !== "mcq" && (
                      <button
                        type="button"
                        className="qp-button"
                        onClick={addSubquestion}
                        disabled={appendSubquestion(draft.text) === draft.text}
                      >
                        <Plus size={15} />
                        {t("উপপ্রশ্ন যোগ করুন (ক, খ)", "Add subquestion (ক, খ)")}
                      </button>
                    )}
                  </div>
                  {draft.type === "mcq" && (
                    <fieldset className="qp-full qp-options-field">
                      <legend>
                        {t(
                          "উত্তরের অপশন · সঠিক উত্তর নির্বাচন করুন",
                          "Options · select the correct answer",
                        )}
                      </legend>
                      {draft.options.map((option, index) => (
                        <label key={index} className="qp-option-input">
                          <input
                            type="radio"
                            name="correct-answer"
                            aria-label={`${t("সঠিক উত্তর", "Correct answer")} ${n(index + 1)}`}
                            checked={draft.answer === String(index)}
                            onChange={() => setDraft((q) => ({ ...q, answer: String(index) }))}
                            required
                          />
                          <span>{n(index + 1)}</span>
                          <input
                            required
                            dir="auto"
                            value={option}
                            placeholder={`${t("অপশন", "Option")} ${n(index + 1)}`}
                            onChange={(e) =>
                              setDraft((q) => ({
                                ...q,
                                options: q.options.map((o, i) =>
                                  i === index ? e.target.value : o,
                                ),
                              }))
                            }
                          />
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {draft.type !== "mcq" && (
                    <details className="qp-full qp-optional" key={draft.id}>
                      <summary>{t("নমুনা উত্তর (ঐচ্ছিক)", "Model answer (optional)")}</summary>
                      <label>
                        <span className="sr-only">{t("নমুনা উত্তর", "Model answer")}</span>
                        <textarea
                          dir="auto"
                          rows={2}
                          value={draft.answer}
                          onChange={(e) => setDraft((q) => ({ ...q, answer: e.target.value }))}
                          placeholder={t(
                            "শুধু শিক্ষকের জন্য; প্রিন্টে থাকবে না",
                            "For teachers; excluded from print",
                          )}
                        />
                      </label>
                    </details>
                  )}
                  <label>
                    {t("প্রশ্নের নম্বর", "Marks")}
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      required
                      value={draft.marks || ""}
                      onChange={(e) => setDraft((q) => ({ ...q, marks: Number(e.target.value) }))}
                    />
                  </label>
                  <div className="qp-add-action">
                    {editing && (
                      <button type="button" className="qp-button" onClick={resetDraft}>
                        {t("বাতিল", "Cancel")}
                      </button>
                    )}
                    <button type="submit" className="qp-button qp-primary">
                      <Plus size={17} />
                      {editing ? t("আপডেট করুন", "Update") : t("প্রশ্ন যোগ করুন", "Add question")}
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <section className="qp-card">
              <div className="qp-section-heading">
                <span className="qp-section-icon">
                  <ListChecks size={19} />
                </span>
                <div>
                  <h2>
                    {t("প্রশ্নের তালিকা", "Your questions")}{" "}
                    <span className="qp-count">{n(paper.questions.length)}</span>
                  </h2>
                  <p>
                    {t(
                      "সম্পাদনা করুন ও আপনার মতো করে সাজান",
                      "Edit and arrange in the order you need",
                    )}
                  </p>
                </div>
              </div>
              {!paper.questions.length ? (
                <div className="qp-empty small">
                  <FileText size={29} />
                  <p>{t("প্রথম প্রশ্নটি যোগ করুন", "Add your first question")}</p>
                </div>
              ) : (
                <div className="qp-question-list">
                  {paper.questions.map((q, index) => (
                    <div className="qp-question-item" key={q.id}>
                      <span className="qp-question-number">{n(index + 1)}</span>
                      <div className="qp-question-summary">
                        <p dir="auto">{q.text}</p>
                        <span>
                          {q.type === "mcq"
                            ? t("বহুনির্বাচনি", "MCQ")
                            : q.type === "short"
                              ? t("সংক্ষিপ্ত", "Short answer")
                              : t("লিখিত", "Written")}{" "}
                          · {n(q.marks)} {t("নম্বর", "marks")}
                        </span>
                      </div>
                      <div className="qp-question-controls">
                        <button
                          disabled={index === 0}
                          aria-label={t("উপরে নিন", "Move up")}
                          onClick={() => move(index, -1)}
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          disabled={index === paper.questions.length - 1}
                          aria-label={t("নিচে নিন", "Move down")}
                          onClick={() => move(index, 1)}
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          aria-label={t("প্রশ্ন সম্পাদনা", "Edit question")}
                          onClick={() => {
                            setDraft({ ...q, options: [...q.options] });
                            setEditing(q.id);
                            questionInput.current?.focus();
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          aria-label={t("প্রশ্ন কপি", "Duplicate question")}
                          onClick={() =>
                            patch({
                              questions: [
                                ...paper.questions.slice(0, index + 1),
                                { ...q, id: crypto.randomUUID(), options: [...q.options] },
                                ...paper.questions.slice(index + 1),
                              ],
                            })
                          }
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          className="qp-delete"
                          aria-label={t("প্রশ্ন মুছুন", "Delete question")}
                          onClick={() => {
                            patch({
                              questions: paper.questions.filter((item) => item.id !== q.id),
                            });
                            if (editing === q.id) resetDraft();
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="qp-preview-column" aria-label={t("লাইভ প্রিভিউ", "Live preview")}>
            <div className="qp-preview-toolbar">
              <div>
                <Eye size={18} />
                <strong>{t("লাইভ প্রিভিউ", "Live preview")}</strong>
                <span>A4</span>
              </div>
              <button className="qp-button" onClick={doPrint}>
                <Printer size={16} />
                {t("প্রিন্ট / PDF", "Print / PDF")}
              </button>
            </div>
            <div className="qp-preview-stage">
              <article className="qp-paper">
                <header>
                  <h2 dir="auto">
                    {paper.institution || t("আপনার প্রতিষ্ঠানের নাম", "Your institution name")}
                  </h2>
                  {paper.address && <p className="qp-paper-address">{paper.address}</p>}
                  <h3>{paper.title || t("পরীক্ষার নাম", "Examination title")}</h3>
                  <div className="qp-paper-class-subject">
                    <span>
                      {t("শ্রেণি", "Class")}: {paper.className || "…………"}
                    </span>
                    <span>
                      {t("বিষয়", "Subject")}: {paper.subject || "………………"}
                    </span>
                  </div>
                  <div className="qp-paper-meta">
                    <span>
                      {t("সময়", "Time")}: {paper.duration || "…………"}
                    </span>
                    <span>
                      {t("পূর্ণমান", "Marks")}: {n(totalMarks(paper))}
                    </span>
                  </div>
                  {layout.headerLineStyle !== "none" && (
                    <div
                      className="qp-paper-header-line"
                      aria-hidden="true"
                      style={{
                        borderTop: `${layout.headerLineStyle === "double" ? layout.headerLineThickness + 2 : layout.headerLineThickness}px ${layout.headerLineStyle} currentColor`,
                      }}
                    />
                  )}
                </header>
                {paper.instructions && (
                  <p
                    dir="auto"
                    className={`qp-paper-instructions${layout.instructionsBold ? " qp-text-bold" : ""}`}
                    style={{ fontWeight: layout.instructionsBold ? 700 : 400 }}
                  >
                    {paper.instructions}
                  </p>
                )}
                {paper.questions.length ? (
                  <div className="qp-paper-questions" style={{ gap: layout.questionSpacing }}>
                    {paper.questions.map((q, i) => (
                      <section key={q.id} className={q.bold ? "qp-question-bold" : undefined}>
                        <div className="qp-paper-question">
                          <strong>{n(i + 1)}.</strong>
                          <p dir="auto">{q.text}</p>
                          <strong>{n(q.marks)}</strong>
                        </div>
                        {q.type === "mcq" && (
                          <div className="qp-paper-options">
                            {q.options.map((o, j) => (
                              <p dir="auto" key={j}>
                                {n(j + 1)}) {o}
                              </p>
                            ))}
                          </div>
                        )}
                        {showAnswers && q.answer && (
                          <p className="qp-answer">
                            {t("উত্তর", "Answer")}:{" "}
                            {q.type === "mcq" ? q.options[Number(q.answer)] : q.answer}
                          </p>
                        )}
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="qp-preview-empty">
                    <p>
                      {t("প্রশ্ন যোগ করলে এখানে দেখা যাবে।", "Added questions will appear here.")}
                    </p>
                  </div>
                )}
                {layout.footerText && (
                  <footer
                    dir="auto"
                    className={layout.footerBold ? "qp-text-bold" : undefined}
                    style={{ fontWeight: layout.footerBold ? 700 : 400 }}
                  >
                    {layout.footerText}
                  </footer>
                )}
              </article>
            </div>
            <div className="qp-preview-footer">
              <label>
                <input
                  type="checkbox"
                  checked={showAnswers}
                  onChange={(e) => setShowAnswers(e.target.checked)}
                />
                {t("উত্তর দেখুন (শুধু প্রিভিউ)", "Show answers (preview only)")}
              </label>
              <span>
                {dirty
                  ? t("পরিবর্তন সংরক্ষণ করুন", "Save your changes")
                  : t("প্রিন্টের জন্য A4 ফরম্যাট", "A4 print layout")}
              </span>
            </div>
            <div className="qp-tip">
              <CheckCircle2 size={19} />
              <p>
                {t(
                  "প্রিন্ট বাটন থেকে “Save as PDF” বেছে নিয়ে প্রশ্নপত্র PDF হিসেবে রাখতে পারবেন। উত্তর প্রিন্ট হবে না।",
                  "Choose “Save as PDF” in the print dialog to download your paper. Answers are excluded.",
                )}
              </p>
            </div>
          </section>
        </div>
      ) : (
        <section className="qp-card qp-library">
          <div className="qp-library-heading">
            <div>
              <h2>{t("আমার প্রশ্নপত্র", "My question papers")}</h2>
              <p>
                {t(
                  "প্রতিষ্ঠানের সংরক্ষিত প্রশ্নপত্র খুঁজুন, খুলুন ও সম্পাদনা করুন।",
                  "Find, open and edit your institution’s saved question papers.",
                )}
              </p>
            </div>
            <button
              className="qp-button"
              disabled={loading}
              onClick={() => setReload((v) => v + 1)}
            >
              <FolderOpen size={17} />
              {t("তালিকা রিফ্রেশ", "Refresh list")}
            </button>
          </div>
          <label className="qp-search">
            <Search size={18} />
            <input
              aria-label={t("প্রশ্নপত্র খুঁজুন", "Search papers")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "পরীক্ষা, বিষয় বা শ্রেণি দিয়ে খুঁজুন…",
                "Search by exam, subject or class…",
              )}
            />
          </label>
          {loading ? (
            <div className="qp-empty" role="status">
              {t("লোড হচ্ছে…", "Loading…")}
            </div>
          ) : !saved.length ? (
            <div className="qp-empty">
              <FolderOpen size={42} strokeWidth={1.3} />
              <h3>{t("কোনো প্রশ্নপত্র নেই", "No saved papers")}</h3>
              <p>
                {t(
                  "প্রশ্নপত্র তৈরি করে সংরক্ষণ করলে এখানে পাবেন।",
                  "Create and save a paper to see it here.",
                )}
              </p>
              <button className="qp-button qp-primary" onClick={startNew}>
                <Plus size={17} />
                {t("প্রশ্নপত্র তৈরি করুন", "Create a paper")}
              </button>
            </div>
          ) : (
            <div className="qp-library-grid">
              {saved
                .filter((p) =>
                  `${p.title} ${p.subject} ${p.className}`
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
                )
                .map((p) => (
                  <article key={p.id} className="qp-saved-paper">
                    <span className="qp-saved-icon">
                      <FileText size={27} />
                    </span>
                    <h3>{p.title}</h3>
                    <p>
                      {[p.subject, p.className].filter(Boolean).join(" · ") ||
                        t("খসড়া প্রশ্নপত্র", "Draft paper")}
                    </p>
                    <div className="qp-saved-meta">
                      <span>
                        {n(p.questions.length)} {t("প্রশ্ন", "questions")} · {n(totalMarks(p))}{" "}
                        {t("নম্বর", "marks")}
                      </span>
                      <time>
                        {Number.isNaN(Date.parse(p.updatedAt))
                          ? "—"
                          : new Date(p.updatedAt).toLocaleDateString(
                              lang === "bn" ? "bn-BD" : "en-GB",
                            )}
                      </time>
                    </div>
                    <div className="qp-saved-actions">
                      <button
                        className="qp-button"
                        onClick={() =>
                          guardChanges(() => {
                            setPaper(p);
                            setCustomClosingNote("");
                            setCustomInstructionNote("");
                            resetDraft();
                            setDirty(false);
                            setTab("editor");
                            setMessage("");
                            setError("");
                          })
                        }
                      >
                        <Pencil size={15} />
                        {t("খুলুন", "Open")}
                      </button>
                      <button
                        className="qp-button"
                        aria-label={t("প্রশ্নপত্র কপি", "Duplicate paper")}
                        onClick={() => void duplicatePaper(p)}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="qp-button qp-delete"
                        aria-label={t("প্রশ্নপত্র মুছুন", "Delete paper")}
                        onClick={() =>
                          setConfirm({
                            label: t(
                              "এই সংরক্ষিত প্রশ্নপত্রটি মুছে ফেলবেন?",
                              "Delete this saved question paper?",
                            ),
                            action: () => {
                              void deletePaper(p);
                            },
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              {saved.length > 0 &&
                !saved.some((p) =>
                  `${p.title} ${p.subject} ${p.className}`
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
                ) && <p>{t("কোনো প্রশ্নপত্র পাওয়া যায়নি।", "No matching papers.")}</p>}
            </div>
          )}
        </section>
      )}
    </fieldset>
  );
}
