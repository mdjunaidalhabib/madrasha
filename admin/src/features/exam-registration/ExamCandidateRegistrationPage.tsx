import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Settings, XCircle } from "lucide-react";
import { cachedGet } from "../../services/api";
import {
  examCandidateApi,
  EXAM_CANDIDATE_STATUS_VALUES,
  EXAM_CANDIDATE_STATUS_LABELS_BN,
  ELIGIBILITY_STATUS_LABELS_BN,
  EXAM_STATUS_LABELS_BN,
  type ExamCandidateRow,
  type ExamCandidateStatus,
  type EligibilityStatus,
  type EligibleStudentPreview,
  type EligibilitySettings,
  type ExamStatus,
} from "../../services/examCandidateApi";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { SkeletonList, SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string };
type ExamOption = { id: number; name: string; year: string | number; status?: ExamStatus | null };
type TabKey = "registered" | "register";

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const parseReasons = (json: string | null | undefined): string[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const eligibleFromStatus = (status: EligibilityStatus): boolean | null =>
  status === "ELIGIBLE" ? true : status === "INELIGIBLE" ? false : null;

const selectClass =
  "h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 sm:w-[170px]";

/** যোগ্যতা ব্যাজ - hover করলে title-এ কারণ দেখায়, ক্লিক করলে পুরো তালিকা
 * (একাধিক কারণ থাকলে) একটা ছোট popover-এ খুলে দেখায়। রেজিস্টার্ড ট্যাব
 * (persisted eligibilityStatus থেকে) এবং রেজিস্ট্রেশন ট্যাব (live preview
 * eligible boolean) - দুই জায়গাতেই ব্যবহৃত হয়।*/
function EligibilityBadge({ eligible, reasons }: { eligible: boolean | null; reasons: string[] }) {
  const [open, setOpen] = useState(false);
  const label = eligible === true ? "যোগ্য" : eligible === false ? "অযোগ্য" : "পেন্ডিং";
  const colorCls =
    eligible === true
      ? "border-green-300 bg-green-100 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-400"
      : eligible === false
        ? "border-red-300 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
        : "border-gray-300 bg-gray-100 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400";

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => reasons.length > 0 && setOpen((o) => !o)}
        title={reasons.join("; ") || undefined}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${colorCls} ${
          reasons.length ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {label}
        {reasons.length > 0 && <span className="text-[10px] opacity-70">({toBanglaDigits(reasons.length)})</span>}
      </button>

      {open && reasons.length > 0 && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-2 text-left text-xs text-gray-700 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <ul className="list-disc space-y-1 pl-4">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CandidateStatusBadge({ status }: { status: ExamCandidateStatus }) {
  const cls =
    status === "CANCELLED"
      ? "border-red-300 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
      : status === "COMPLETED" || status === "ELIGIBLE"
        ? "border-green-300 bg-green-100 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-400"
        : status === "WITHHELD" || status === "INELIGIBLE"
          ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400"
          : "border-gray-300 bg-gray-100 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400";

  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {EXAM_CANDIDATE_STATUS_LABELS_BN[status]}
    </span>
  );
}

const ExamCandidateRegistrationPage = () => {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canRead = hasPermission(user, permissions, "exam_candidate.read");
  const canManageCandidate = hasPermission(user, permissions, "exam_candidate.manage");
  const canManageEligibility = hasPermission(user, permissions, "exam_eligibility.manage");

  const [exams, setExams] = useState<ExamOption[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState("");

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classLoading, setClassLoading] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExamCandidateStatus | "">("");
  const [eligFilter, setEligFilter] = useState<EligibilityStatus | "">("");

  const [activeTab, setActiveTab] = useState<TabKey>("registered");

  // ============ নিবন্ধিত প্রার্থী ============
  const [rows, setRows] = useState<ExamCandidateRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<ExamCandidateStatus>("ELIGIBLE");
  const [rowStatusBusyId, setRowStatusBusyId] = useState<number | null>(null);
  const [rowEligBusyId, setRowEligBusyId] = useState<number | null>(null);

  // ============ শিক্ষার্থী নিবন্ধন করুন ============
  const [eligibleRows, setEligibleRows] = useState<EligibleStudentPreview[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [skippedResult, setSkippedResult] = useState<{
    registered: number;
    skipped: Array<{ student_id: number; reason: string }>;
  } | null>(null);

  // ============ যোগ্যতা সেটিং ============
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<EligibilitySettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // অনুসন্ধান বক্সে প্রতিটা কি-স্ট্রোকে না ডেকে ৩০০ms পর একবার API কল হয়।
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        setExamsLoading(true);
        const res = await cachedGet("/exams");
        setExams(normalizeArray(res));
      } catch (err) {
        logger.error("LOAD EXAMS ERROR:", err);
        setExams([]);
      } finally {
        setExamsLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await cachedGet("/madrasa-divisions");
        setDivisions(normalizeArray(res));
      } catch (err) {
        logger.error("LOAD DIVISIONS ERROR:", err);
        setDivisions([]);
      }
    })();
  }, []);

  useEffect(() => {
    setSelectedClass("");
    if (!selectedDivision) {
      setClasses([]);
      return;
    }
    (async () => {
      try {
        setClassLoading(true);
        const res = await cachedGet(`/madrasa-classes?division_id=${selectedDivision}`);
        setClasses(normalizeArray(res));
      } catch (err) {
        logger.error("LOAD CLASSES ERROR:", err);
        setClasses([]);
      } finally {
        setClassLoading(false);
      }
    })();
  }, [selectedDivision]);

  // ফিল্টার বদলালে সবসময় প্রথম পাতায় ফিরে যায়, নাহলে পুরনো পাতায় খালি ফল দেখাতে পারে।
  useEffect(() => {
    setPage(1);
  }, [selectedExamId, selectedClass, selectedDivision, statusFilter, eligFilter, debouncedSearch, pageSize]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedStudentIds(new Set());
  }, [selectedExamId]);

  const loadCandidates = useCallback(async () => {
    if (!selectedExamId) {
      setRows([]);
      return;
    }
    try {
      setRowsLoading(true);
      const res = await examCandidateApi.list({
        exam_id: Number(selectedExamId),
        class_id: selectedClass ? Number(selectedClass) : undefined,
        division_id: selectedDivision ? Number(selectedDivision) : undefined,
        status: statusFilter || undefined,
        eligibility_status: eligFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        limit: pageSize,
      });
      const data = res.data?.data || [];
      setRows(data);
      setTotal(res.data?.pagination?.total ?? data.length);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
    } catch (err) {
      logger.error("LOAD EXAM CANDIDATES ERROR:", err);
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, [selectedExamId, selectedClass, selectedDivision, statusFilter, eligFilter, debouncedSearch, page, pageSize]);

  const loadEligibleStudents = useCallback(async () => {
    if (!selectedExamId) {
      setEligibleRows([]);
      return;
    }
    try {
      setEligibleLoading(true);
      const res = await examCandidateApi.eligibleStudents({
        exam_id: Number(selectedExamId),
        class_id: selectedClass ? Number(selectedClass) : undefined,
        division_id: selectedDivision ? Number(selectedDivision) : undefined,
        search: debouncedSearch || undefined,
      });
      setEligibleRows(res.data?.data || []);
      setSelectedStudentIds(new Set());
    } catch (err) {
      logger.error("LOAD ELIGIBLE STUDENTS ERROR:", err);
      setEligibleRows([]);
    } finally {
      setEligibleLoading(false);
    }
  }, [selectedExamId, selectedClass, selectedDivision, debouncedSearch]);

  useEffect(() => {
    if (activeTab === "registered" && canRead) loadCandidates();
  }, [activeTab, canRead, loadCandidates]);

  useEffect(() => {
    if (activeTab === "register" && canRead) loadEligibleStudents();
  }, [activeTab, canRead, loadEligibleStudents]);

  /* ================= রেজিস্টার্ড প্রার্থী - রো/বাল্ক অ্যাকশন ================= */

  const allPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(String(r.id)));

  const toggleSelectAllPage = () => {
    setSelectedIds(allPageSelected ? new Set() : new Set(rows.map((r) => String(r.id))));
  };

  const toggleSelectOne = (id: number) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const changeRowStatus = async (row: ExamCandidateRow, status: ExamCandidateStatus) => {
    if (status === row.status) return;
    const prevStatus = row.status;
    setRowStatusBusyId(row.id);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try {
      await examCandidateApi.setStatus(row.id, { status });
      useToastStore.getState().show("অবস্থা আপডেট হয়েছে", "success");
    } catch (err: any) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: prevStatus } : r)));
      useToastStore.getState().show(err?.response?.data?.message || "অবস্থা পরিবর্তন করা যায়নি", "error");
    } finally {
      setRowStatusBusyId(null);
    }
  };

  const recheckRowEligibility = async (row: ExamCandidateRow) => {
    setRowEligBusyId(row.id);
    try {
      const res = await examCandidateApi.eligibilityCheck({ candidate_id: row.id });
      const { eligible, reasons } = res.data.data;
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                eligibilityStatus: eligible ? "ELIGIBLE" : "INELIGIBLE",
                eligibilityReasons: JSON.stringify(reasons || []),
                eligibilityCheckedAt: new Date().toISOString(),
              }
            : r,
        ),
      );
      useToastStore.getState().show("যোগ্যতা যাচাই সম্পন্ন হয়েছে", "success");
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || "যোগ্যতা যাচাই করা যায়নি", "error");
    } finally {
      setRowEligBusyId(null);
    }
  };

  const cancelRow = (row: ExamCandidateRow) => {
    useConfirmStore.getState().show({
      title: "প্রার্থীতা বাতিল করবেন?",
      message: `"${row.student.nameBn}" এর পরীক্ষার প্রার্থীতা বাতিল (CANCELLED) করতে চান?`,
      confirmText: "বাতিল করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await examCandidateApi.cancel(row.id);
          useToastStore.getState().show("প্রার্থীতা বাতিল করা হয়েছে", "success");
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "CANCELLED" } : r)));
        } catch (err: any) {
          useToastStore.getState().show(err?.response?.data?.message || "বাতিল করা যায়নি", "error");
        }
      },
    });
  };

  const handleBulkStatus = () => {
    const ids = Array.from(selectedIds).map(Number);
    if (ids.length === 0) return;

    useConfirmStore.getState().show({
      title: "নির্বাচিতদের অবস্থা পরিবর্তন করবেন?",
      message: `${toBanglaDigits(ids.length)} জন প্রার্থীর অবস্থা "${EXAM_CANDIDATE_STATUS_LABELS_BN[bulkStatusValue]}" এ পরিবর্তন করতে চান?`,
      confirmText: "নিশ্চিত করুন",
      onConfirm: async () => {
        try {
          setBulkBusy(true);
          await examCandidateApi.bulkSetStatus({ ids, status: bulkStatusValue });
          useToastStore.getState().show("অবস্থা আপডেট হয়েছে", "success");
          setSelectedIds(new Set());
          loadCandidates();
        } catch (err: any) {
          useToastStore.getState().show(err?.response?.data?.message || "আপডেট করা যায়নি", "error");
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  const handleBulkEligibilityRecheck = () => {
    const ids = Array.from(selectedIds).map(Number);
    if (ids.length === 0 || !selectedExamId) return;

    useConfirmStore.getState().show({
      title: "নির্বাচিতদের যোগ্যতা পুনঃযাচাই করবেন?",
      message: `${toBanglaDigits(ids.length)} জন প্রার্থীর যোগ্যতা আবার যাচাই করতে চান?`,
      confirmText: "যাচাই করুন",
      onConfirm: async () => {
        try {
          setBulkBusy(true);
          const res = await examCandidateApi.bulkEligibilityCheck({
            exam_id: Number(selectedExamId),
            candidate_ids: ids,
          });
          const { checked, eligible, ineligible } = res.data.data;
          useToastStore
            .getState()
            .show(
              `${toBanglaDigits(checked)} জন যাচাই হয়েছে — যোগ্য: ${toBanglaDigits(eligible)}, অযোগ্য: ${toBanglaDigits(
                ineligible,
              )}`,
              "success",
            );
          setSelectedIds(new Set());
          loadCandidates();
        } catch (err: any) {
          useToastStore.getState().show(err?.response?.data?.message || "যাচাই করা যায়নি", "error");
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  const handleBulkCancel = () => {
    const ids = Array.from(selectedIds).map(Number);
    if (ids.length === 0) return;

    useConfirmStore.getState().show({
      title: "নির্বাচিত প্রার্থীতা বাতিল করবেন?",
      message: `${toBanglaDigits(ids.length)} জন প্রার্থীর নিবন্ধন বাতিল (CANCELLED) করতে চান?`,
      confirmText: "বাতিল করুন",
      danger: true,
      onConfirm: async () => {
        try {
          setBulkBusy(true);
          await examCandidateApi.bulkSetStatus({ ids, status: "CANCELLED" });
          useToastStore.getState().show("বাতিল করা হয়েছে", "success");
          setSelectedIds(new Set());
          loadCandidates();
        } catch (err: any) {
          useToastStore.getState().show(err?.response?.data?.message || "বাতিল করা যায়নি", "error");
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  /* ================= শিক্ষার্থী নিবন্ধন করুন ================= */

  const allEligibleSelected =
    eligibleRows.length > 0 && eligibleRows.every((s) => selectedStudentIds.has(String(s.student_id)));

  const toggleSelectAllEligible = () => {
    setSelectedStudentIds(
      allEligibleSelected ? new Set() : new Set(eligibleRows.map((s) => String(s.student_id))),
    );
  };

  const toggleSelectStudent = (id: number) => {
    const key = String(id);
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showRegisterResult = (data: { registered: number; skipped: Array<{ student_id: number; reason: string }> }) => {
    setSkippedResult(data);
    useToastStore
      .getState()
      .show(
        `${toBanglaDigits(data.registered)} জন নিবন্ধিত হয়েছে${
          data.skipped.length ? `, ${toBanglaDigits(data.skipped.length)} জন বাদ পড়েছে` : ""
        }`,
        data.skipped.length ? "info" : "success",
      );
  };

  const handleRegisterSelected = async () => {
    const ids = Array.from(selectedStudentIds).map(Number);
    if (ids.length === 0 || !selectedExamId) return;

    try {
      setRegistering(true);
      const res = await examCandidateApi.bulkRegister({ exam_id: Number(selectedExamId), student_ids: ids });
      showRegisterResult(res.data.data);
      loadEligibleStudents();
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || "নিবন্ধন করা যায়নি", "error");
    } finally {
      setRegistering(false);
    }
  };

  const handleRegisterAllFiltered = () => {
    if (!selectedExamId) return;

    useConfirmStore.getState().show({
      title: "সবাইকে নিবন্ধন করবেন?",
      message:
        "বর্তমান ফিল্টার (শ্রেণি/বিভাগ) অনুযায়ী এখনও নিবন্ধিত হয়নি এমন সকল শিক্ষার্থীকে এই পরীক্ষায় নিবন্ধন করা হবে। নিশ্চিত?",
      confirmText: "সবাইকে নিবন্ধন করুন",
      onConfirm: async () => {
        try {
          setRegistering(true);
          const res = await examCandidateApi.bulkRegister({
            exam_id: Number(selectedExamId),
            class_id: selectedClass ? Number(selectedClass) : undefined,
            division_id: selectedDivision ? Number(selectedDivision) : undefined,
          });
          showRegisterResult(res.data.data);
          loadEligibleStudents();
        } catch (err: any) {
          useToastStore.getState().show(err?.response?.data?.message || "নিবন্ধন করা যায়নি", "error");
        } finally {
          setRegistering(false);
        }
      },
    });
  };

  /* ================= যোগ্যতা সেটিং ================= */

  const openSettings = async () => {
    setSettingsOpen(true);
    if (settings) return;
    try {
      setSettingsLoading(true);
      const res = await examCandidateApi.getEligibilitySettings();
      setSettings(res.data.data);
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || "সেটিং লোড করা যায়নি", "error");
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      setSettingsSaving(true);
      const res = await examCandidateApi.updateEligibilitySettings({
        require_active_student: settings.requireActiveStudent,
        require_approved_admission: settings.requireApprovedAdmission,
        check_dues: settings.checkDues,
        check_attendance: settings.checkAttendance,
        min_attendance_percent: settings.minAttendancePercent,
      });
      setSettings(res.data.data);
      useToastStore.getState().show("সেটিং সংরক্ষণ হয়েছে", "success");
      setSettingsOpen(false);
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || "সেটিং সংরক্ষণ করা যায়নি", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  /* ================= নাম-লুকআপ + এক্সপোর্ট ================= */

  const classNameById = useMemo(() => {
    const map = new Map(classes.map((c) => [c.class_id, c.class_name_bn]));
    return (id: number) => map.get(id) || String(id);
  }, [classes]);

  const divisionNameById = useMemo(() => {
    const map = new Map(divisions.map((d) => [d.division_id, d.division_name_bn]));
    return (id: number) => map.get(id) || String(id);
  }, [divisions]);

  const exportRows = useMemo(
    () =>
      rows.map((r) => ({
        roll: r.student.roll ?? "",
        name: r.student.nameBn,
        class: r.class.nameBn,
        division: r.division.nameBn,
        regNo: r.registrationNo || "",
        candidateNo: r.candidateNo || "",
        status: EXAM_CANDIDATE_STATUS_LABELS_BN[r.status],
        eligibility: ELIGIBILITY_STATUS_LABELS_BN[r.eligibilityStatus],
      })),
    [rows],
  );

  const exportColumns = [
    { header: "রোল", key: "roll" },
    { header: "নাম", key: "name" },
    { header: "শ্রেণি", key: "class" },
    { header: "বিভাগ", key: "division" },
    { header: "রেজিস্ট্রেশন নং", key: "regNo" },
    { header: "পরীক্ষার্থী নং", key: "candidateNo" },
    { header: "স্ট্যাটাস", key: "status" },
    { header: "যোগ্যতা", key: "eligibility" },
  ];

  const selectedExam = exams.find((e) => String(e.id) === selectedExamId);

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
              পরীক্ষার্থী নিবন্ধন ও যোগ্যতা
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              পরীক্ষার জন্য শিক্ষার্থী নিবন্ধন করুন এবং যোগ্যতা যাচাই করুন
            </p>
          </div>

          {canManageEligibility && (
            <button
              type="button"
              onClick={openSettings}
              className="flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Settings size={15} />
              যোগ্যতা সেটিং
            </button>
          )}
        </div>

        {/* Exam selector */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">১. পরীক্ষা নির্বাচন করুন</h2>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            disabled={examsLoading}
            className={selectClass + " sm:w-[280px]"}
          >
            <option value="">{examsLoading ? "লোড হচ্ছে..." : "পরীক্ষা নির্বাচন করুন"}</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} — {exam.year}
                {exam.status ? ` (${EXAM_STATUS_LABELS_BN[exam.status]})` : ""}
              </option>
            ))}
          </select>
        </div>

        {!canRead ? (
          <EmptyState title="অনুমতি নেই" hint="এই পাতা দেখার অনুমতি আপনার নেই" />
        ) : !selectedExamId ? (
          <EmptyState
            title="একটি পরীক্ষা নির্বাচন করুন"
            hint="উপর থেকে পরীক্ষা নির্বাচন করলে প্রার্থী তালিকা ও নিবন্ধন অপশন দেখা যাবে"
          />
        ) : (
          <>
            {/* Filter bar */}
            <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <select
                  value={selectedDivision}
                  onChange={(e) => setSelectedDivision(e.target.value)}
                  className={selectClass}
                >
                  <option value="">সব বিভাগ</option>
                  {divisions.map((d) => (
                    <option key={d.division_id} value={d.division_id}>
                      {d.division_name_bn}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  disabled={!selectedDivision || classLoading}
                  className={selectClass}
                >
                  <option value="">{classLoading ? "লোড হচ্ছে..." : "সব শ্রেণি"}</option>
                  {classes.map((c) => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.class_name_bn}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="নাম/রোল দিয়ে খুঁজুন..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[200px]"
                />

                {activeTab === "registered" && (
                  <>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as ExamCandidateStatus | "")}
                      className={selectClass}
                    >
                      <option value="">সব স্ট্যাটাস</option>
                      {EXAM_CANDIDATE_STATUS_VALUES.map((s) => (
                        <option key={s} value={s}>
                          {EXAM_CANDIDATE_STATUS_LABELS_BN[s]}
                        </option>
                      ))}
                    </select>

                    <select
                      value={eligFilter}
                      onChange={(e) => setEligFilter(e.target.value as EligibilityStatus | "")}
                      className={selectClass}
                    >
                      <option value="">সব যোগ্যতা</option>
                      <option value="PENDING">পেন্ডিং</option>
                      <option value="ELIGIBLE">যোগ্য</option>
                      <option value="INELIGIBLE">অযোগ্য</option>
                    </select>
                  </>
                )}
              </div>

              {/* Tabs */}
              <div className="mt-3 flex gap-1 border-b border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab("registered")}
                  className={`px-3 py-2 text-sm font-medium transition ${
                    activeTab === "registered"
                      ? "border-b-2 border-blue-600 text-blue-700 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  নিবন্ধিত প্রার্থী {rows.length > 0 && `(${toBanglaDigits(total)})`}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className={`px-3 py-2 text-sm font-medium transition ${
                    activeTab === "register"
                      ? "border-b-2 border-blue-600 text-blue-700 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  শিক্ষার্থী নিবন্ধন করুন
                </button>
              </div>
            </div>

            {/* ============ TAB: নিবন্ধিত প্রার্থী ============ */}
            {activeTab === "registered" && (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {selectedExam ? `${selectedExam.name} — ${selectedExam.year}` : ""}
                  </p>
                  <DataExportPrintActions
                    title="নিবন্ধিত প্রার্থী তালিকা"
                    fileName="exam-candidates"
                    columns={exportColumns}
                    data={exportRows}
                  />
                </div>

                {selectedIds.size > 0 && (canManageCandidate || canManageEligibility) && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                      {toBanglaDigits(selectedIds.size)} জন নির্বাচিত
                    </p>

                    {canManageCandidate && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={bulkStatusValue}
                          onChange={(e) => setBulkStatusValue(e.target.value as ExamCandidateStatus)}
                          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          {EXAM_CANDIDATE_STATUS_VALUES.map((s) => (
                            <option key={s} value={s}>
                              {EXAM_CANDIDATE_STATUS_LABELS_BN[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleBulkStatus}
                          disabled={bulkBusy}
                          className="h-8 rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                        >
                          স্ট্যাটাস আপডেট
                        </button>
                      </div>
                    )}

                    {canManageEligibility && (
                      <button
                        type="button"
                        onClick={handleBulkEligibilityRecheck}
                        disabled={bulkBusy}
                        className="h-8 rounded-md border border-blue-300 bg-white px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-60 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-400"
                      >
                        যোগ্যতা পুনঃযাচাই
                      </button>
                    )}

                    {canManageCandidate && (
                      <button
                        type="button"
                        onClick={handleBulkCancel}
                        disabled={bulkBusy}
                        className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {bulkBusy ? "প্রসেস হচ্ছে..." : "বাতিল করুন"}
                      </button>
                    )}
                  </div>
                )}

                {rowsLoading ? (
                  <SkeletonTable rows={8} columns={9} />
                ) : rows.length === 0 ? (
                  <EmptyState title="কোনো প্রার্থী পাওয়া যায়নি" hint="ফিল্টার পরিবর্তন করুন অথবা নতুন নিবন্ধন করুন" />
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <table className="w-full min-w-[980px] border-collapse text-center text-sm">
                        <thead className="bg-blue-800 text-xs text-white">
                          <tr>
                            <th className="border p-2 dark:border-slate-700">
                              <input
                                type="checkbox"
                                checked={allPageSelected}
                                onChange={toggleSelectAllPage}
                                className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                              />
                            </th>
                            <th className="border p-2 dark:border-slate-700">রোল</th>
                            <th className="border p-2 dark:border-slate-700">নাম</th>
                            <th className="border p-2 dark:border-slate-700">শ্রেণি</th>
                            <th className="border p-2 dark:border-slate-700">বিভাগ</th>
                            <th className="border p-2 dark:border-slate-700">রেজি. নং</th>
                            <th className="border p-2 dark:border-slate-700">পরীক্ষার্থী নং</th>
                            <th className="border p-2 dark:border-slate-700">স্ট্যাটাস</th>
                            <th className="border p-2 dark:border-slate-700">যোগ্যতা</th>
                            <th className="border p-2 dark:border-slate-700">অ্যাকশন</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.id} className="border-t transition hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800">
                              <td className="border p-2 dark:border-slate-700">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(String(row.id))}
                                  onChange={() => toggleSelectOne(row.id)}
                                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                                />
                              </td>
                              <td className="border p-2 dark:border-slate-700">{row.student.roll ?? "-"}</td>
                              <td className="border p-2 text-left dark:border-slate-700">{row.student.nameBn}</td>
                              <td className="border p-2 dark:border-slate-700">{row.class.nameBn}</td>
                              <td className="border p-2 dark:border-slate-700">{row.division.nameBn}</td>
                              <td className="border p-2 dark:border-slate-700">{row.registrationNo || "-"}</td>
                              <td className="border p-2 dark:border-slate-700">{row.candidateNo || "-"}</td>
                              <td className="border p-2 dark:border-slate-700">
                                {canManageCandidate ? (
                                  <select
                                    value={row.status}
                                    disabled={rowStatusBusyId === row.id}
                                    onChange={(e) => changeRowStatus(row, e.target.value as ExamCandidateStatus)}
                                    className="h-7 rounded-md border border-gray-300 bg-white px-1 text-xs outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                  >
                                    {EXAM_CANDIDATE_STATUS_VALUES.map((s) => (
                                      <option key={s} value={s}>
                                        {EXAM_CANDIDATE_STATUS_LABELS_BN[s]}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <CandidateStatusBadge status={row.status} />
                                )}
                              </td>
                              <td className="border p-2 dark:border-slate-700">
                                <EligibilityBadge
                                  eligible={eligibleFromStatus(row.eligibilityStatus)}
                                  reasons={parseReasons(row.eligibilityReasons)}
                                />
                              </td>
                              <td className="border p-2 dark:border-slate-700">
                                <div className="flex justify-center gap-1.5">
                                  {canManageEligibility && (
                                    <button
                                      type="button"
                                      onClick={() => recheckRowEligibility(row)}
                                      disabled={rowEligBusyId === row.id}
                                      title="যোগ্যতা পুনঃযাচাই"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 transition hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/30 dark:text-blue-400"
                                    >
                                      <RefreshCw size={13} className={rowEligBusyId === row.id ? "animate-spin" : ""} />
                                    </button>
                                  )}
                                  {canManageCandidate && row.status !== "CANCELLED" && (
                                    <button
                                      type="button"
                                      onClick={() => cancelRow(row)}
                                      title="বাতিল করুন"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400"
                                    >
                                      <XCircle size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:flex-row">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 sm:text-sm">
                        <span>
                          মোট {toBanglaDigits(total)} জন, পাতা {toBanglaDigits(page)}/{toBanglaDigits(totalPages)}
                        </span>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                          className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
                        >
                          <option value={20}>২০</option>
                          <option value={50}>৫০</option>
                          <option value={100}>১০০</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          পূর্ববর্তী
                        </button>
                        <button
                          type="button"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          পরবর্তী
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ============ TAB: শিক্ষার্থী নিবন্ধন করুন ============ */}
            {activeTab === "register" && (
              <>
                {canManageCandidate && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-950/20">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      {selectedStudentIds.size > 0
                        ? `${toBanglaDigits(selectedStudentIds.size)} জন নির্বাচিত`
                        : "এখনো কেউ নির্বাচিত হয়নি"}
                    </p>
                    <Button onClick={handleRegisterSelected} disabled={registering || selectedStudentIds.size === 0}>
                      {registering ? "নিবন্ধন হচ্ছে..." : "নিবন্ধন করুন"}
                    </Button>
                    <Button variant="secondary" onClick={handleRegisterAllFiltered} disabled={registering}>
                      সব নিবন্ধন করুন (ফিল্টার অনুযায়ী)
                    </Button>
                  </div>
                )}

                {eligibleLoading ? (
                  <SkeletonList items={6} />
                ) : eligibleRows.length === 0 ? (
                  <EmptyState
                    title="নিবন্ধনযোগ্য কোনো শিক্ষার্থী নেই"
                    hint="সবাই ইতিমধ্যে নিবন্ধিত অথবা এই ফিল্টারে কোনো সক্রিয় শিক্ষার্থী নেই"
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <table className="w-full min-w-[760px] border-collapse text-center text-sm">
                      <thead className="bg-blue-800 text-xs text-white">
                        <tr>
                          <th className="border p-2 dark:border-slate-700">
                            <input
                              type="checkbox"
                              checked={allEligibleSelected}
                              onChange={toggleSelectAllEligible}
                              className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                            />
                          </th>
                          <th className="border p-2 dark:border-slate-700">রোল</th>
                          <th className="border p-2 dark:border-slate-700">নাম</th>
                          <th className="border p-2 dark:border-slate-700">শ্রেণি</th>
                          <th className="border p-2 dark:border-slate-700">বিভাগ</th>
                          <th className="border p-2 dark:border-slate-700">যোগ্যতা (প্রিভিউ)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eligibleRows.map((s) => (
                          <tr
                            key={s.student_id}
                            className="border-t transition hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            <td className="border p-2 dark:border-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedStudentIds.has(String(s.student_id))}
                                onChange={() => toggleSelectStudent(s.student_id)}
                                className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                              />
                            </td>
                            <td className="border p-2 dark:border-slate-700">{s.roll ?? "-"}</td>
                            <td className="border p-2 text-left dark:border-slate-700">{s.name_bn}</td>
                            <td className="border p-2 dark:border-slate-700">{classNameById(s.class_id)}</td>
                            <td className="border p-2 dark:border-slate-700">{divisionNameById(s.division_id)}</td>
                            <td className="border p-2 dark:border-slate-700">
                              <EligibilityBadge eligible={s.eligible} reasons={s.reasons || []} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* নিবন্ধনের ফলাফল (registered/skipped) */}
      <Modal open={!!skippedResult} title="নিবন্ধনের ফলাফল" onClose={() => setSkippedResult(null)}>
        {skippedResult && (
          <div className="space-y-3 text-sm text-gray-700 dark:text-slate-300">
            <p>
              <strong className="text-green-700 dark:text-green-400">{toBanglaDigits(skippedResult.registered)}</strong>{" "}
              জন সফলভাবে নিবন্ধিত হয়েছে।
            </p>
            {skippedResult.skipped.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-amber-700 dark:text-amber-400">
                  {toBanglaDigits(skippedResult.skipped.length)} জন বাদ পড়েছে:
                </p>
                <ul className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 text-xs dark:border-slate-700">
                  {skippedResult.skipped.map((s, i) => (
                    <li key={i}>
                      শিক্ষার্থী #{toBanglaDigits(s.student_id)} — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setSkippedResult(null)}>ঠিক আছে</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* যোগ্যতা সেটিং */}
      <Modal open={settingsOpen} title="যোগ্যতা নির্ধারণের সেটিং" onClose={() => setSettingsOpen(false)}>
        {settingsLoading || !settings ? (
          <SkeletonList items={5} />
        ) : (
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-slate-300">সক্রিয় শিক্ষার্থী হওয়া আবশ্যক</span>
              <ToggleSwitch
                checked={settings.requireActiveStudent}
                onChange={(v) => setSettings({ ...settings, requireActiveStudent: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-slate-300">অনুমোদিত ভর্তি হওয়া আবশ্যক</span>
              <ToggleSwitch
                checked={settings.requireApprovedAdmission}
                onChange={(v) => setSettings({ ...settings, requireApprovedAdmission: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-slate-300">বকেয়া ফি যাচাই করুন</span>
              <ToggleSwitch
                checked={settings.checkDues}
                onChange={(v) => setSettings({ ...settings, checkDues: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-slate-300">উপস্থিতির হার যাচাই করুন</span>
              <ToggleSwitch
                checked={settings.checkAttendance}
                onChange={(v) => setSettings({ ...settings, checkAttendance: v })}
              />
            </label>
            {settings.checkAttendance && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 dark:text-slate-300">সর্বনিম্ন উপস্থিতির হার (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.minAttendancePercent}
                  onChange={(e) => setSettings({ ...settings, minAttendancePercent: Number(e.target.value) })}
                  className="h-9 w-24 rounded-lg border border-gray-300 px-2 text-right text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
                বাতিল
              </Button>
              <Button onClick={saveSettings} disabled={settingsSaving}>
                {settingsSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExamCandidateRegistrationPage;
