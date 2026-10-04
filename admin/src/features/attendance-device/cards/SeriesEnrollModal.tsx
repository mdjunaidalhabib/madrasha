import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  PartyPopper,
  SkipForward,
  User,
  X,
} from "lucide-react";
import { useText, useLang, localizeDigits, commonText } from "@madrasha/shared-ui/src/i18n";
import { useDeviceStatus } from "../hooks";
import type { CardPerson } from "../types";
import { deviceCardsText } from "./deviceCards.text";
import { DevicePicker, EnrollStatusPanel, ManualCardInput, PinCardChips } from "./cardParts";
import { personSubtitle } from "./cardUtils";
import { useCardEnrollment } from "./useCardEnrollment";
import { useEnrollDevice } from "./useEnrollDevice";

type Props = {
  open: boolean;
  /** Snapshot taken when the mode started - linking a card doesn't reshuffle it. */
  queue: CardPerson[];
  onClose: () => void;
  onPersonUpdated: (person: CardPerson) => void;
};

type Result = "done" | "failed";

const ADVANCE_MS = 1_200;
const keyOf = (p: CardPerson) => `${p.attendee_type}:${p.attendee_id}`;

/**
 * "সিরিজ মোড" for cards - walks the queue of people without a card. For the
 * current person an enrollment starts automatically; when they tap their card
 * on the K40 it's linked, a success flash shows and the next person comes up.
 * A USB reader (or typing) into the focused box works too.
 * Enter = save typed number / retry, → = skip, ← = previous, Esc = close.
 */
export default function SeriesEnrollModal(props: Props) {
  if (!props.open) return null;
  return <SeriesEnrollInner {...props} />;
}

