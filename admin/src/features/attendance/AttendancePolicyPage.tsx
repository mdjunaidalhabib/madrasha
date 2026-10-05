import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Lock, Save } from "lucide-react";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { getText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import SectionCard from "../../components/settings/SectionCard";
import { attendanceApi, type AttendancePolicy, type LeaveMode } from "../../services/phase1Api";
import { attendanceText } from "./attendance.text";
import { apiErrorMessage, useAttendancePermissions } from "./attendanceUtils";

type NumKey = "edit_window_days" | "late_to_absent_count" | "low_attendance_percent" | "consecutive_absent_days";
type Form = Omit<AttendancePolicy, NumKey> & Record<NumKey, number | "">;
type Errors = Partial<Record<NumKey, string>>;

const DEFAULTS: AttendancePolicy = {
  edit_window_days: 0,
  late_to_absent_count: 0,
  leave_mode: "excluded",
  low_attendance_percent: 75,
  consecutive_absent_days: 0,
  payroll_deduct_absent: false,
};

const RANGES: Record<NumKey, [number, number]> = {
  edit_window_days: [0, 365],
  late_to_absent_count: [0, 31],
  low_attendance_percent: [0, 100],
  consecutive_absent_days: [0, 30],
};

const LEAVE_MODES: LeaveMode[] = ["excluded", "present", "absent"];

const normalize = (p: Partial<AttendancePolicy> | null | undefined): AttendancePolicy => ({
  ...DEFAULTS,
  ...(p || {}),
  leave_mode: LEAVE_MODES.includes(p?.leave_mode as LeaveMode) ? (p!.leave_mode as LeaveMode) : DEFAULTS.leave_mode,
  payroll_deduct_absent: !!p?.payroll_deduct_absent,
});

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}

/**
 * উপস্থিতি নীতি - edit window, late rule, leave handling, low-attendance
 * threshold, consecutive-absence alert and payroll deduction. Weekly off days
 * and holidays live in device settings (linked).
 */
export default function AttendancePolicyPage() {
  const lang = useLang();
  const tx = useText(attendanceText);
  const t = tx.policy;
  const { canPolicy } = useAttendancePermissions();

  const [original, setOriginal] = useState<AttendancePolicy | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = normalize(await attendanceApi.getPolicy());
      setOriginal(p);
      setForm(p);
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

  const dirty = useMemo(
    () => !!form && !!original && JSON.stringify(form) !== JSON.stringify(original),
    [form, original],
  );

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    if (!canPolicy) return;
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key as NumKey];
      return next;
    });
  };

  const validate = (f: Form): Errors => {
    const e: Errors = {};
    (Object.keys(RANGES) as NumKey[]).forEach((k) => {
      const [min, max] = RANGES[k];
      const v = Number(f[k]);
      if (f[k] === "" || !Number.isInteger(v) || v < min || v > max) {
        e[k] = t.rangeError(localizeDigits(min, lang), localizeDigits(max, lang));
      }
    });
    const c = Number(f.consecutive_absent_days);
    if (!e.consecutive_absent_days && c === 1) e.consecutive_absent_days = t.consecutiveError;
    return e;
  };

  const save = async () => {
    if (!form || !canPolicy) return;
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const payload: AttendancePolicy = {
        ...form,
        edit_window_days: Number(form.edit_window_days),
        late_to_absent_count: Number(form.late_to_absent_count),
        low_attendance_percent: Number(form.low_attendance_percent),
        consecutive_absent_days: Number(form.consecutive_absent_days),
      };
      const saved = normalize((await attendanceApi.updatePolicy(payload)) || payload);
      setOriginal(saved);
      setForm(saved);
      useToastStore.getState().show(getText(attendanceText).policy.saved, "success");
    } catch (err) {
      const field = (err as any)?.response?.data?.errors?.field as NumKey | undefined;
      const msg = apiErrorMessage(err, getText(attendanceText).policy.saveFailed);
      if (field && field in RANGES) setErrors((prev) => ({ ...prev, [field]: msg }));
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const numInput = (key: NumKey) => ({
    type: "number" as const,
    inputMode: "numeric" as const,
    min: RANGES[key][0],
    max: RANGES[key][1],
    value: form ? String(form[key] ?? "") : "",
    invalid: !!errors[key],
    disabled: !canPolicy,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, e.target.value === "" ? "" : Number(e.target.value)),
  });

  const leaveLabels: Record<LeaveMode, [string, string]> = {
    excluded: [t.leave.excluded, t.leave.excludedHint],
    present: [t.leave.present, t.leave.presentHint],
    absent: [t.leave.absent, t.leave.absentHint],
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          form &&
          canPolicy && (
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
        <ErrorState title={t.loadFailed} message={t.tryAgain} onRetry={load} retryText={t.retry} />
      ) : (
        <>
          {!canPolicy && (
            <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <Lock size={15} className="shrink-0" />
              {t.readOnly}
            </p>
          )}

          <SectionCard title={t.edit.title} hint={t.edit.hint}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.edit.label} error={errors.edit_window_days} hint={t.edit.help}>
                <Input {...numInput("edit_window_days")} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title={t.late.title} hint={t.late.hint}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.late.label} error={errors.late_to_absent_count} hint={t.late.help}>
                <Input {...numInput("late_to_absent_count")} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title={t.leave.title} hint={t.leave.hint}>
            <div className="grid gap-2 sm:grid-cols-3">
              {LEAVE_MODES.map((mode) => {
                const [label, hint] = leaveLabels[mode];
                const on = form.leave_mode === mode;
                return (
                  <label
                    key={mode}
                    className={`flex gap-3 rounded-xl border p-3 transition ${canPolicy ? "cursor-pointer" : "cursor-default opacity-80"} ${
                      on
                        ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="leave_mode"
                      className="mt-1 accent-emerald-600"
                      checked={on}
                      disabled={!canPolicy}
                      onChange={() => set("leave_mode", mode)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title={t.low.title} hint={t.low.hint}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.low.label} error={errors.low_attendance_percent} hint={t.low.help}>
                <Input {...numInput("low_attendance_percent")} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title={t.consecutive.title} hint={t.consecutive.hint}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.consecutive.label} error={errors.consecutive_absent_days} hint={t.consecutive.help}>
                <Input {...numInput("consecutive_absent_days")} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title={t.payroll.title}
            hint={t.payroll.hint}
            toggle={{
              checked: form.payroll_deduct_absent,
              onChange: (v) => set("payroll_deduct_absent", v),
              disabled: !canPolicy,
            }}
          >
            <span />
          </SectionCard>

          <SectionCard title={t.calendar.title} hint={t.calendar.hint}>
            <Link
              to="/attendance/device-settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700"
            >
              <CalendarDays size={15} />
              {t.calendar.link}
            </Link>
          </SectionCard>
        </>
      )}

      {dirty && canPolicy && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{t.unsaved}</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => original && (setForm(original), setErrors({}))}
                disabled={saving}
              >
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
