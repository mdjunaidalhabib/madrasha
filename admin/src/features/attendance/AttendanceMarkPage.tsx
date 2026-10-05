import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarOff, CheckCheck, Clock, History, Info, Lock, MessageSquare, Save, Search } from "lucide-react";
import { cachedGet } from "../../services/api";
import {
  attendanceApi,
  type AttendanceDayInfo,
  type AttendanceRow,
  type AttendanceStatus,
  type AttendeeType,
} from "../../services/phase1Api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { formatNumber, getText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { attendanceText } from "./attendance.text";
import { AttendanceHistoryModal, ReasonModal, StatusSegment } from "./AttendanceShared";
import {
  ATTENDANCE_STATUSES,
  STATUS_STYLE,
  apiErrorHas,
  apiErrorMessage,
  formatIsoDate,
  formatTime,
  isProtectedSource,
  localIsoDate,
  useAttendancePermissions,
} from "./attendanceUtils";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string };
type PersonRaw = {
  id: number | string;
  name_bn?: string;
  name?: string;
  roll?: number | string;
  class_id?: number | string;
  academic_year?: string;
  designation?: string;
};
type Person = { id: number; name: string; roll?: number | string; sub?: string };
type Draft = { status: AttendanceStatus | null; remarks: string };

const ATTENDEE_TYPES: AttendeeType[] = ["STUDENT", "TEACHER", "STAFF"];

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data.filter((item) => item && typeof item === "object") : [];
};

/** Local fallback when /day-info is unavailable: only the future check. */
const fallbackDayInfo = (date: string): AttendanceDayInfo => {
  const today = localIsoDate();
  return {
    date,
    today,
    off: false,
    reason: null,
    title: null,
    is_future: date > today,
    within_window: date >= today,
    can_edit_past: true,
    edit_window_days: 0,
  };
};

const selectCls =
  "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500";

