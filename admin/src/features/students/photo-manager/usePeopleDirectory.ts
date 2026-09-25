import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { cachedGet } from "../../../services/api";
import { useAuthStore } from "../../../store/authStore";
import { hasPermission } from "../../../utils/permissions";
import { filterPeopleBySearch } from "../../../utils/personSearch";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import {
  TAB_META,
  toStaffPerson,
  toStudentPerson,
  unwrapList,
  type DirectoryPerson,
  type PeopleTab,
} from "./photoManager";

export type Division = { division_id: number; division_name_bn: string };
export type ClassItem = { class_id: number; class_name_bn: string; division_id?: number };

/**
 * Shared data layer for the people tools (ছবি আপলোড, নাম (৩ ভাষা)):
 * permission-gated শিক্ষার্থী/শিক্ষক/স্টাফ tabs, বিভাগ/শ্রেণি reference data in
 * the madrasa's own sortOrder, the tab's list (students: বিভাগ → শ্রেণি → রোল),
 * scope + search filtering, and URL mirroring of every filter.
 *
 * `extraParams` are page-specific filters (e.g. photo=missing) that should
 * live in the URL too; read their initial values via `initialParam`.
 */
export function usePeopleDirectory(extraParams: Record<string, string> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  const canEdit: Record<PeopleTab, boolean> = {
    students: hasPermission(user, permissions, TAB_META.students.permission),
    teachers: hasPermission(user, permissions, TAB_META.teachers.permission),
    staff: hasPermission(user, permissions, TAB_META.staff.permission),
  };
  // Students tab always shows (these pages live under শিক্ষার্থী); the other
  // two only for roles that can actually edit those records.
  const tabs = (Object.keys(TAB_META) as PeopleTab[]).filter((t) => t === "students" || canEdit[t]);

  const [initial] = useState(() => Object.fromEntries(searchParams.entries()));
  const initialTab = initial.tab as PeopleTab | undefined;
  const [tab, setTabState] = useState<PeopleTab>(initialTab && tabs.includes(initialTab) ? initialTab : "students");
  const [search, setSearch] = useState(initial.q || "");
  const [division, setDivisionState] = useState(initial.division || "");
  const [classId, setClassId] = useState(initial.class || "");

  const [lists, setLists] = useState<Partial<Record<PeopleTab, DirectoryPerson[]>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const divs = unwrapList(await cachedGet("/madrasa-divisions")) as Division[];
        setDivisions(divs);
        // Every division's classes, kept in the madrasa's own order - drives both
        // the শ্রেণি dropdown and the class-then-roll ordering.
        const perDivision = await Promise.all(
          divs.map((d) =>
            cachedGet(`/madrasa-classes?division_id=${d.division_id}`)
              .then((r) => (unwrapList(r) as ClassItem[]).map((c) => ({ ...c, division_id: d.division_id })))
              .catch(() => [] as ClassItem[]),
          ),
        );
        setClasses(perDivision.flat());
      } catch (err) {
        logger.error("PEOPLE TOOL REFERENCE LOAD ERROR:", err);
      }
    })();
  }, []);

  const classOrder = useMemo(() => new Map(classes.map((c, i) => [String(c.class_id), i])), [classes]);
  const divisionOrder = useMemo(() => new Map(divisions.map((d, i) => [String(d.division_id), i])), [divisions]);

  const reload = useCallback(async (t: PeopleTab) => {
    setLoading(true);
    setError("");
    try {
      // Fresh read (not cachedGet) - these pages are where the records change.
      const rows = unwrapList(await api.get(TAB_META[t].listUrl));
      const list =
        t === "students"
          ? rows.filter((s) => Number(s.is_active ?? 1) === 1).map(toStudentPerson)
          : rows.filter((s) => s.is_active === undefined || Number(s.is_active) !== 0).map(toStaffPerson);
      setLists((prev) => ({ ...prev, [t]: list }));
    } catch (err) {
      logger.error("PEOPLE TOOL LIST LOAD ERROR:", err);
      setError("তালিকা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lists[tab]) reload(tab);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reload]);

  /** Patch rows of a tab in place after a save (no refetch). */
  const updatePeople = useCallback(
    (t: PeopleTab, fn: (p: DirectoryPerson) => DirectoryPerson) =>
      setLists((prev) => ({ ...prev, [t]: (prev[t] || []).map(fn) })),
    [],
  );

  const sorted = useMemo(() => {
    const list = [...(lists[tab] || [])];
    const num = (v: string | null) => (v == null ? Number.MAX_SAFE_INTEGER : Number(v) || Number.MAX_SAFE_INTEGER);
    if (tab === "students") {
      list.sort(
        (a, b) =>
          (divisionOrder.get(a.divisionId || "") ?? 999) - (divisionOrder.get(b.divisionId || "") ?? 999) ||
          (classOrder.get(a.classId || "") ?? 9999) - (classOrder.get(b.classId || "") ?? 9999) ||
          num(a.roll) - num(b.roll) ||
          num(a.regNo) - num(b.regNo),
      );
    }
    // Teachers/staff already arrive in the madrasa's own registration_no order.
    return list;
  }, [lists, tab, classOrder, divisionOrder]);

  /** বিভাগ/শ্রেণি scope only - base for progress summaries and bulk matching. */
  const scoped = useMemo(
    () =>
      sorted.filter(
        (p) =>
          (tab === "staff" || !division || p.divisionId === division) &&
          (tab !== "students" || !classId || p.classId === classId),
      ),
    [sorted, tab, division, classId],
  );

  const searched = useMemo(
    () =>
      filterPeopleBySearch(
        scoped,
        search,
        (p) => ({ text: [p.name, p.subtitle], registrationNo: p.regNo, roll: p.roll }),
        { numericQueryIdsOnly: true },
      ),
    [scoped, search],
  );

  const extraKey = JSON.stringify(extraParams);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const put = (k: string, v: string) => (v ? next.set(k, v) : next.delete(k));
          put("tab", tab === "students" ? "" : tab);
          put("division", division);
          put("class", classId);
          put("q", search.trim());
          Object.entries(JSON.parse(extraKey) as Record<string, string>).forEach(([k, v]) => put(k, v));
          return next.toString() === prev.toString() ? prev : next;
        },
        { replace: true },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tab, division, classId, search, extraKey, setSearchParams]);

  const setTab = (t: PeopleTab) => {
    setTabState(t);
    setDivisionState("");
    setClassId("");
  };
  const setDivision = (v: string) => {
    setDivisionState(v);
    setClassId("");
  };

  const classOptions = classes.filter((c) => !division || String(c.division_id) === division);
  const scopeLabel =
    [
      division && divisions.find((d) => String(d.division_id) === division)?.division_name_bn,
      classId && classes.find((c) => String(c.class_id) === classId)?.class_name_bn,
    ]
      .filter(Boolean)
      .join(" › ") || `সব ${TAB_META[tab].label}`;

  return {
    tabs,
    tab,
    setTab,
    canEdit,
    tabCanEdit: canEdit[tab],
    initialParam: (key: string) => initial[key] || "",
    search,
    setSearch,
    division,
    setDivision,
    classId,
    setClassId,
    divisions,
    classOptions,
    scopeLabel,
    loading,
    error,
    reload: () => reload(tab),
    updatePeople,
    /** Whole tab list (ignores বিভাগ/শ্রেণি/search). */
    all: sorted,
    scoped,
    searched,
  };
}

export type PeopleDirectory = ReturnType<typeof usePeopleDirectory>;
