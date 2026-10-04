import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, MessageSquare, RefreshCw, Save, Trash2 } from "lucide-react";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { useText, getText, useLang, localizeDigits, formatDate } from "@madrasha/shared-ui/src/i18n";
import SectionCard from "../../components/settings/SectionCard";
import { attendanceDeviceApi, getApiErrorMessage } from "../../services/attendanceDeviceApi";
import { inputLabelClass, selectClass } from "./components";
import type { AttendanceHoliday, DeviceSettings } from "./types";
import { deviceSettingsText } from "./settings/deviceSettings.text";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^(\+?88)?01[3-9]\d{8}$/;
const HOLIDAY_DATE: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };

type Errors = Partial<Record<keyof DeviceSettings, string>>;

// pin_warnings is read-only server info, not part of the editable form.
const comparable = ({ pin_warnings: _w, ...s }: DeviceSettings) => ({ ...s, weekly_off_days: [...s.weekly_off_days].sort() });
const sameSettings = (a: DeviceSettings, b: DeviceSettings) =>
  JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));

/** Fills fields an older backend may not send yet. */
const normalizeSettings = (s: DeviceSettings, fallbackDays: number[] = []): DeviceSettings => ({
  ...s,
  pin_mode: s.pin_mode === "auto" ? "auto" : "registration",
  weekly_off_days: Array.isArray(s.weekly_off_days) ? s.weekly_off_days : fallbackDays,
});

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className={inputLabelClass}>{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}

function SmsHint({ text }: { text: string }) {
  const t = useText(deviceSettingsText);
  return (
    <p className="mt-3 flex flex-wrap items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      {text}
      <Link to="/communication/auto-settings" className="font-semibold underline underline-offset-2">
        {t.smsLink}
      </Link>
    </p>
  );
}

/**
 * ডিভাইস সেটিংস - the rules the backend applies to K40 punches: late after
 * start + grace, auto absent at a cut-off, check-out, weekly off days and dated
 * holidays, offline SMS alert, automatic clock sync and the PIN start number.
 */