function SeriesEnrollInner({ queue, onClose, onPersonUpdated }: Props) {
  const t = useText(deviceCardsText);
  const s = t.series;
  const c = useText(commonText);
  const lang = useLang();
  const n = (v: string | number) => localizeDigits(v, lang);

  const { devices, loading: devicesLoading } = useDeviceStatus(10_000);
  const picker = useEnrollDevice(devices);
  const enroll = useCardEnrollment();
  const { start, reset } = enroll;

  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [linked, setLinked] = useState<Record<string, CardPerson>>({});
  const [flash, setFlash] = useState(false);
  const advanceTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const finished = index >= queue.length;
  const current = finished ? null : (linked[keyOf(queue[index])] ?? queue[index]);
  const currentKey = current ? keyOf(current) : "";
  const deviceId = picker.deviceId;

  const clearAdvance = () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  };

  const go = useCallback(
    (next: number) => {
      clearAdvance();
      setFlash(false);
      setIndex(Math.max(0, Math.min(next, queue.length)));
    },
    [queue.length],
  );

  const startCurrent = useCallback(() => {
    if (!current || deviceId == null) return;
    void start(current.attendee_type, current.attendee_id, deviceId);
  }, [current, deviceId, start]);

  // New person (or device switched): start an enrollment automatically,
  // unless this person was already linked in this run (going back).
  useEffect(() => {
    if (!current) {
      reset();
      return;
    }
    if (devicesLoading || deviceId == null) return;
    if (results[currentKey] === "done") {
      reset();
      return;
    }
    void start(current.attendee_type, current.attendee_id, deviceId);
    window.setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, deviceId, devicesLoading]);

  const markDone = useCallback(
    (person: CardPerson) => {
      const key = keyOf(person);
      setResults((prev) => ({ ...prev, [key]: "done" }));
      setLinked((prev) => ({ ...prev, [key]: person }));
      onPersonUpdated(person);
      setFlash(true);
      clearAdvance();
      advanceTimer.current = window.setTimeout(() => {
        setFlash(false);
        setIndex((i) => (queue[i] && keyOf(queue[i]) === key ? i + 1 : i));
      }, ADVANCE_MS);
    },
    [onPersonUpdated, queue],
  );

  // Enrollment finished on the machine.
  const phase = enroll.phase;
  const enrollmentId = enroll.enrollment?.id;
  useEffect(() => {
    if (!current || !enroll.enrollment || enroll.enrollment.attendee_id !== current.attendee_id) return;
    if (phase === "completed") {
      const e = enroll.enrollment;
      markDone({
        ...current,
        card_number: e.card_number ?? current.card_number,
        device_user_id: e.device_user_id ?? current.device_user_id,
      });
    } else if (phase === "failed" || phase === "expired") {
      setResults((prev) => (prev[currentKey] === "done" ? prev : { ...prev, [currentKey]: "failed" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, enrollmentId]);

  const onManualSaved = (updated: CardPerson) => {
    reset();
    markDone(updated);
  };

  const retry = useCallback(() => {
    if (enroll.running) return;
    startCurrent();
  }, [enroll.running, startCurrent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        !!target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA");
      const fieldHasText = inField && target instanceof HTMLInputElement && target.value !== "";
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (finished) return;
      if (e.key === "ArrowRight" && !fieldHasText) {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft" && !fieldHasText) {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Enter" && !inField) {
        e.preventDefault();
        retry();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, go, index, onClose, retry]);

  useEffect(() => () => clearAdvance(), []);

  const doneCount = Object.values(results).filter((r) => r === "done").length;
  const failedCount = Object.entries(results).filter(([, r]) => r === "failed").length;
  const progress = queue.length ? Math.round((Math.min(index, queue.length) / queue.length) * 100) : 0;
  const recent = queue.filter((p) => results[keyOf(p)]).slice(-12).reverse();
  const nextPerson = queue[index + 1];

  const ghostBtn =
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-slate-900/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {s.progress(n(Math.min(index + 1, queue.length)), n(queue.length))} · {s.enrolledCount(n(doneCount))}
              {failedCount > 0 && s.failedCount(n(failedCount))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={c.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {queue.length === 0 || finished || !current ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <PartyPopper className="h-8 w-8" />
              </div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {queue.length === 0 ? s.empty : s.finishedTitle}
              </div>
              {queue.length > 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {s.finishedSummary(n(doneCount), n(queue.length - doneCount))}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                {queue.length > 0 && (
                  <button type="button" onClick={() => go(index - 1)} className={ghostBtn}>
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {s.goBack}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  {s.done}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,300px)_1fr] md:gap-6 md:p-6">
              {/* Big person card */}
              <div className="mx-auto w-full max-w-[300px]">
                <div
                  className={`relative overflow-hidden rounded-2xl border-2 transition ${
                    flash
                      ? "border-emerald-400 shadow-lg shadow-emerald-500/20"
                      : "border-indigo-200 dark:border-indigo-900/60"
                  }`}
                >
                  <div className="aspect-[3/4] w-full bg-slate-100 dark:bg-slate-800">
                    {current.image ? (
                      <img src={current.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
                        <User className="h-24 w-24" strokeWidth={1} />
                      </div>
                    )}
                  </div>
                  {flash && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-600/85 text-white">
                      <CheckCircle2 className="h-16 w-16" />
                      <div className="text-xl font-bold">{s.success}</div>
                      <div className="text-xs opacity-90">{s.autoNext}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
                    {s.nowEnrolling}
                  </div>
                  <div className="mt-1 text-2xl font-bold leading-tight text-slate-900 dark:text-white sm:text-3xl">
                    {current.name}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{personSubtitle(current) || "—"}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {current.roll != null && current.roll !== "" && (
                      <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-sm font-bold text-white">
                        {t.roll(n(current.roll))}
                      </span>
                    )}
                    {current.registration_no != null && current.registration_no !== "" && (
                      <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                        {t.reg(n(current.registration_no))}
                      </span>
                    )}
                    <PinCardChips person={current} />
                  </div>
                  {nextPerson && (
                    <div className="mt-3 truncate border-t border-indigo-200/70 pt-2 text-xs text-slate-500 dark:border-indigo-900/50 dark:text-slate-400">
                      {s.nextLabel} <span className="font-medium text-slate-700 dark:text-slate-200">{nextPerson.name}</span>
                      {nextPerson.roll != null && nextPerson.roll !== "" && ` · ${t.roll(n(nextPerson.roll))}`}
                    </div>
                  )}
                </div>

                <DevicePicker picker={picker} compact />

                <EnrollStatusPanel
                  enroll={enroll}
                  personName={current.name}
                  onRetry={retry}
                  onCancel={enroll.cancel}
                  disabled={deviceId == null}
                />

                <ManualCardInput
                  key={currentKey}
                  ref={inputRef}
                  person={current}
                  onSaved={onManualSaved}
                  label={s.readerLabel}
                  onEmptyEnter={retry}
                  autoFocus
                />

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={ghostBtn} title={s.previousKey}>
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {s.previous}
                  </button>
                  <button type="button" onClick={() => go(index + 1)} className={ghostBtn} title={s.skipKey}>
                    <SkipForward className="h-4 w-4 rtl:rotate-180" /> {s.skip}
                  </button>
                </div>
                <p className="-mt-2 hidden text-xs text-slate-400 sm:block">{s.keyboardHint}</p>

                {recent.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{s.recent}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {recent.map((p) => {
                        const r = results[keyOf(p)];
                        return (
                          <button
                            type="button"
                            key={keyOf(p)}
                            onClick={() => go(queue.indexOf(p))}
                            className={`inline-flex max-w-[160px] items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              r === "done"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            }`}
                          >
                            {r === "done" ? (
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                            ) : (
                              <AlertCircle className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

