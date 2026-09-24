import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import PaginatedReportPreview from "../../components/Report/PaginatedReportPreview";
import { Orientation, PaperSize, PageMargins } from "../../components/common/DataExportPrintActions";
import { getDefaultPageMargins } from "../../components/Report/pagination/pageGeometry";
import ReportFilterBar from "../../components/Report/ReportFilterBar";
import { MarksheetSettingsPanel } from "../../components/Report/student/MarksheetSignatureControls";
import { AdmitCardSettingsPanel } from "../../components/Report/documents/AdmitCardFieldControls";
import ReportSidebar from "../../components/Report/ReportSidebar";
import FilterSelect from "../../components/common/FilterSelect";
import ColumnVisibilityMenu from "../../components/common/ColumnVisibilityMenu";
import { withSubjectColumns } from "../../components/Report/academic/AcademicResultPrint";
import { useColumnVisibility } from "../../hooks/useColumnVisibility";
import { useAuthStore } from "../../store/authStore";
import { ClassItem, Division, ExamItem, ReportColumn, ReportShellProps } from "./types";
import { examCoversDivision, examsForDivision } from "../../components/ExamPanel/examDivisionScope";
import { getRowClassId, getRowDivisionId } from "@madrasha/shared-ui/src/utils/reportUtils";
import { filterPeopleBySearch } from "../../utils/personSearch";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { listTemplates, type TemplateListItemDto } from "../../services/documentTemplateLibraryApi";
import { useIdCardBackStore } from "../../store/idCardBackStore";
import { useSelectedTemplateOverrideStore, type CardsPerPage } from "../../store/selectedTemplateOverrideStore";
import {
  DEFAULT_ID_CARD_BACK_ID,
  getBuiltinDesign,
} from "@madrasha/shared-ui/src/components/DocumentDesigner/builtin/registry";

export type { ReportColumn, ReportMenuItem } from "./types";

type ReportSubject = {
  book_id?: number | string;
  subject_name?: string;
  mark?: number | string | null;
};

