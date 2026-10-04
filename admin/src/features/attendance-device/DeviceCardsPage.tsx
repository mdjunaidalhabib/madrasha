import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Briefcase, CreditCard, GraduationCap, IdCard, RefreshCw, Search, Users, X } from "lucide-react";
import { useText, getText, useLang, localizeDigits } from "@madrasha/shared-ui/src/i18n";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import FilterSelect from "../../components/common/FilterSelect";
import { filterPeopleBySearch } from "../../utils/personSearch";
import { attendanceDeviceApi } from "../../services/attendanceDeviceApi";
import { ProgressSummary, SegmentedFilter } from "../students/photo-manager/PeopleToolbar";
import { useClassTree, useDeviceStatus } from "./hooks";
import { ATTENDEE_TYPES, type AttendeeType, type CardPerson } from "./types";
import { deviceCardsText } from "./cards/deviceCards.text";
import { DevicePicker } from "./cards/cardParts";
import { useEnrollDevice } from "./cards/useEnrollDevice";
import PersonCardTile from "./cards/PersonCardTile";
import EnrollCardModal, { type EnrollMode } from "./cards/EnrollCardModal";
import SeriesEnrollModal from "./cards/SeriesEnrollModal";

type CardFilter = "" | "missing" | "has";

const PAGE_CHUNK = 60;
const TAB_ICONS: Record<AttendeeType, typeof Users> = { STUDENT: GraduationCap, TEACHER: Users, STAFF: Briefcase };
const keyOf = (p: CardPerson) => `${p.attendee_type}:${p.attendee_id}`;
const rollNum = (v: unknown) => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? Number.MAX_SAFE_INTEGER : n;
};

/**
 * কার্ড এনরোলমেন্ট - like the photo upload page, but for K40 RFID cards:
 * pick a person, they tap their card on the machine and it's linked. Series
 * mode walks everyone still without a card.
 */
