import { forwardRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Hourglass,
  Loader2,
  RotateCcw,
  User,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useText, useLang, localizeDigits } from "@madrasha/shared-ui/src/i18n";
import { attendanceDeviceApi, getApiErrorMessage } from "../../../services/attendanceDeviceApi";
import { inputLabelClass, selectClass } from "../components";
import type { CardPerson } from "../types";
import { normalizeCardInput } from "./cardUtils";
import { deviceCardsText } from "./deviceCards.text";
import type { CardEnrollment } from "./useCardEnrollment";
import type { EnrollDevice } from "./useEnrollDevice";

export function PersonAvatar({ person, className = "h-16 w-12" }: { person: CardPerson; className?: string }) {
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 ${className}`}
    >
      {person.image ? (
        <img src={person.image} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
          <User className="h-1/2 w-1/2" strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}

/** PIN + card chips. */
export function PinCardChips({ person }: { person: CardPerson }) {
  const t = useText(deviceCardsText);
  const lang = useLang();
  return (
    <div className="flex flex-wrap gap-1 text-[10px] font-semibold">
      <span
        className={`rounded px-1.5 py-0.5 ${
          person.device_user_id
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        }`}
      >
        {person.device_user_id ? t.pin(localizeDigits(person.device_user_id, lang)) : t.noPin}
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
          person.card_number
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        }`}
      >
        <CreditCard className="h-3 w-3" />
        {person.card_number ? localizeDigits(person.card_number, lang) : t.noCard}
      </span>
    </div>
  );
}

/** Device chooser (only when several devices are active) + connector status / warnings. */
export function DevicePicker({ picker, compact }: { picker: EnrollDevice; compact?: boolean }) {
  const t = useText(deviceCardsText).device;
  const { activeDevices, device } = picker;

  if (activeDevices.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t.noActive}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
        {activeDevices.length > 1 ? (
          <div className="min-w-[180px] flex-1 sm:flex-none">
            {!compact && <label className={inputLabelClass}>{t.label}</label>}
            <select
              className={`${selectClass} ${compact ? "!py-1.5 !text-xs" : ""}`}
              value={device?.id ?? ""}
              onChange={(e) => picker.setDeviceId(Number(e.target.value))}
              aria-label={t.label}
            >
              {activeDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="text-slate-600 dark:text-slate-300">
            {t.using} <b className="text-slate-900 dark:text-slate-100">{device?.name}</b>
          </span>
        )}
        {picker.connectorOnline && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Wifi className="h-3 w-3" /> {t.online}
          </span>
        )}
      </div>
      {device && !picker.connectorOnline && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t.offline(device.name)}</span>
        </div>
      )}
    </div>
  );
}

/** Countdown ring around the status icon. */
function Ring({ fraction, tone }: { fraction: number; tone: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="5" className="stroke-slate-200 dark:stroke-slate-700" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className={`${tone} transition-[stroke-dashoffset] duration-1000 ease-linear`}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
      />
    </svg>
  );
}

/**
 * Big status block for one enrollment: icon + countdown ring, status line,
 * hint, and retry / cancel buttons. Used by the single modal and series mode.
 */