const getReportSubjects = (row: Record<string, any>): ReportSubject[] => {
  const subjects = row?.subjects;
  if (Array.isArray(subjects)) return subjects;

  if (typeof subjects === "string") {
    try {
      const parsed = JSON.parse(subjects);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

// Result sheets (academic-result) print the subject-name heading only on the
// first page by default; this per-user switch repeats it on every page. Kept in
// localStorage per madrasa so the choice sticks, and forwarded to the server
// PDF export (?repeat_header=1) since that headless browser has no storage.
const repeatHeaderStorageKey = (madrasaSlug: string) => `report-repeat-header:${madrasaSlug}`;

const readRepeatHeaderPref = (madrasaSlug: string) => {
  try {
    return localStorage.getItem(repeatHeaderStorageKey(madrasaSlug)) === "1";
  } catch {
    return false;
  }
};

const ReportShell = ({
  pageTitle,
  pageSubtitle,
  accentTitle,
  reports,
  hideBrandHeader = false,
  showSearch = false,
  reportsPageKey,
  printMode = false,
}: ReportShellProps) => {
  const [searchParams] = useSearchParams();
  // In print mode the active report comes from the URL (?key=...) rather
  // than defaulting to the first menu item - set directly in initial state
  // (not an effect) so it's correct on the very first render and the
  // "reset filters on activeKey change" effect below never sees activeKey
  // change again after mount, which would otherwise wipe out the
  // division/class/orientation values the hydration effect further down
  // sets.
  // Outside print mode a ?key=... link (e.g. শিক্ষার্থী প্রোফাইলের "আইডি কার্ড
  // প্রিন্ট" / "মার্কশিট ডাউনলোড") opens that report with its filters
  // pre-filled - hydrated by the same effect print mode uses.
  const urlPrefill = !printMode && searchParams.has("key");
  const [activeKey, setActiveKey] = useState(() => {
    const urlKey = printMode || urlPrefill ? searchParams.get("key") : null;
    return (urlKey && reports.some((item) => item.key === urlKey) ? urlKey : reports[0]?.key) || "";
  });
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);

  // Starts true (rather than waiting for the first loadReport() call to flip
  // it) so the very first paint shows the loading skeleton instead of
  // briefly flashing the "কোনো ডাটা পাওয়া যায়নি" empty state before any
  // fetch has even had a chance to run.
  const [loading, setLoading] = useState(true);
  const [examsLoaded, setExamsLoaded] = useState(false);
  const [warning, setWarning] = useState("");
  // Print mode hydrates its filters (division/class/exam/...) from the URL
  // in an effect below - false until that finishes (including its async
  // loadClassesByDivision leg), so the data-fetch effect never fires on the
  // pre-hydration "no division selected" state first. See that effect's own
  // comment for the empty-PDF bug this was causing. Non-print mode has
  // nothing to hydrate, so it starts (and stays) true.
  const [hydrated, setHydrated] = useState(!printMode && !urlPrefill);

  const [search, setSearch] = useState("");
  // একজন নির্দিষ্ট শিক্ষার্থীতে সীমাবদ্ধ (প্রোফাইল থেকে আসা ?student_id=) - DB id,
  // registration_no/roll নয়, কারণ ছোট রেজি. নম্বর অন্য কারো রোলের সাথে মিলে যেতে পারে।
  const [studentFilter, setStudentFilter] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margins, setMargins] = useState<PageMargins>(() => getDefaultPageMargins("a4"));
  const [page, setPage] = useState(1);
  // Marksheet report only: docked settings panel next to the preview.
  const [marksheetPanelOpen, setMarksheetPanelOpen] = useState(false);
  // Admit-card report only: docked field-settings panel next to the preview.
  const [admitCardPanelOpen, setAdmitCardPanelOpen] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [templates, setTemplates] = useState<TemplateListItemDto[]>([]);
  const selectedTemplateId = useSelectedTemplateOverrideStore((s) => s.templateId);
  const setSelectedTemplateId = useSelectedTemplateOverrideStore((s) => s.setTemplateId);
  const cardsPerPage = useSelectedTemplateOverrideStore((s) => s.cardsPerPage);
  const setCardsPerPage = useSelectedTemplateOverrideStore((s) => s.setCardsPerPage);
  const idCardBackId = useSelectedTemplateOverrideStore((s) => s.idCardBackId);
  const setIdCardBackId = useSelectedTemplateOverrideStore((s) => s.setIdCardBackId);
  const idCardPairBackId = useSelectedTemplateOverrideStore((s) => s.idCardPairBackId);
  const setIdCardPairBackId = useSelectedTemplateOverrideStore((s) => s.setIdCardPairBackId);
  const idCardBackWithFront = useSelectedTemplateOverrideStore((s) => s.idCardBackWithFront);
  const setIdCardBackWithFront = useSelectedTemplateOverrideStore((s) => s.setIdCardBackWithFront);
  // অ্যাডমিনের সেট করা ডিফল্ট পিছনের ডিজাইন (Talimat → ডকুমেন্টস টেমপ্লেট → আইডি কার্ড ব্যাক)। ব্যবহারকারী
  // ড্রপডাউনে নিজে বেছে নিলে (বা print URL-এ id_back থাকলে) আর ডিফল্ট দিয়ে ওভাররাইট হয় না।
  const tenantBackDefault = useIdCardBackStore((s) => s.settings?.default_design_id) ?? DEFAULT_ID_CARD_BACK_ID;
  const fetchIdCardBackSettings = useIdCardBackStore((s) => s.fetchSettings);
  const backChosenByUser = useRef(false);
  const pairChosenByUser = useRef(false);

  const activeReport = useMemo(
    () => reports.find((item) => item.key === activeKey) || reports[0],
    [activeKey, reports],
  );

  // Reports that offer a "কলাম" menu (ReportMenuItem.columnOptions) get the
  // user's own show/hide/order pick swapped in for `columns` below, so the
  // preview, print, Excel/CSV and server PDF all read one column list. Print
  // mode runs in a fresh headless browser with no saved preference, so it
  // reads the pick from the ?columns= param the export builds instead (see
  // serverPdfExport below) and never touches storage.
  const madrasaSlug = useAuthStore((s) => s.madrasaSlug) || "";
  const supportsRepeatHeader = activeReport.printable === "academic-result";
  const [repeatHeaderPref, setRepeatHeaderPref] = useState<boolean>(() =>
    printMode ? searchParams.get("repeat_header") === "1" : readRepeatHeaderPref(madrasaSlug),
  );
  const repeatTableHeader = supportsRepeatHeader && repeatHeaderPref;
  const toggleRepeatHeader = () => {
    const next = !repeatHeaderPref;
    setRepeatHeaderPref(next);
    try {
      localStorage.setItem(repeatHeaderStorageKey(madrasaSlug), next ? "1" : "0");
    } catch {
      // storage unavailable - the choice just lasts for this session
    }
  };
  const columnOptions = activeReport.columnOptions;
  const columnOptionKeys = useMemo(() => columnOptions?.map((c) => c.key) ?? [], [columnOptions]);
  const defaultColumnKeys = useMemo(
    () => activeReport.columns.map((c) => c.key),
    [activeReport.columns],
  );
  const columnPrefs = useColumnVisibility<string>(
    columnOptions && !printMode ? `report-columns:${madrasaSlug}:${activeReport.key}` : null,
    columnOptionKeys,
    defaultColumnKeys,
  );
  const [printColumnKeys] = useState<string[] | null>(() => {
    const raw = printMode ? searchParams.get("columns") : null;
    return raw ? raw.split(",").filter(Boolean) : null;
  });

  const columnMenuOptions = useMemo(
    () => columnOptions?.map((c) => ({ key: c.key, label: c.header })) ?? [],
    [columnOptions],
  );

  // A report always keeps at least one column - unchecking the last visible
  // one would leave an empty table.
  const toggleReportColumn = (key: string) => {
    if (columnPrefs.visible.size === 1 && columnPrefs.visible.has(key)) return;
    columnPrefs.toggle(key);
  };

  const effectiveReport = useMemo(() => {
    if (!columnOptions) return activeReport;

    const byKey = new Map(columnOptions.map((c) => [c.key, c]));
    const keys = printColumnKeys ?? columnPrefs.order.filter((key) => columnPrefs.visible.has(key));
    const picked = keys.map((key) => byKey.get(key)).filter((c): c is ReportColumn => !!c);

    return picked.length ? { ...activeReport, columns: picked } : activeReport;
  }, [activeReport, columnOptions, columnPrefs.order, columnPrefs.visible, printColumnKeys]);

  const showMarksheetPanel = effectiveReport.printable === "marksheet" && marksheetPanelOpen;
  const showAdmitCardPanel = effectiveReport.printable === "admit-card" && admitCardPanelOpen;

  // The "ফলাফল" / "ফলাফল (মেধাক্রম অনুযায়ী)" reports are the only ones whose
  // endpoint understands page/page_size - every other report keeps loading
  // its whole (division/class-narrowed) result set in one shot, exactly as
  // before.
  const isPaginatedAcademicResult = activeReport.printable === "academic-result";
  // Reports flagged requiresDivision (academic-result/result-notice/class
  // -routine) can return a heavy, mostly-wasted payload with no division
  // filter - see ReportMenuItem.requiresDivision.
  const divisionRequired = !!activeReport.requiresDivision;
  // On "ডকুমেন্ট সমূহ" (showSearch=true), the ID/নাম/মোবাইল box exists
  // specifically to find one student without knowing their division/class
  // first - so an active search bypasses the "pick a division" gate below
  // and falls back to fetching the full (unfiltered) roster, exactly like
  // before requiresDivision existed. Boolean, not the raw text, so typing
  // more characters doesn't retrigger the fetch effect on every keystroke -
  // narrowing further is still handled client-side by filteredRows.
  const hasSearchQuery = search.trim().length > 0;
  // A specific division picked but no class yet: don't auto-load "all classes"
  // of that division - the user must pick a class first (the শ্রেণি dropdown
  // shows "শ্রেণি নির্বাচন করুন"). Teacher reports have no class dropdown, and
  // "সকল বিভাগ" keeps loading everything as before.
  const classRequired =
    divisionRequired &&
    activeReport.printable !== "teacher-list" &&
    activeReport.printable !== "teacher-phone-list" &&
    !!selectedDivision &&
    selectedDivision !== "all" &&
    !selectedClass &&
    !hasSearchQuery;

  // Guards against an older, slower loadReport() call resolving AFTER a
  // newer one (production network jitter makes this far more likely than
  // it seems in dev) and clobbering fresh rows with a stale/empty result -
  // every setRows/setWarning/setLoading below only applies if this call is
  // still the most recent one by the time it gets there.
  const loadRequestIdRef = useRef(0);

  const loadReport = async () => {
    if (!activeReport?.endpoint) return;
    const requestId = ++loadRequestIdRef.current;
    const isCurrent = () => requestId === loadRequestIdRef.current;

    try {
      setLoading(true);
      setWarning("");

      if (activeReport.requiresExam && !selectedExam) {
        if (isCurrent()) {
          setRows([]);
          setTotalCount(0);
          setWarning("পরীক্ষা নির্বাচন করুন");
        }
        return;
      }

      if (divisionRequired && !selectedDivision && !hasSearchQuery) {
        if (isCurrent()) {
          setRows([]);
          setTotalCount(0);
          setWarning("বিভাগ নির্বাচন করুন");
        }
        return;
      }

      if (classRequired) {
        if (isCurrent()) {
          setRows([]);
          setTotalCount(0);
          setWarning("শ্রেণি নির্বাচন করুন");
        }
        return;
      }

      const params = new URLSearchParams();
      if (activeReport.requiresExam) params.set("exam_id", selectedExam);
      if (activeReport.extraParams) {
        Object.entries(activeReport.extraParams).forEach(([key, value]) => params.set(key, value));
      }
      if (divisionRequired) {
        if (selectedDivision && selectedDivision !== "all") params.set("division_id", selectedDivision);
        if (selectedClass && selectedClass !== "all") params.set("class_id", selectedClass);
      }
      if (isPaginatedAcademicResult) {
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
      }
      const query = params.toString();
      const res = await cachedGet(`${activeReport.endpoint}${query ? `?${query}` : ""}`);
      if (!isCurrent()) return;

      const data =
        res.data?.data || res.data?.students || res.data?.teachers || res.data?.result || [];

      setRows(Array.isArray(data) ? data : []);
      setTotalCount(
        typeof res.data?.total === "number" ? res.data.total : Array.isArray(data) ? data.length : 0,
      );
      setWarning(res.data?.warning || "");
    } catch (error: any) {
      logger.error("REPORT LOAD ERROR:", error);
      if (isCurrent()) {
        setRows([]);
        setTotalCount(0);
        setWarning(error?.response?.data?.message || "রিপোর্ট লোড করা যায়নি");
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  const loadDivisions = async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      const data = res.data?.data || res.data?.result || res.data || [];
      setDivisions(Array.isArray(data) ? data : []);
    } catch {
      setDivisions([]);
    }
  };

  const loadExams = async () => {
    try {
      const res = await cachedGet("/exams", { params: { active_only: true } });
      const data = res.data?.data || res.data?.result || res.data || [];
      const examRows = Array.isArray(data) ? data : [];
      setExams(examRows);
      // Functional update: this runs once from a mount-time closure where
      // selectedExam is still "", so reading it directly always defaulted to
      // the first exam - which in print mode overwrote the exam_id the URL had
      // just hydrated (server PDF showing a different exam than the preview).
      if (examRows.length) setSelectedExam((current) => current || String(examRows[0].id));
    } catch {
      setExams([]);
    } finally {
      setExamsLoaded(true);
    }
  };

  const loadClassesByDivision = async (divisionId: string) => {
    setSelectedClass("");

    if (!divisionId || divisionId === "all") {
      setClasses([]);
      return;
    }

    try {
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      const data = res.data?.data || res.data?.result || res.data || [];
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    }
  };

  useEffect(() => {
    loadDivisions();
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSearch("");
    setStudentFilter("");
    setSelectedDivision("");
    setSelectedClass("");
    setClasses([]);
    setSelectedSubject("");
    setPage(1);
    setOrientation(activeReport.defaultOrientation || "portrait");
    setPaperSize(activeReport.defaultPaperSize || "a4");
    setSelectedTemplateId(null);
    // আইডি কার্ড ডিফল্টে "একক শিক্ষার্থী" (প্রতি পাতায় ১টি); বাকিগুলোতে স্বয়ংক্রিয়।
    setCardsPerPage(activeReport.printable === "id-card" ? "1" : "auto");
    // আইডি কার্ড "একক শিক্ষার্থী": ডিফল্টে দুই পাশ (সামনে + পিছনে)।
    pairChosenByUser.current = false;
    setIdCardPairBackId(tenantBackDefault);
    setIdCardBackWithFront(true);
    backChosenByUser.current = false;
    setIdCardBackId(tenantBackDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, activeReport.defaultOrientation, activeReport.defaultPaperSize]);

  useEffect(() => {
    if (activeReport.printable === "id-card") fetchIdCardBackSettings();
  }, [activeReport.printable, fetchIdCardBackSettings]);

  useEffect(() => {
    if (!backChosenByUser.current) setIdCardBackId(tenantBackDefault);
    if (!pairChosenByUser.current) setIdCardPairBackId(tenantBackDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantBackDefault]);

  const handleIdCardBackChange = (id: number | null) => {
    backChosenByUser.current = true;
    setIdCardBackId(id);
  };

  // ডিজাইন বদলালে কাগজের দিকও সেটার সাথে মিলিয়ে নেয় (ল্যান্ডস্কেপ সনদ → ল্যান্ডস্কেপ পাতা),
  // যাতে ডিজাইন ছোট হয়ে আঁটার বদলে পুরো পাতা জুড়ে বসে। DB টেমপ্লেটের মাপ তালিকায় নেই,
  // তাই শুধু বিল্ট-ইন ডিজাইনে প্রযোজ্য।
  const handleTemplateChange = (id: number | null) => {
    setSelectedTemplateId(id);
    const design = getBuiltinDesign(id);
    // প্রবেশপত্র সবসময় শিটে (২টি উপর-নিচ) বসে - ডিজাইনের ল্যান্ডস্কেপ মাপে কাগজ ঘোরানো হয় না।
    if (activeReport.printable === "admit-card" || activeReport.printable === "book-label") return;
    if (design) setOrientation(design.width > design.height ? "landscape" : "portrait");
    else if (id === null) setOrientation(activeReport.defaultOrientation || "portrait");
  };

  // Print mode: the user's custom margins arrive as margin_* URL params (see
  // serverPdfExport below). Read once up front - the paperSize effect below
  // fires again after hydration changes paperSize, and must not reset them.
  const [printMargins] = useState<PageMargins | null>(() => {
    if (!printMode) return null;
    const read = (key: string) => {
      const raw = searchParams.get(key);
      const value = raw === null || raw === "" ? NaN : Number(raw);
      return Number.isFinite(value) && value >= 0 && value <= 40 ? value : null;
    };
    const top = read("margin_top");
    const right = read("margin_right");
    const bottom = read("margin_bottom");
    const left = read("margin_left");
    return top === null || right === null || bottom === null || left === null
      ? null
      : { top, right, bottom, left };
  });

  useEffect(() => {
    setMargins(printMargins ?? getDefaultPageMargins(paperSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperSize]);

  // Print-mode only, runs once on mount: hydrates the filter state a headless
  // browser can't set by clicking through the UI, straight from the URL
  // query string the backend export service builds (see
  // report-export.service.ts). Everything the on-screen preview depends on
  // must be threaded through here (filters, search, page/page size, margins),
  // otherwise the exported PDF silently differs from what the user saw.
  useEffect(() => {
    if (!printMode && !urlPrefill) return;

    const examId = searchParams.get("exam_id");
    if (examId) setSelectedExam(examId);

    const searchText = searchParams.get("search");
    if (searchText) setSearch(searchText);

    const studentIdParam = searchParams.get("student_id");
    if (studentIdParam) setStudentFilter(studentIdParam);

    const pageParam = Number(searchParams.get("page"));
    if (Number.isInteger(pageParam) && pageParam >= 1) setPage(pageParam);

    const pageSizeParam = Number(searchParams.get("page_size"));
    if (Number.isInteger(pageSizeParam) && pageSizeParam >= 1) setPageSize(pageSizeParam);

    const subject = searchParams.get("subject");
    if (subject) setSelectedSubject(subject);

    const templateId = searchParams.get("template_id");
    if (templateId) setSelectedTemplateId(Number(templateId));

    const cardsPerPageParam = searchParams.get("cards_per_page");
    if (
      cardsPerPageParam === "auto" ||
      cardsPerPageParam === "grid" ||
      cardsPerPageParam === "1" ||
      cardsPerPageParam === "2"
    ) {
      setCardsPerPage(cardsPerPageParam as CardsPerPage);
    }

    if (searchParams.get("id_with_front") === "0") setIdCardBackWithFront(false);

    const idPairParam = searchParams.get("id_pair");
    if (idPairParam === "none") {
      pairChosenByUser.current = true;
      setIdCardPairBackId(null);
    } else if (idPairParam && Number.isInteger(Number(idPairParam))) {
      pairChosenByUser.current = true;
      setIdCardPairBackId(Number(idPairParam));
    }

    const idBackParam = searchParams.get("id_back");
    if (idBackParam === "none") {
      backChosenByUser.current = true;
      setIdCardBackId(null);
    } else if (idBackParam && Number.isInteger(Number(idBackParam))) {
      backChosenByUser.current = true;
      setIdCardBackId(Number(idBackParam));
    }

    const paperSizeParam = searchParams.get("paper_size");
    if (paperSizeParam === "a4" || paperSizeParam === "a5") setPaperSize(paperSizeParam);

    const orientationParam = searchParams.get("orientation");
    if (orientationParam === "portrait" || orientationParam === "landscape") {
      setOrientation(orientationParam);
    }

    const divisionId = searchParams.get("division_id");
    const classId = searchParams.get("class_id");
    if (divisionId) {
      setSelectedDivision(divisionId);
      loadClassesByDivision(divisionId).then(() => {
        if (classId) setSelectedClass(classId);
        setHydrated(true);
      });
    } else {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printMode, urlPrefill]);

  // A requiresDivision report also refetches on division/class change, since
  // those are sent to the server as real filters now - the paginated
  // academic-result ones additionally refetch on page/pageSize, and
  // hasSearchQuery re-triggers the one fetch a bypassed-gate search needs
  // (see hasSearchQuery above). Folded into one string so the effect fires
  // exactly once per meaningful change instead of racing two effects.
  const loadTrigger = divisionRequired
    ? `${activeKey}|${selectedExam}|${selectedDivision}|${selectedClass}|${hasSearchQuery}|${isPaginatedAcademicResult ? `${page}|${pageSize}` : ""}`
    : `${activeKey}|${selectedExam}`;

  useEffect(() => {
    // Print mode: don't fire on the pre-hydration state (selectedDivision
    // etc still "") - the URL-hydration effect above hasn't set the real
    // filters yet at the moment this effect first runs, since its own
    // loadClassesByDivision leg is async. Without this guard, a
    // divisionRequired report's early "no division picked" branch in
    // loadReport() sets loading:false with empty rows almost instantly,
    // which is indistinguishable from a genuinely-empty report to
    // PaginatedReportPreview's data-report-ready attribute - so the
    // server-side PDF export's headless browser can capture the PDF right
    // in that window, producing a page with the report's structure but no
    // data. See the loadRequestIdRef guard in loadReport() for the other
    // half of this fix (an in-flight stale request finishing late).
    if (printMode && !hydrated) return;

    // For an exam-requiring report, loadExams() auto-selects the first exam
    // once it resolves - but that's a separate async call from this effect,
    // so on mount selectedExam is still "" for a moment even though an exam
    // will shortly be picked. Loading report data before exams have finished
    // loading would wrongly conclude "no exam selected" and flash the
    // "পরীক্ষা নির্বাচন করুন" warning before the real exam (and its data) ever
    // gets a chance to load - so just wait for that first exams response.
    if (activeReport.requiresExam && !selectedExam && !examsLoaded) return;
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTrigger, examsLoaded, hydrated]);

  useEffect(() => {
    const documentType = activeReport.documentType;
    if (!documentType) {
      setTemplates([]);
      return;
    }

    let cancelled = false;
    listTemplates(documentType)
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeReport.documentType]);

  // Subjects/books are tied to a class (see reports.repository.ts's
  // `b.class_id = s.class_id` join), so listing every subject across ALL
  // loaded classes at once would jumble together books that don't even
  // belong to the same jamat. Scoped to selectedClass instead - empty until
  // a class is picked, matching how the শ্রেণি select itself stays empty
  // until a division is picked.
  const subjectOptions = useMemo(() => {
    if (!activeReport.hasSubjectFilter || !selectedClass || selectedClass === "all") return [];
    const map = new Map<string, string>();
    rows
      .filter((row) => String(getRowClassId(row)) === String(selectedClass))
      .forEach((row) => {
        getReportSubjects(row).forEach((subject, index) => {
          const key = String(subject.book_id ?? subject.subject_name ?? index);
          if (!map.has(key)) map.set(key, subject.subject_name || `বিষয় ${index + 1}`);
        });
      });
    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [rows, activeReport.hasSubjectFilter, selectedClass]);

  const searchedRows = filterPeopleBySearch(rows, search, (row) => ({
    text: [
      row.name,
      row.name_bn,
      row.student_name,
      row.teacher_name,
      row.father_name,
      row.mother_name,
      row.class_name,
      row.division_name,
      row.exam_name,
      row.status,
    ],
    registrationNo: row.registration_no,
    roll: row.roll,
    phones: [row.guardian_phone, row.mobile, row.phone],
  }), { numericQueryIdsOnly: true });

  const filteredRows = searchedRows.filter((row) => {
    const rowDivisionId = String(getRowDivisionId(row));
    const rowClassId = String(getRowClassId(row));
    return (
      (!studentFilter || String(row.student_id ?? row.id) === studentFilter) &&
      (!selectedDivision || selectedDivision === "all" || rowDivisionId === String(selectedDivision)) &&
      (!selectedClass || selectedClass === "all" || rowClassId === String(selectedClass))
    );
  });

  if (activeReport.printable === "teacher-list" || activeReport.printable === "teacher-phone-list") {
    filteredRows.sort(
      (a, b) => (Number(a.registration_no) || 0) - (Number(b.registration_no) || 0),
    );
  }

  const selectedDivisionName =
    divisions.find((division) => String(division.division_id) === String(selectedDivision))
      ?.division_name_bn || "";

  // Real id of the single division being reported (null for "all"/none) so the
  // result report can look up that division's own grade scale.
  const selectedDivisionId =
    selectedDivision && selectedDivision !== "all" && Number.isFinite(Number(selectedDivision))
      ? Number(selectedDivision)
      : null;

  const selectedClassName =
    classes.find((cls) => String(cls.class_id) === String(selectedClass))?.class_name_bn || "";

  // When a single subject is picked, narrow every row's `subjects` array down
  // to just that one before it reaches the print preview or the CSV/Excel
  // export builder below - students stay in the list, only their subject
  // columns shrink to the one selected.
  const displayRows: Record<string, any>[] =
    activeReport.hasSubjectFilter && selectedSubject
      ? filteredRows.map((row) => ({
          ...row,
          subjects: getReportSubjects(row).filter(
            (subject, index) =>
              String(subject.book_id ?? subject.subject_name ?? index) === selectedSubject,
          ),
        }))
      : filteredRows;

  let exportRows = displayRows;
  let exportColumns: ReportColumn[] = effectiveReport.columns;

  if (activeReport.printable === "academic-result") {
    const subjectMap = new Map<string, { key: string; name: string }>();

    displayRows.forEach((row) => {
      getReportSubjects(row).forEach((subject, index) => {
        const subjectId = String(subject.book_id ?? subject.subject_name ?? index);
        const key = `subject_${subjectId}`;
        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, {
            key,
            name: subject.subject_name || `বিষয় ${index + 1}`,
          });
        }
      });
    });

    const subjectColumns: ReportColumn[] = Array.from(subjectMap.values()).map((subject) => ({
      header: subject.name,
      key: subject.key,
    }));
    exportColumns = withSubjectColumns(effectiveReport.columns, subjectColumns);

    exportRows = displayRows.map((row) => {
      const flattenedRow = { ...row };
      getReportSubjects(row).forEach((subject, index) => {
        const subjectId = String(subject.book_id ?? subject.subject_name ?? index);
        flattenedRow[`subject_${subjectId}`] =
          subject.mark === null || subject.mark === undefined ? "" : subject.mark;
      });
      return flattenedRow;
    });
  }

  const clearFilters = () => {
    setSearch("");
    setStudentFilter("");
    setSelectedDivision("");
    setSelectedClass("");
    setClasses([]);
    setSelectedSubject("");
    setPage(1);
  };

  // Computed directly from filter state (not the async `warning` set inside
  // loadReport) so the preview shows the right guidance the instant a report
  // with no rows renders, rather than flashing the generic "কোনো ডাটা পাওয়া
  // যায়নি" text until the fetch effect catches up.
  const previewEmptyMessage = activeReport.requiresExam && !selectedExam
    ? "রিপোর্ট দেখতে উপর থেকে পরীক্ষা নির্বাচন করুন"
    : divisionRequired && !selectedDivision && !hasSearchQuery
      ? "রিপোর্ট দেখতে বিভাগ ও শ্রেণি নির্বাচন করুন"
      : classRequired
        ? "রিপোর্ট দেখতে শ্রেণি নির্বাচন করুন"
        : warning || undefined;

  const totalRecords = isPaginatedAcademicResult ? totalCount : filteredRows.length;
  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalCount);
  const hasPrevPage = page > 1;
  const hasNextPage = page * pageSize < totalCount;

  // Built once here (not inside DataExportPrintActions) since this is the
  // one place that already has every filter value the print route needs to
  // reproduce this exact view - see ReportShell's printMode hydration effect
  // above for the other end of this contract.
  const serverPdfExport = {
    reportsPage: reportsPageKey,
    reportKey: activeReport.key,
    filters: {
      exam_id: selectedExam || undefined,
      division_id: selectedDivision || undefined,
      class_id: selectedClass || undefined,
      subject: selectedSubject || undefined,
      template_id: selectedTemplateId ? String(selectedTemplateId) : undefined,
      cards_per_page: cardsPerPage !== "auto" ? cardsPerPage : undefined,
      id_with_front: activeReport.backOnly && !idCardBackWithFront ? "0" : undefined,
      id_pair:
        activeReport.printable === "id-card" && !activeReport.backOnly && idCardPairBackId !== tenantBackDefault
          ? idCardPairBackId === null
            ? "none"
            : String(idCardPairBackId)
          : undefined,
      id_back:
        activeReport.backOnly && idCardBackId !== tenantBackDefault
          ? idCardBackId === null
            ? "none"
            : String(idCardBackId)
          : undefined,
      columns: columnOptions ? effectiveReport.columns.map((c) => c.key).join(",") : undefined,
      repeat_header: repeatTableHeader ? "1" : undefined,
      search: search.trim() || undefined,
      student_id: studentFilter || undefined,
      page: isPaginatedAcademicResult ? String(page) : undefined,
      page_size: isPaginatedAcademicResult ? String(pageSize) : undefined,
      margin_top: String(margins.top),
      margin_right: String(margins.right),
      margin_bottom: String(margins.bottom),
      margin_left: String(margins.left),
    },
  };

  // Chrome-less: no sidebar/filter-bar/page header, nothing that isn't the
  // report itself - this is what the headless browser (server-side PDF
  // export) actually screenshots/prints. See PaginatedReportPreview's
  // data-report-ready attribute for how it signals "done rendering" back to
  // that headless browser.
  if (printMode) {
    return (
      <PaginatedReportPreview
        loading={loading}
        report={effectiveReport}
        rows={displayRows}
        selectedDivisionName={selectedDivisionName}
        selectedDivisionId={selectedDivisionId}
        selectedClassName={selectedClassName}
        repeatTableHeader={repeatTableHeader}
        hideBrandHeader={hideBrandHeader}
        paperSize={paperSize}
        orientation={orientation}
        margins={margins}
        emptyMessage={previewEmptyMessage}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] p-2 dark:bg-slate-950 sm:p-4 lg:p-6">
      {(accentTitle || pageTitle || pageSubtitle) && (
        <div className="no-print mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:mb-5 sm:p-5">
          {accentTitle && (
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
              {accentTitle}
            </div>
          )}
          {pageTitle && (
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">{pageTitle}</h1>
          )}
          {pageSubtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pageSubtitle}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5">
        <ReportSidebar reports={reports} activeKey={activeReport.key} onChange={setActiveKey} />

        <main
          className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
            showMarksheetPanel ? "overflow-clip" : "overflow-hidden"
          }`}
        >
          <div className="no-print border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
            <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  {activeReport.title}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">{activeReport.subtitle}</p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {studentFilter && (
                  <div className="flex w-fit items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 py-1 pl-2.5 pr-1 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300 sm:text-[13px]">
                    <span>
                      শুধু: <b className="font-bold">{filteredRows[0]?.student_name || "নির্বাচিত শিক্ষার্থী"}</b>
                    </span>
                    <button
                      type="button"
                      onClick={() => setStudentFilter("")}
                      className="rounded px-1.5 py-0.5 font-medium hover:bg-blue-100 dark:hover:bg-blue-900/60"
                    >
                      সবাই দেখুন
                    </button>
                  </div>
                )}
                <div className="w-fit rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:text-[13px]">
                  মোট <span className="font-bold text-slate-900 dark:text-slate-100">{totalRecords}</span> টি
                  রেকর্ড
                </div>
              </div>
            </div>

            <ReportFilterBar
              showSearch={showSearch}
              serverPdfExport={serverPdfExport}
              search={search}
              selectedDivision={selectedDivision}
              selectedClass={selectedClass}
              selectedExam={selectedExam}
              selectedSubject={selectedSubject}
              subjectOptions={subjectOptions}
              divisions={divisions}
              classes={classes}
              exams={examsForDivision(exams, selectedDivision)}
              activeReport={activeReport}
              divisionRequired={divisionRequired}
              exportColumns={exportColumns}
              exportRows={exportRows}
              onSearchChange={setSearch}
              onDivisionChange={(value) => {
                setSelectedDivision(value);
                loadClassesByDivision(value);
                // বিভাগভিত্তিক পরীক্ষা: keep the picked exam only if it's held
                // for the new division, else move to that division's first one.
                const current = exams.find((e) => String(e.id) === selectedExam);
                if (current && !examCoversDivision(current, value)) {
                  const fallback = examsForDivision(exams, value)[0];
                  setSelectedExam(fallback ? String(fallback.id) : "");
                }
                setSelectedSubject("");
                setPage(1);
              }}
              onClassChange={(value) => {
                setSelectedClass(value);
                setSelectedSubject("");
                setPage(1);
              }}
              onExamChange={(value) => {
                setSelectedExam(value);
                setSelectedSubject("");
                setPage(1);
              }}
              onSubjectChange={setSelectedSubject}
              onClear={clearFilters}
              paperSize={paperSize}
              orientation={orientation}
              onPaperSizeChange={setPaperSize}
              onOrientationChange={setOrientation}
              margins={margins}
              onMarginsChange={setMargins}
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={handleTemplateChange}
              cardsPerPage={cardsPerPage}
              onCardsPerPageChange={setCardsPerPage}
              idCardBackId={idCardBackId}
              onIdCardBackChange={handleIdCardBackChange}
              idCardPairBackId={idCardPairBackId}
              idCardBackWithFront={idCardBackWithFront}
              onIdCardBackWithFrontChange={setIdCardBackWithFront}
              onIdCardPairChange={(both) => {
                pairChosenByUser.current = true;
                setIdCardPairBackId(both ? tenantBackDefault : null);
              }}
              marksheetPanelOpen={marksheetPanelOpen}
              onMarksheetPanelToggle={() => setMarksheetPanelOpen((prev) => !prev)}
              admitCardPanelOpen={admitCardPanelOpen}
              onAdmitCardPanelToggle={() => setAdmitCardPanelOpen((prev) => !prev)}
              setupExtras={
                <>
                {supportsRepeatHeader && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={repeatHeaderPref}
                      onClick={toggleRepeatHeader}
                      title="চালু থাকলে বিষয়ের নামসহ হেডার প্রতিটি পেজের উপরে ছাপা হবে"
                      className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <span
                        aria-hidden="true"
                        className={`relative inline-block h-4 w-7 rounded-full transition-colors ${
                          repeatHeaderPref ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                            repeatHeaderPref ? "left-3.5" : "left-0.5"
                          }`}
                        />
                      </span>
                      প্রতি পেজে বিষয়ের নাম
                    </button>
                  )}
                  {columnOptions && (
                    <ColumnVisibilityMenu
                      columns={columnMenuOptions}
                      visible={columnPrefs.visible}
                      onToggle={toggleReportColumn}
                      onReset={columnPrefs.reset}
                      order={columnPrefs.order}
                      onMove={columnPrefs.move}
                      resetLabel="ডিফল্ট কলাম ফিরিয়ে আনুন"
                      buttonClassName="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    />
                  )}
                </>
              }
              summary={
                isPaginatedAcademicResult && totalCount > 0 && (
                  <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <FilterSelect
                      value={pageSize}
                      onChange={(value) => {
                        setPageSize(Number(value));
                        setPage(1);
                      }}
                      selectClassName="h-7 appearance-none rounded border border-slate-200 bg-white px-1.5 pr-5 text-xs outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      iconClassName="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 transition-transform duration-200 dark:text-slate-500"
                    >
                      {[50, 100, 200, 500].map((size) => (
                        <option key={size} value={size}>
                          {size} জন/পেজ
                        </option>
                      ))}
                    </FilterSelect>

                    <span className="whitespace-nowrap text-xs">
                      {pageStart}–{pageEnd}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!hasPrevPage}
                      className="h-7 rounded border border-slate-200 px-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
                    >
                      আগের
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!hasNextPage}
                      className="h-7 rounded border border-slate-200 px-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
                    >
                      পরের
                    </button>
                  </div>
                )
              }
            />

            {warning && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
                <span>{warning}</span>
                {/* এই ওয়ার্নিং শুধু প্রবেশপত্রে আসে যখন এই পরীক্ষায় কেউ এখনো পরীক্ষার্থী
                    হিসেবে নিবন্ধিত না (দেখুন reports.repository.ts-এর
                    admitCardRosterFallback) - নিবন্ধন সম্পূর্ণ অটোমেটিক, ফ্রি পরীক্ষায়
                    পরীক্ষার রুটিন তৈরি করলেই ক্লাসের সবাই নিবন্ধিত হয়ে যায় (দেখুন
                    exam-candidate.service.ts-এর autoRegisterForRoutine), তাই সরাসরি
                    রুটিন পেজের শর্টকাট। */}
                {effectiveReport.printable === "admit-card" && (
                  <Link
                    to="/routine"
                    className="shrink-0 whitespace-nowrap rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
                  >
                    পরীক্ষার রুটিন যোগ করুন →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Wrapper only becomes a flex row while the marksheet/admit-card settings panel is
              open, so the preview keeps the same place in the tree (no remount) and prints
              exactly as before. */}
          <div
            className={
              showMarksheetPanel || showAdmitCardPanel
                ? "flex flex-col bg-[#eef2f7] lg:flex-row lg:items-start"
                : undefined
            }
          >
            <div className="min-w-0 flex-1">
              <div className="print-preview-wrap">
                <PaginatedReportPreview
                  loading={loading}
                  report={effectiveReport}
                  rows={displayRows}
                  selectedDivisionName={selectedDivisionName}
                  selectedDivisionId={selectedDivisionId}
                  selectedClassName={selectedClassName}
                  repeatTableHeader={repeatTableHeader}
                  hideBrandHeader={hideBrandHeader}
                  paperSize={paperSize}
                  orientation={orientation}
                  margins={margins}
                  emptyMessage={previewEmptyMessage}
                />
              </div>
            </div>
            {showMarksheetPanel && <MarksheetSettingsPanel onClose={() => setMarksheetPanelOpen(false)} />}
            {showAdmitCardPanel && <AdmitCardSettingsPanel onClose={() => setAdmitCardPanelOpen(false)} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReportShell;