export default function DeviceCardsPage() {
  const t = useText(deviceCardsText);
  const lang = useLang();
  const n = (v: string | number) => localizeDigits(v, lang);
  const [searchParams, setSearchParams] = useSearchParams();
  const [initial] = useState(() => Object.fromEntries(searchParams.entries()));

  const [tab, setTabState] = useState<AttendeeType>(
    ATTENDEE_TYPES.includes(initial.type as AttendeeType) ? (initial.type as AttendeeType) : "STUDENT",
  );
  const [division, setDivisionState] = useState(initial.division || "");
  const [classId, setClassId] = useState(initial.class || "");
  const [search, setSearch] = useState(initial.q || "");
  const [cardFilter, setCardFilter] = useState<CardFilter>(
    initial.card === "missing" || initial.card === "has" ? initial.card : "",
  );

  const [lists, setLists] = useState<Partial<Record<AttendeeType, CardPerson[]>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_CHUNK);
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ person: CardPerson; mode: EnrollMode } | null>(null);
  const [seriesQueue, setSeriesQueue] = useState<CardPerson[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  const savedTimers = useRef<Record<string, number>>({});
  const reqId = useRef(0);

  const { divisions, classes } = useClassTree();
  const { devices } = useDeviceStatus(15_000);
  const picker = useEnrollDevice(devices);

  /* ---------------- data ---------------- */

  const load = useCallback(async (type: AttendeeType) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    try {
      const list = await attendanceDeviceApi.listAllPeople({ attendee_type: type }, { silent: true });
      if (id !== reqId.current) return;
      setLists((prev) => ({ ...prev, [type]: list }));
    } catch {
      if (id === reqId.current) setError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lists[tab]) void load(tab);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, load]);

  const reload = () => load(tab);

  // Mirror filters in the URL (shareable / survives refresh).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const put = (k: string, v: string) => (v ? next.set(k, v) : next.delete(k));
          put("type", tab === "STUDENT" ? "" : tab);
          put("division", division);
          put("class", classId);
          put("q", search.trim());
          put("card", cardFilter);
          return next.toString() === prev.toString() ? prev : next;
        },
        { replace: true },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tab, division, classId, search, cardFilter, setSearchParams]);

  useEffect(() => {
    const timers = savedTimers.current;
    return () => Object.values(timers).forEach((x) => window.clearTimeout(x));
  }, []);

  /* ---------------- derived lists ---------------- */

  const classOrder = useMemo(() => new Map(classes.map((cl, i) => [cl.id, i])), [classes]);
  const classDivision = useMemo(() => new Map(classes.map((cl) => [cl.id, cl.divisionId])), [classes]);
  const classOptions = classes.filter((cl) => !division || String(cl.divisionId) === division);

  const sorted = useMemo(() => {
    const list = [...(lists[tab] || [])];
    if (tab === "STUDENT" && classOrder.size) {
      list.sort(
        (a, b) =>
          (classOrder.get(a.class_id ?? -1) ?? 9999) - (classOrder.get(b.class_id ?? -1) ?? 9999) ||
          rollNum(a.roll) - rollNum(b.roll),
      );
    }
    return list;
  }, [lists, tab, classOrder]);

  const scoped = useMemo(
    () =>
      tab !== "STUDENT"
        ? sorted
        : sorted.filter(
            (p) =>
              (!division || String(classDivision.get(p.class_id ?? -1) ?? "") === division) &&
              (!classId || String(p.class_id) === classId),
          ),
    [sorted, tab, division, classId, classDivision],
  );

  const searched = useMemo(
    () =>
      filterPeopleBySearch(scoped, search, (p) => ({
        text: [p.name, p.name_en, p.class_name, p.designation, p.device_user_id, p.card_number],
        registrationNo: p.registration_no,
        roll: p.roll,
      })),
    [scoped, search],
  );

  const filtered = useMemo(() => {
    // A just-linked card stays put (highlighted) instead of vanishing from "কার্ড নেই".
    const touched = (p: CardPerson) => Boolean(savedKeys[keyOf(p)]);
    if (cardFilter === "missing") return searched.filter((p) => !p.card_number || touched(p));
    if (cardFilter === "has") return searched.filter((p) => p.card_number || touched(p));
    return searched;
  }, [searched, cardFilter, savedKeys]);

  const total = scoped.length;
  const withCard = scoped.filter((p) => p.card_number).length;
  const missingQueue = useMemo(() => filtered.filter((p) => !p.card_number), [filtered]);

  useEffect(() => setVisibleCount(PAGE_CHUNK), [tab, division, classId, search, cardFilter]);

  const scopeLabel =
    [
      division && divisions.find((d) => String(d.id) === division)?.name,
      classId && classes.find((cl) => String(cl.id) === classId)?.name,
    ]
      .filter(Boolean)
      .join(" › ") || t.allOf(t.tabs[tab]);

  /* ---------------- updates ---------------- */

  const updatePerson = useCallback((person: CardPerson) => {
    const key = keyOf(person);
    setLists((prev) => {
      const list = prev[person.attendee_type];
      if (!list) return prev;
      return {
        ...prev,
        [person.attendee_type]: list.map((p) => (keyOf(p) === key ? { ...p, ...person } : p)),
      };
    });
    if (person.card_number) {
      window.clearTimeout(savedTimers.current[key]);
      setSavedKeys((prev) => ({ ...prev, [key]: true }));
      savedTimers.current[key] = window.setTimeout(
        () =>
          setSavedKeys((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          }),
        4000,
      );
    }
  }, []);

  const openEnroll = useCallback((person: CardPerson) => setModal({ person, mode: "machine" }), []);
  const openManual = useCallback((person: CardPerson) => setModal({ person, mode: "manual" }), []);

  const removeCard = useCallback(
    (person: CardPerson) => {
      const tx = getText(deviceCardsText);
      useConfirmStore.getState().show({
        title: tx.removeCardTitle,
        message: tx.removeCardMessage(person.name, person.card_number || ""),
        confirmText: tx.removeCard,
        danger: true,
        onConfirm: async () => {
          try {
            await attendanceDeviceApi.clearCard(person.attendee_type, person.attendee_id);
            updatePerson({ ...person, card_number: null });
            useToastStore.getState().show(tx.cardRemoved(person.name), "success");
          } catch {
            // interceptor toast
          }
        },
      });
    },
    [updatePerson],
  );

  const assignPins = () => {
    const tx = getText(deviceCardsText);
    const targetClasses =
      tab !== "STUDENT"
        ? [undefined]
        : classId
          ? [Number(classId)]
          : division
            ? classOptions.map((cl) => cl.id)
            : [undefined];
    useConfirmStore.getState().show({
      title: tx.assignPinsTitle,
      message: tx.assignPinsMessage(scopeLabel),
      confirmText: tx.assignPinsConfirm,
      onConfirm: async () => {
        setAssigning(true);
        try {
          let created = 0;
          for (const cls of targetClasses) {
            const res = await attendanceDeviceApi.assignPins({ attendee_type: tab, class_id: cls });
            created += Number(res?.created ?? 0);
          }
          useToastStore
            .getState()
            .show(created > 0 ? tx.assignPinsDone(localizeDigits(created, lang)) : tx.assignPinsNone, "success");
          await load(tab);
        } catch {
          // interceptor toast
        } finally {
          setAssigning(false);
        }
      },
    });
  };

  const setTab = (next: AttendeeType) => {
    setTabState(next);
    setDivisionState("");
    setClassId("");
  };

  /* ---------------- render ---------------- */

  return (
    <div className="flex min-h-full flex-col bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">{t.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-slate-400">{t.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={assignPins}
              disabled={loading || assigning || total === 0}
              title={t.assignPinsHint}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <IdCard className={`h-4 w-4 text-indigo-600 ${assigning ? "animate-pulse" : ""}`} /> {t.assignPins}
            </button>
            <button
              type="button"
              onClick={() => setSeriesQueue(missingQueue)}
              disabled={loading || missingQueue.length === 0 || picker.activeDevices.length === 0}
              title={t.seriesHint}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" /> {t.seriesMode}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 sm:self-start">
          {ATTENDEE_TYPES.map((type) => {
            const Icon = TAB_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => setTab(type)}
                className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition ${
                  tab === type
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.tabs[type]}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <DevicePicker picker={picker} compact />
        </div>

        <ProgressSummary
          scopeLabel={scopeLabel}
          total={total}
          done={withCard}
          doneLabel={t.hasCard}
          remainingLabel={t.noCard}
        />

        {/* Filters */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="relative col-span-2 sm:w-[240px]">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "STUDENT" ? t.searchStudents : t.searchOthers}
                className="h-9 w-full rounded-md border border-gray-300 ps-8 pe-8 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                  aria-label={t.clearSearch}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {tab === "STUDENT" && (
              <>
                <FilterSelect
                  value={division}
                  onChange={(v) => {
                    setDivisionState(v);
                    setClassId("");
                  }}
                  wrapperClassName="w-full sm:w-[150px]"
                >
                  <option value="">{t.allDivisions}</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect value={classId} onChange={setClassId} wrapperClassName="w-full sm:w-[170px]">
                  <option value="">{t.allClasses}</option>
                  {classOptions.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </FilterSelect>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SegmentedFilter
              value={cardFilter}
              onChange={setCardFilter}
              options={[
                { value: "", label: t.all, count: total },
                { value: "missing", label: t.noCard, count: total - withCard },
                { value: "has", label: t.hasCard, count: withCard },
              ]}
            />
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              title={t.refresh}
              aria-label={t.refresh}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
            <span>{t.loadFailed}</span>
            <button type="button" onClick={reload} className="font-semibold underline">
              {t.retry}
            </button>
          </div>
        )}

        {/* Grid */}
        {loading && !lists[tab] ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <Skeleton className="h-[72px] w-[54px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <CreditCard className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              {cardFilter === "missing" && total > 0 ? t.allDone : t.noneFound}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.tryChangingFilter}</p>
          </div>
        ) : (
          <>
            <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
              {filtered.slice(0, visibleCount).map((p) => (
                <PersonCardTile
                  key={keyOf(p)}
                  person={p}
                  justSaved={savedKeys[keyOf(p)]}
                  onEnroll={openEnroll}
                  onManual={openManual}
                  onRemoveCard={removeCard}
                />
              ))}
            </div>
            {filtered.length > visibleCount && (
              <div className="flex flex-col items-center gap-1 py-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((v) => v + PAGE_CHUNK)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t.showMore}
                </button>
                <span className="text-xs text-slate-400">{t.showingOf(n(visibleCount), n(filtered.length))}</span>
              </div>
            )}
          </>
        )}
      </div>

      <EnrollCardModal
        open={!!modal}
        person={modal?.person ?? null}
        mode={modal?.mode}
        onClose={() => setModal(null)}
        onChange={updatePerson}
      />

      <SeriesEnrollModal
        open={!!seriesQueue}
        queue={seriesQueue || []}
        onClose={() => setSeriesQueue(null)}
        onPersonUpdated={updatePerson}
      />

    </div>
  );
}