export default function DeviceSettingsPage() {
  const t = useText(deviceSettingsText);
  const lang = useLang();
  const [original, setOriginal] = useState<DeviceSettings | null>(null);
  const [form, setForm] = useState<DeviceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await attendanceDeviceApi.getSettings({ silent: true });
      const normalized = normalizeSettings(s);
      setOriginal(normalized);
      setForm(normalized);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => !!form && !!original && !sameSettings(form, original), [form, original]);

  const set = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const validate = (f: DeviceSettings): Errors => {
    const e: Errors = {};
    (["student_start_time", "teacher_start_time", "absent_cutoff_time", "checkout_after_time"] as const).forEach((k) => {
      if (!TIME_RE.test(f[k] || "")) e[k] = t.timeInvalid;
    });
    const grace = Number(f.late_grace_minutes);
    if (!Number.isInteger(grace) || grace < 0 || grace > 180) e.late_grace_minutes = t.late.graceInvalid;
    const mins = Number(f.offline_alert_minutes);
    if (!Number.isInteger(mins) || mins < 5 || mins > 1440) e.offline_alert_minutes = t.offline.minutesInvalid;
    const pin = Number(f.pin_start);
    if (!Number.isInteger(pin) || pin < 1 || pin > 99_999_999) e.pin_start = t.pin.invalid;
    const phone = (f.alert_phone || "").replace(/[\s-]/g, "");
    if (phone && !PHONE_RE.test(phone)) e.alert_phone = t.offline.phoneInvalid;
    return e;
  };

  const save = async () => {
    if (!form) return;
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const phone = (form.alert_phone || "").replace(/[\s-]/g, "");
      const saved = await attendanceDeviceApi.updateSettings({
        ...form,
        late_grace_minutes: Number(form.late_grace_minutes),
        offline_alert_minutes: Number(form.offline_alert_minutes),
        pin_start: Number(form.pin_start),
        alert_phone: phone || null,
        weekly_off_days: [...new Set(form.weekly_off_days)].sort(),
      });
      const normalized = normalizeSettings(saved, form.weekly_off_days);
      setOriginal(normalized);
      setForm(normalized);
      useToastStore.getState().show(getText(deviceSettingsText).saved, "success");
    } catch (err) {
      useToastStore.getState().show(getApiErrorMessage(err, getText(deviceSettingsText).saveFailed), "error");
    } finally {
      setSaving(false);
    }
  };

  const convertPins = () => {
    const tp = getText(deviceSettingsText).pin;
    useConfirmStore.getState().show({
      title: tp.convertTitle,
      message: tp.convertMessage,
      confirmText: tp.convertConfirm,
      onConfirm: async () => {
        setConverting(true);
        try {
          const r = await attendanceDeviceApi.convertPins();
          useToastStore
            .getState()
            .show(tp.converted(localizeDigits(r?.changed ?? 0, lang), localizeDigits(r?.skipped ?? 0, lang)), "success");
        } catch (err) {
          useToastStore.getState().show(getApiErrorMessage(err, tp.convertFailed), "error");
        } finally {
          setConverting(false);
        }
      },
    });
  };

  const toggleDay = (day: number) => {
    if (!form) return;
    const has = form.weekly_off_days.includes(day);
    set(
      "weekly_off_days",
      has ? form.weekly_off_days.filter((d) => d !== day) : [...form.weekly_off_days, day].sort(),
    );
  };

  const numInput = (key: "late_grace_minutes" | "offline_alert_minutes" | "pin_start") => ({
    type: "number" as const,
    inputMode: "numeric" as const,
    value: form ? String(form[key] ?? "") : "",
    invalid: !!errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, (e.target.value === "" ? "" : Number(e.target.value)) as unknown as number),
  });

  const timeInput = (key: "student_start_time" | "teacher_start_time" | "absent_cutoff_time" | "checkout_after_time") => ({
    type: "time" as const,
    value: form?.[key] ?? "",
    invalid: !!errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          form && (
            <Button onClick={save} disabled={!dirty || saving} className="gap-1.5">
              <Save size={15} />
              {saving ? t.saving : t.save}
            </Button>
          )
        }
      />

      {loading && !form ? (
        <SkeletonList items={5} />
      ) : loadError || !form ? (
        <ErrorState title={t.loadFailed} message={t.tryAgainDot} onRetry={load} retryText={t.retry} />
      ) : (
        <>
          <SectionCard
            title={t.late.title}
            hint={t.late.hint}
            toggle={{ checked: form.late_enabled, onChange: (v) => set("late_enabled", v) }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.late.studentStart} error={errors.student_start_time}>
                <Input {...timeInput("student_start_time")} />
              </Field>
              <Field label={t.late.teacherStart} error={errors.teacher_start_time}>
                <Input {...timeInput("teacher_start_time")} />
              </Field>
              <Field label={t.late.grace} error={errors.late_grace_minutes}>
                <Input {...numInput("late_grace_minutes")} min={0} max={180} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title={t.absent.title}
            hint={t.absent.hint}
            toggle={{ checked: form.auto_absent_enabled, onChange: (v) => set("auto_absent_enabled", v) }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.absent.cutoff} error={errors.absent_cutoff_time}>
                <Input {...timeInput("absent_cutoff_time")} />
              </Field>
            </div>
            <SmsHint text={t.absent.smsHint} />
          </SectionCard>

          <SectionCard
            title={t.checkout.title}
            hint={t.checkout.hint}
            toggle={{ checked: form.checkout_enabled, onChange: (v) => set("checkout_enabled", v) }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.checkout.after} error={errors.checkout_after_time}>
                <Input {...timeInput("checkout_after_time")} />
              </Field>
            </div>
            <SmsHint text={t.checkout.smsHint} />
          </SectionCard>

          <SectionCard title={t.weekly.title} hint={t.weekly.hint}>
            <div className="flex flex-wrap gap-2">
              {t.weekly.days.map((label, day) => {
                const on = form.weekly_off_days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(day)}
                    className={`h-10 min-w-[72px] rounded-xl border px-3 text-sm font-semibold transition ${
                      on
                        ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <HolidaysSection />

          <SectionCard
            title={t.offline.title}
            hint={t.offline.hint}
            toggle={{ checked: form.offline_alert_enabled, onChange: (v) => set("offline_alert_enabled", v) }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.offline.minutes} error={errors.offline_alert_minutes}>
                <Input {...numInput("offline_alert_minutes")} min={5} max={1440} />
              </Field>
              <Field label={t.offline.phone} error={errors.alert_phone} hint={t.offline.phoneHint}>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.alert_phone ?? ""}
                  invalid={!!errors.alert_phone}
                  placeholder={t.offline.phonePlaceholder}
                  onChange={(e) => set("alert_phone", e.target.value)}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title={t.clock.title}
            hint={t.clock.hint}
            toggle={{ checked: form.auto_time_sync, onChange: (v) => set("auto_time_sync", v) }}
          >
            <span />
          </SectionCard>

          <SectionCard title={t.pin.title} hint={t.pin.hint}>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["registration", t.pin.modeRegistration, t.pin.modeRegistrationHint],
                  ["auto", t.pin.modeAuto, t.pin.modeAutoHint],
                ] as const
              ).map(([mode, label, hint]) => (
                <label
                  key={mode}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                    form.pin_mode === mode
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="pin_mode"
                    className="mt-1 accent-emerald-600"
                    checked={form.pin_mode === mode}
                    onChange={() => set("pin_mode", mode)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label={t.pin.label} error={errors.pin_start} hint={t.pin.labelHint}>
                <Input {...numInput("pin_start")} min={1} max={99_999_999} />
              </Field>
            </div>

            {!!form.pin_warnings?.length && (
              <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {form.pin_warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            )}

            {original?.pin_mode === "registration" && (
              <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.pin.convertHint}</p>
                <Button
                  variant="secondary"
                  onClick={convertPins}
                  disabled={dirty || converting}
                  title={dirty ? t.pin.convertSaveFirst : undefined}
                  className="shrink-0 gap-1.5"
                >
                  <RefreshCw size={14} className={converting ? "animate-spin" : ""} />
                  {t.pin.convert}
                </Button>
              </div>
            )}
          </SectionCard>
        </>
      )}

      {/* Sticky save bar while there are unsaved changes (mobile friendly). */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{t.unsaved}</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => original && (setForm(original), setErrors({}))} disabled={saving}>
                {t.discard}
              </Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">
                <Save size={15} />
                {saving ? t.saving : t.save}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- dated holidays ---------------- */

function HolidaysSection() {
  const t = useText(deviceSettingsText).holidays;
  const lang = useLang();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [items, setItems] = useState<AttendanceHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      setItems(await attendanceDeviceApi.listHolidays(y, { silent: true }));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(year);
  }, [load, year]);

  const add = async () => {
    if (!date) return setFormError(t.dateRequired);
    if (!title.trim()) return setFormError(t.nameRequired);
    setAdding(true);
    setFormError("");
    try {
      const created = await attendanceDeviceApi.addHoliday({ date, title: title.trim() });
      if (Number(date.slice(0, 4)) === year) {
        setItems((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      } else {
        setYear(Number(date.slice(0, 4)));
      }
      setDate("");
      setTitle("");
      useToastStore.getState().show(getText(deviceSettingsText).holidays.added, "success");
    } catch (err) {
      setFormError(getApiErrorMessage(err, t.addFailed));
    } finally {
      setAdding(false);
    }
  };

  const remove = (h: AttendanceHoliday) => {
    useConfirmStore.getState().show({
      title: t.deleteTitle,
      message: t.deleteMessage(h.title, formatDate(`${h.date}T00:00:00`, lang, HOLIDAY_DATE)),
      confirmText: t.deleteConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          await attendanceDeviceApi.removeHoliday(h.id);
          setItems((prev) => prev.filter((x) => x.id !== h.id));
          useToastStore.getState().show(getText(deviceSettingsText).holidays.deleted, "success");
        } catch {
          // interceptor toast
        }
      },
    });
  };

  const years = [thisYear - 1, thisYear, thisYear + 1];
  if (!years.includes(year)) years.push(year);

  return (
    <SectionCard
      title={t.title}
      hint={t.hint}
      badge={!loading && !error ? t.count(localizeDigits(items.length, lang)) : undefined}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-[120px_170px_1fr_auto] sm:items-end">
        <div>
          <label className={inputLabelClass}>{t.year}</label>
          <select className={selectClass} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.sort().map((y) => (
              <option key={y} value={y}>
                {localizeDigits(y, lang)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={inputLabelClass}>{t.date}</label>
          <Input type="date" value={date} onChange={(e) => (setDate(e.target.value), setFormError(""))} />
        </div>
        <div>
          <label className={inputLabelClass}>{t.name}</label>
          <Input
            value={title}
            placeholder={t.namePlaceholder}
            onChange={(e) => (setTitle(e.target.value), setFormError(""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
        </div>
        <Button onClick={add} disabled={adding} className="gap-1.5">
          <CalendarPlus size={15} />
          {adding ? t.adding : t.add}
        </Button>
      </div>
      {formError && <p className="-mt-2 mb-3 text-xs text-rose-600 dark:text-rose-400">{formError}</p>}

      {loading ? (
        <SkeletonList items={2} />
      ) : error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{t.loadFailed}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
          {items.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{h.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(`${h.date}T00:00:00`, lang, HOLIDAY_DATE)}</div>
              </div>
              <button
                type="button"
                onClick={() => remove(h)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                title={t.deleteConfirm}
                aria-label={t.deleteConfirm}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