export function EnrollStatusPanel({
  enroll,
  personName,
  onRetry,
  onCancel,
  disabled,
}: {
  enroll: CardEnrollment;
  personName: string;
  onRetry: () => void;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const t = useText(deviceCardsText).enroll;
  const lang = useLang();
  const { phase, enrollment, secondsLeft, totalSeconds, error } = enroll;

  const tone =
    phase === "completed"
      ? "stroke-emerald-500"
      : phase === "waiting"
        ? "stroke-indigo-500"
        : phase === "pending" || phase === "starting"
          ? "stroke-amber-500"
          : "stroke-rose-500";

  const icon =
    phase === "completed" ? (
      <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
    ) : phase === "waiting" ? (
      <CreditCard className="h-9 w-9 animate-pulse text-indigo-600 dark:text-indigo-400" />
    ) : phase === "pending" ? (
      <Hourglass className="h-8 w-8 text-amber-600 dark:text-amber-400" />
    ) : phase === "starting" ? (
      <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
    ) : phase === "idle" ? (
      <CreditCard className="h-8 w-8 text-slate-400" />
    ) : (
      <XCircle className="h-9 w-9 text-rose-600 dark:text-rose-400" />
    );

  const box =
    phase === "completed"
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
      : phase === "waiting"
        ? "border-indigo-200 bg-indigo-50 dark:border-indigo-900/60 dark:bg-indigo-950/20"
        : phase === "pending" || phase === "starting" || phase === "idle"
          ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40"
          : "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20";

  const running = phase === "starting" || phase === "pending" || phase === "waiting";
  const showRing = running && secondsLeft != null;
  const message =
    phase === "error" ? error : phase === "failed" ? enrollment?.message || "" : "";
  const offline = running && enrollment && !enrollment.connector_online;

  return (
    <div className={`rounded-2xl border p-4 ${box}`} aria-live="polite">
      <div className="flex items-center gap-4">
        <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center">
          {showRing && <Ring fraction={(secondsLeft ?? 0) / totalSeconds} tone={tone} />}
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-slate-900 dark:text-slate-100">{t.status[phase]}</div>
          {phase === "pending" && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{t.pendingHint}</p>}
          {phase === "waiting" && (
            <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{t.waitingHint(personName)}</p>
          )}
          {phase === "completed" && enrollment?.card_number && (
            <p className="mt-0.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {t.cardNumber(localizeDigits(enrollment.card_number, lang))}
            </p>
          )}
          {message && <p className="mt-0.5 break-words text-sm text-rose-700 dark:text-rose-300">{message}</p>}
          {showRing && (
            <p className="mt-1 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {t.secondsLeft(localizeDigits(secondsLeft ?? 0, lang))}
            </p>
          )}
        </div>
      </div>

      {offline && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-300">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t.connectorOfflineNow}
        </p>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {running && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t.cancel}
          </button>
        )}
        {!running && phase !== "completed" && (
          <button
            type="button"
            onClick={onRetry}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {phase === "idle" ? <CreditCard className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            {phase === "idle" ? t.start : t.retry}
          </button>
        )}
      </div>
    </div>
  );
}

type ManualProps = {
  person: CardPerson;
  /** Called with the updated person after a successful save. */
  onSaved: (updated: CardPerson) => void;
  autoFocus?: boolean;
  /** Shown above the input (defaults to "কার্ড নম্বর"). */
  label?: string;
  /** Lets a parent intercept Enter on an empty box (series mode: retry). */
  onEmptyEnter?: () => void;
};

/**
 * Card number box for manual typing or a USB RFID reader (which "types" the
 * number followed by Enter). Enter saves via PUT /people/card.
 */
export const ManualCardInput = forwardRef<HTMLInputElement, ManualProps>(function ManualCardInput(
  { person, onSaved, autoFocus, label, onEmptyEnter },
  ref,
) {
  const t = useText(deviceCardsText).enroll;
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (!value.trim()) {
      onEmptyEnter?.();
      return;
    }
    const card = normalizeCardInput(value);
    if (!card) {
      setError(t.invalidCard);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await attendanceDeviceApi.setCard({
        attendee_type: person.attendee_type,
        attendee_id: person.attendee_id,
        card_number: card,
      });
      setValue("");
      onSaved({ ...person, ...updated, card_number: updated.card_number ?? card });
    } catch (err) {
      setError(getApiErrorMessage(err, t.saveFailed));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className={inputLabelClass}>{label ?? t.manualLabel}</label>
      <div className="flex gap-2">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          disabled={saving}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              void submit();
            }
          }}
          placeholder={t.manualPlaceholder}
          className={`h-10 min-w-0 flex-1 rounded-lg border bg-white px-3 font-mono text-sm tracking-wider outline-none transition focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
            error
              ? "border-rose-400 focus:ring-rose-500/30"
              : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/30 dark:border-slate-700"
          }`}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || !value.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? t.saving : t.save}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t.manualHint}</p>
      )}
    </div>
  );
});