const AttendanceMarkPage = () => {
  const lang = useLang();
  const tx = useText(attendanceText);
  const t = tx.mark;
  const num = (n: number) => formatNumber(n, lang);
  const { canMark, canEdit } = useAttendancePermissions();
  const [searchParams] = useSearchParams();

  const initialType = (searchParams.get("type") || "").toUpperCase() as AttendeeType;
  const [attendeeType, setAttendeeType] = useState<AttendeeType>(
    ATTENDEE_TYPES.includes(initialType) ? initialType : "STUDENT",
  );
  const [date, setDate] = useState(() => {
    const d = searchParams.get("date") || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= localIsoDate() ? d : localIsoDate();
  });
  const [dayInfo, setDayInfo] = useState<AttendanceDayInfo | null>(null);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allStudents, setAllStudents] = useState<PersonRaw[]>([]);
  const [teachers, setTeachers] = useState<PersonRaw[]>([]);
  const [staff, setStaff] = useState<PersonRaw[]>([]);
  const [selectedDivision, setSelectedDivision] = useState(searchParams.get("division") || "");
  const [selectedClass, setSelectedClass] = useState(searchParams.get("class") || "");
  const [academicYear] = useState(String(new Date().getFullYear()));

  const [classLoading, setClassLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [existing, setExisting] = useState<Map<number, AttendanceRow>>(new Map());
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [openRemarks, setOpenRemarks] = useState<Set<number>>(new Set());
  const [override, setOverride] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{
    attendeeType: AttendeeType;
    attendeeId: number;
    name: string;
    date?: string;
  } | null>(null);

  /* ---------- reference data ---------- */

  useEffect(() => {
    (async () => {
      try {
        setDivisions(normalizeArray(await cachedGet("/madrasa-divisions")));
      } catch (err) {
        logger.error("LOAD DIVISIONS ERROR:", err);
      }
    })();
    (async () => {
      try {
        setAllStudents(normalizeArray(await cachedGet("/students")));
      } catch (err) {
        logger.error("LOAD STUDENTS ERROR:", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (attendeeType === "TEACHER" && teachers.length === 0) {
      cachedGet("/teachers")
        .then((res) => setTeachers(normalizeArray(res)))
        .catch((err) => logger.error("LOAD TEACHERS ERROR:", err));
    }
    if (attendeeType === "STAFF" && staff.length === 0) {
      cachedGet("/staff")
        .then((res) => setStaff(normalizeArray(res)))
        .catch((err) => logger.error("LOAD STAFF ERROR:", err));
    }
  }, [attendeeType, teachers.length, staff.length]);

  const loadClasses = useCallback(async (divisionId: string) => {
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      setClassLoading(true);
      setClasses(normalizeArray(await cachedGet(`/madrasa-classes?division_id=${divisionId}`)));
    } catch (err) {
      logger.error("CLASS LOAD ERROR:", err);
      setClasses([]);
    } finally {
      setClassLoading(false);
    }
  }, []);

  // Deep link (?division=&class=) from the report page: load that division's classes once.
  const initialDivision = useRef(selectedDivision);
  useEffect(() => {
    if (initialDivision.current) void loadClasses(initialDivision.current);
  }, [loadClasses]);

  /* ---------- day info ---------- */

  useEffect(() => {
    let alive = true;
    setDayInfo(null);
    attendanceApi
      .dayInfo(date)
      .then((info) => alive && setDayInfo(info && typeof info === "object" && "off" in info ? info : fallbackDayInfo(date)))
      .catch((err) => {
        logger.error("DAY INFO ERROR:", err);
        if (alive) setDayInfo(fallbackDayInfo(date));
      });
    return () => {
      alive = false;
    };
  }, [date]);

  const today = dayInfo?.today || localIsoDate();
  const isPast = date < today;
  const windowOk = !dayInfo || dayInfo.within_window || dayInfo.can_edit_past || canEdit;
  const sheetLocked = !canMark || !dayInfo || dayInfo.off || dayInfo.is_future || !windowOk;

  /* ---------- people ---------- */

  const people: Person[] = useMemo(() => {
    if (attendeeType === "STUDENT") {
      if (!selectedClass) return [];
      return allStudents
        .filter(
          (s) => String(s.class_id) === String(selectedClass) && String(s.academic_year) === academicYear,
        )
        .map((s) => ({ id: Number(s.id), name: s.name_bn || s.name || tx.common.noName, roll: s.roll }))
        .sort((a, b) => Number(a.roll || 0) - Number(b.roll || 0));
    }
    const list = attendeeType === "TEACHER" ? teachers : staff;
    return list
      .map((p) => ({ id: Number(p.id), name: p.name_bn || p.name || tx.common.noName, sub: p.designation }))
      .sort((a, b) => a.name.localeCompare(b.name, "bn"));
  }, [attendeeType, selectedClass, allStudents, academicYear, teachers, staff, tx]);

  const ready = attendeeType !== "STUDENT" || !!selectedClass;

  /* ---------- existing rows ---------- */

  const loadRows = useCallback(async () => {
    if (!ready) {
      setExisting(new Map());
      setDrafts({});
      return;
    }
    try {
      setRowsLoading(true);
      setExisting(new Map());
      const rows = await attendanceApi.rows({
        date,
        attendee_type: attendeeType,
        ...(attendeeType === "STUDENT" ? { class_id: Number(selectedClass) } : {}),
      });
      setExisting(new Map(rows.map((row) => [Number(row.attendeeId), row])));
    } catch (err) {
      logger.error("LOAD ATTENDANCE ERROR:", err);
      useToastStore.getState().show(getText(attendanceText).mark.loadFailed, "error");
      setExisting(new Map());
    } finally {
      setRowsLoading(false);
    }
  }, [ready, date, attendeeType, selectedClass]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // Build drafts from the existing rows. A fresh sheet defaults everyone to
  // present (old behaviour); a partly-taken sheet leaves the rest unmarked.
  const baseDrafts = useMemo(() => {
    const fresh = existing.size === 0;
    const next: Record<number, Draft> = {};
    for (const p of people) {
      const row = existing.get(p.id);
      next[p.id] = row
        ? { status: row.status, remarks: row.remarks || "" }
        : { status: fresh ? "PRESENT" : null, remarks: "" };
    }
    return next;
  }, [existing, people]);

  useEffect(() => {
    setDrafts(baseDrafts);
    setOpenRemarks(new Set(Object.entries(baseDrafts).filter(([, d]) => d.remarks).map(([id]) => Number(id))));
  }, [baseDrafts]);

  useEffect(() => {
    setOverride(false);
    setSearch("");
  }, [date, attendeeType, selectedClass]);

  /* ---------- derived ---------- */

  const rowEditable = (id: number) => {
    if (sheetLocked) return false;
    const row = existing.get(id);
    if (row && isProtectedSource(row.source)) return override && canEdit;
    return true;
  };

  const isDirty = (id: number) => {
    const d = drafts[id];
    if (!d || !d.status) return false;
    const row = existing.get(id);
    if (!row) return true;
    return row.status !== d.status || (row.remarks || "") !== d.remarks.trim();
  };

  const dirtyIds = useMemo(
    () => people.filter((p) => isDirty(p.id)).map((p) => p.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, drafts, existing],
  );

  const counts = useMemo(() => {
    const c = { PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0, unmarked: 0 };
    for (const p of people) {
      const s = drafts[p.id]?.status;
      if (s) c[s] += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [people, drafts]);

  const protectedCount = useMemo(
    () => people.filter((p) => isProtectedSource(existing.get(p.id)?.source)).length,
    [people, existing],
  );

  const visiblePeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q) || String(p.roll ?? "").includes(q));
  }, [people, search]);

  /* ---------- actions ---------- */

  const setStatus = (id: number, status: AttendanceStatus) => {
    if (!rowEditable(id)) return;
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || { remarks: "" }), status } }));
  };

  const setRemarks = (id: number, remarks: string) => {
    if (!rowEditable(id)) return;
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || { status: null }), remarks } }));
  };

  const markAllPresent = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const p of people) {
        if (rowEditable(p.id)) next[p.id] = { ...(next[p.id] || { remarks: "" }), status: "PRESENT" };
      }
      return next;
    });
  };

  const toggleRemarks = (id: number) =>
    setOpenRemarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const needsReason = useMemo(
    () =>
      dirtyIds.some((id) => {
        const row = existing.get(id);
        if (!row) return false;
        return isProtectedSource(row.source) || (isPast && row.status !== drafts[id]?.status);
      }),
    [dirtyIds, existing, drafts, isPast],
  );

  const doSave = async (reason?: string) => {
    const tt = getText(attendanceText).mark;
    const entries = dirtyIds.map((id) => {
      const d = drafts[id];
      return {
        attendee_id: id,
        status: d.status as AttendanceStatus,
        ...(d.remarks.trim() ? { remarks: d.remarks.trim() } : {}),
      };
    });
    if (entries.length === 0) {
      useToastStore.getState().show(tt.nothingToSave, "info");
      return;
    }
    const overrideProtected = override && canEdit && dirtyIds.some((id) => isProtectedSource(existing.get(id)?.source));

    try {
      setSaving(true);
      const result = await attendanceApi.bulk({
        attendee_type: attendeeType,
        date,
        ...(attendeeType === "STUDENT" ? { class_id: Number(selectedClass) } : {}),
        entries,
        ...(reason ? { reason } : {}),
        ...(overrideProtected ? { override_protected: true } : {}),
      });
      setReasonOpen(false);
      useToastStore
        .getState()
        .show(tt.savedSummary(num(result.created), num(result.updated), num(result.unchanged)), "success");
      if (result.skipped.length > 0) {
        const nameById = new Map(people.map((p) => [p.id, p.name]));
        const names = result.skipped
          .slice(0, 3)
          .map((s) => nameById.get(Number(s.attendee_id)) || `#${s.attendee_id}`)
          .join(", ");
        const more = result.skipped.length > 3 ? " ..." : "";
        useToastStore.getState().show(tt.skipped(num(result.skipped.length), names + more), "info", { duration: 7000 });
      }
      await loadRows();
    } catch (err) {
      if (!reason && apiErrorHas(err, "reason_required")) {
        setReasonOpen(true);
        return;
      }
      setReasonOpen(false);
      useToastStore.getState().show(apiErrorMessage(err, tt.saveFailed), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (attendeeType === "STUDENT" && !selectedClass) {
      useToastStore.getState().show(getText(attendanceText).mark.selectClassFirst, "error");
      return;
    }
    if (needsReason) {
      setReasonOpen(true);
      return;
    }
    void doSave();
  };

  /* ---------- render ---------- */

  const dayBanner = (() => {
    if (!dayInfo) return null;
    if (dayInfo.is_future)
      return { tone: "rose", icon: <AlertTriangle size={16} />, text: t.futureDate, link: false };
    if (dayInfo.off)
      return {
        tone: "rose",
        icon: <CalendarOff size={16} />,
        text: dayInfo.reason === "holiday" ? t.offDayHoliday(dayInfo.title || "") : t.offDayWeekly,
        link: true,
      };
    if (!canMark) return { tone: "amber", icon: <Lock size={16} />, text: t.noPermission, link: false };
    if (!dayInfo.within_window) {
      const days = num(dayInfo.edit_window_days);
      return windowOk
        ? { tone: "amber", icon: <Info size={16} />, text: t.outsideWindowAllowed(days), link: false }
        : { tone: "rose", icon: <Lock size={16} />, text: t.outsideWindow(days), link: false };
    }
    if (isPast && existing.size > 0) return { tone: "blue", icon: <Info size={16} />, text: t.pastNotice, link: false };
    return null;
  })();

  const toneCls: Record<string, string> = {
    rose: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300",
  };

  const counter = (text: string, cls: string) => (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{text}</span>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-28">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      {/* Controls */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {ATTENDEE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={attendeeType === type}
              onClick={() => setAttendeeType(type)}
              className={`h-9 rounded-lg text-sm font-semibold transition ${
                attendeeType === type
                  ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {tx.common.attendeeType[type]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex gap-1.5">
            <input
              type="date"
              aria-label={t.date}
              value={date}
              max={today}
              onChange={(e) => {
                const v = e.target.value;
                if (v && v <= today) setDate(v);
              }}
              className={selectCls}
            />
            {date !== today && (
              <button
                type="button"
                onClick={() => setDate(today)}
                className="h-9 shrink-0 rounded-lg border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t.today}
              </button>
            )}
          </div>
          {attendeeType === "STUDENT" && (
            <>
              <select
                value={selectedDivision}
                onChange={(e) => {
                  setSelectedDivision(e.target.value);
                  setSelectedClass("");
                  void loadClasses(e.target.value);
                }}
                className={selectCls}
              >
                <option value="">{tx.common.selectDivision}</option>
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
                className={selectCls}
              >
                <option value="">{classLoading ? tx.common.classLoading : tx.common.selectClass}</option>
                {classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name_bn}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatIsoDate(date, lang, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>

        {dayBanner && (
          <div className={`flex flex-wrap items-start gap-2 rounded-xl border p-3 text-sm ${toneCls[dayBanner.tone]}`}>
            <span className="mt-0.5 shrink-0">{dayBanner.icon}</span>
            <span className="min-w-0 flex-1">{dayBanner.text}</span>
            {dayBanner.link && (
              <Link to="/attendance/device-settings" className="shrink-0 text-xs font-semibold underline underline-offset-2">
                {t.offDaySettings}
              </Link>
            )}
          </div>
        )}

        {ready && people.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {counter(t.total(num(people.length)),"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300")}
            {ATTENDANCE_STATUSES.map((s) => (
              <span key={s}>{counter(`${tx.common.status[s]}: ${num(counts[s])}`, STATUS_STYLE[s].badge)}</span>
            ))}
            {counts.unmarked > 0 &&
              counter(`${tx.common.unmarked}: ${num(counts.unmarked)}`, "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}
          </div>
        )}
      </div>

      {/* List */}
      {!ready ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {t.selectFirst}
        </div>
      ) : rowsLoading && existing.size === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <SkeletonList items={6} />
        </div>
      ) : people.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {attendeeType === "STUDENT"
            ? t.noStudentsYear(formatNumber(academicYear, lang).replace(/[,٬]/g, ""))
            : t.noPeople}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2 border-b border-slate-100 p-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-64">
              <Search size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
                className={`${selectCls} ps-8`}
              />
            </div>
            {!sheetLocked && (
              <Button variant="secondary" onClick={markAllPresent} className="h-9 gap-1.5 py-0">
                <CheckCheck size={15} />
                {t.allPresent}
              </Button>
            )}
          </div>

          {(protectedCount > 0 || (existing.size > 0 && !isPast)) && (
            <div className="space-y-2 border-b border-slate-100 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              {existing.size > 0 && !isPast && <p>{t.existingNotice(num(existing.size))}</p>}
              {protectedCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5">
                    <Lock size={13} className="shrink-0" />
                    {t.protectedHint}
                  </p>
                  {canEdit && !sheetLocked && (
                    <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200" title={t.overrideHint}>
                      {t.overrideToggle}
                      <ToggleSwitch checked={override} onChange={setOverride} size="sm" />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {visiblePeople.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{t.noMatch}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {visiblePeople.map((p) => {
                const row = existing.get(p.id);
                const draft = drafts[p.id] || { status: null, remarks: "" };
                const editable = rowEditable(p.id);
                const protectedRow = !!row && isProtectedSource(row.source);
                const dirty = isDirty(p.id);
                const showRemarks = openRemarks.has(p.id);
                return (
                  <li
                    key={p.id}
                    className={`px-3 py-2.5 ${dirty ? "bg-indigo-50/60 dark:bg-indigo-950/20" : ""}`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        {p.roll !== undefined && (
                          <span className="w-9 shrink-0 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {p.roll ?? "-"}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{p.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {p.sub && <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{p.sub}</span>}
                            {protectedRow && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                                <Lock size={10} />
                                {tx.common.source[row!.source || ""] || row!.source}
                              </span>
                            )}
                            {row?.checkInAt && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <Clock size={11} />
                                {tx.common.checkIn(formatTime(row.checkInAt, lang))}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 sm:hidden">
                          <RowIcons
                            remarksOn={showRemarks || !!draft.remarks}
                            onHistory={() => setHistoryTarget({ attendeeType, attendeeId: p.id, name: p.name })}
                            onRemarks={() => toggleRemarks(p.id)}
                            historyLabel={tx.common.history}
                            remarksLabel={t.remarks}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StatusSegment value={draft.status} onChange={(s) => setStatus(p.id, s)} disabled={!editable} />
                        <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
                          <RowIcons
                            remarksOn={showRemarks || !!draft.remarks}
                            onHistory={() => setHistoryTarget({ attendeeType, attendeeId: p.id, name: p.name })}
                            onRemarks={() => toggleRemarks(p.id)}
                            historyLabel={tx.common.history}
                            remarksLabel={t.remarks}
                          />
                        </div>
                      </div>
                    </div>
                    {showRemarks && (
                      <input
                        type="text"
                        value={draft.remarks}
                        maxLength={255}
                        disabled={!editable}
                        onChange={(e) => setRemarks(p.id, e.target.value)}
                        placeholder={t.remarksPlaceholder}
                        className={`${selectCls} mt-2 h-8 text-xs`}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Sticky save bar */}
      {!sheetLocked && dirtyIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{t.changes(num(dirtyIds.length))}</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDrafts(baseDrafts)} disabled={saving}>
                {t.discard}
              </Button>
              <Button onClick={handleSave} disabled={saving || rowsLoading} className="gap-1.5">
                <Save size={15} />
                {saving ? t.saving : t.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ReasonModal
        open={reasonOpen}
        saving={saving}
        onCancel={() => setReasonOpen(false)}
        onConfirm={(reason) => void doSave(reason)}
      />
      <AttendanceHistoryModal target={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
};

function RowIcons({
  remarksOn,
  onHistory,
  onRemarks,
  historyLabel,
  remarksLabel,
}: {
  remarksOn: boolean;
  onHistory: () => void;
  onRemarks: () => void;
  historyLabel: string;
  remarksLabel: string;
}) {
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";
  return (
    <>
      <button type="button" onClick={onRemarks} title={remarksLabel} aria-label={remarksLabel} className={`${btn} ${remarksOn ? "text-indigo-600 dark:text-indigo-400" : ""}`}>
        <MessageSquare size={15} />
      </button>
      <button type="button" onClick={onHistory} title={historyLabel} aria-label={historyLabel} className={btn}>
        <History size={15} />
      </button>
    </>
  );
}

export default AttendanceMarkPage;
