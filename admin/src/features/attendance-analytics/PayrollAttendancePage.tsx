import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, RefreshCw, RotateCcw, Wallet } from "lucide-react";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Badge from "@madrasha/shared-ui/src/components/ui/Badge";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import {
  formatCurrency,
  formatNumber,
  getText,
  localizeDigits,
  toAsciiDigits,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";

import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import {
  analyticsApi,
  currentMonth,
  type PayrollSummary,
  type PayrollSummaryRow,
} from "../../services/attendanceV3Api";
import { EmptyRow, Field, cardClass, fieldClass, tdClass, thClass } from "./shared";
import { attendanceAnalyticsText } from "./attendanceAnalytics.text";

type PayrollType = "TEACHER" | "STAFF";
type ApplyResult = { updated: number; skipped: Array<{ label: string; reason?: string }> };

const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/** "08:42", "08:42:10" or an ISO timestamp -> "08:42". */
const clockOf = (value: string | null | undefined) => {
  if (!value) return "";
  if (value.includes("T")) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
  }
  return value.slice(0, 5);
};

export default function PayrollAttendancePage() {
  const tx = useText(attendanceAnalyticsText);
  const t = tx.payroll;
  const lang = useLang();
  const n = (v: number) => formatNumber(v ?? 0, lang);
  const money = (v: number) => formatCurrency(round2(v), lang);

  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canApply = hasPermission(user, permissions, "payroll.manage");

  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState<PayrollType>("TEACHER");
  const [data, setData] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Per-row edited deduction (raw input text, keyed by attendee_id).
  const [edits, setEdits] = useState<Record<number, string>>({});

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await analyticsApi.payrollSummary({ month, attendee_type: type });
      setData(res);
      setEdits({});
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, type]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const isPending = (r: PayrollSummaryRow) => String(r.payroll?.status ?? "").toUpperCase() === "PENDING";
  const editable = (r: PayrollSummaryRow) => type === "TEACHER" && canApply && isPending(r);

  const deductionOf = (r: PayrollSummaryRow) => {
    const raw = edits[r.attendee_id];
    if (raw === undefined) return round2(r.suggested_deduction);
    const v = Number(toAsciiDigits(raw));
    return Number.isFinite(v) && v >= 0 ? round2(v) : 0;
  };

  const applicable = useMemo(() => (type === "TEACHER" ? rows.filter(isPending) : []), [rows, type]);
  const applyTotal = applicable.reduce((s, r) => s + deductionOf(r), 0);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          salary: acc.salary + (Number(r.salary) || 0),
          suggested: acc.suggested + (Number(r.suggested_deduction) || 0),
          absent: acc.absent + (r.absent || 0),
          late: acc.late + (r.late || 0),
          leave: acc.leave + (r.leave || 0),
        }),
        { salary: 0, suggested: 0, absent: 0, late: 0, leave: 0 },
      ),
    [rows],
  );

  const hours = (minutes: number) => {
    const m = Math.max(0, Math.round(minutes || 0));
    return t.hours(formatNumber(Math.floor(m / 60), lang), formatNumber(m % 60, lang));
  };

  const apply = async () => {
    const items = applicable.map((r) => ({ teacher_id: r.attendee_id, deduction: deductionOf(r) }));
    if (items.length === 0) {
      useToastStore.getState().show(getText(attendanceAnalyticsText).payroll.nothingToApply, "error");
      return;
    }
    setApplying(true);
    try {
      const res = await analyticsApi.payrollApply({ month, items });
      const nameOf = new Map(rows.map((r) => [r.attendee_id, r.name]));
      const reasons = getText(attendanceAnalyticsText).payroll.skipReasons as Record<string, string>;
      const skipped: ApplyResult["skipped"] =
        res.skipped_items.length > 0
          ? res.skipped_items.map((s) => ({
              label: nameOf.get(Number(s.teacher_id)) ?? `#${s.teacher_id}`,
              reason: reasons[s.reason] ?? s.reason,
            }))
          : Array.from({ length: res.skipped }, () => ({ label: "" }));
      setConfirmOpen(false);
      setResult({ updated: res.updated, skipped });
      await load();
    } catch {
      // interceptor toast
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Button variant="secondary" onClick={load} disabled={loading} title={t.load}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        }
      />

      <div className={`${cardClass} mb-4 flex flex-col gap-3 sm:flex-row sm:items-end`}>
        <Field label={t.month} className="sm:w-48">
          <input
            type="month"
            className={fieldClass}
            value={month}
            max={currentMonth()}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
          />
        </Field>
        <div className="sm:w-72">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t.type}</span>
          <div className="grid grid-cols-2 gap-2">
            {(["TEACHER", "STAFF"] as PayrollType[]).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setType(tp)}
                className={`h-10 rounded-lg text-sm font-medium transition ${
                  type === tp
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {tx.attendeeTypes[tp]}
              </button>
            ))}
          </div>
        </div>
        {data && (
          <div className="flex flex-wrap gap-2 text-xs sm:ms-auto">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {t.workingDays}: {n(data.working_days)}
            </span>
          </div>
        )}
      </div>

      {data && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
            data.deduct_absent
              ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
              : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
          }`}
        >
          <Info size={18} className="mt-0.5 shrink-0" />
          <span>{data.deduct_absent ? t.deductAbsentOn : t.deductAbsentOff}</span>
        </div>
      )}

      {loading && !data ? (
        <SkeletonTable rows={6} columns={8} />
      ) : error ? (
        <ErrorState message={t.loadFailed} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className={cardClass}>
          <EmptyRow text={t.empty} />
        </div>
      ) : (
        <>
          <div className={`${cardClass} overflow-x-auto !p-0 ${loading ? "opacity-60" : ""}`}>
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className={`${thClass} sticky start-0 bg-slate-50 dark:bg-slate-800`}>{t.name}</th>
                  <th className={`${thClass} text-end`}>{t.present}</th>
                  <th className={`${thClass} text-end`}>{t.absent}</th>
                  <th className={`${thClass} text-end`}>{t.late}</th>
                  <th className={`${thClass} text-end`}>{t.leave}</th>
                  <th className={`${thClass} text-end`}>{t.worked}</th>
                  <th className={`${thClass} text-end`}>{t.avgCheckIn}</th>
                  <th className={`${thClass} text-end`}>{t.suggested}</th>
                  <th className={`${thClass} min-w-[130px]`}>{t.deduction}</th>
                  <th className={thClass}>{t.payroll}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => {
                  const canEdit = editable(r);
                  const edited = edits[r.attendee_id] !== undefined && deductionOf(r) !== round2(r.suggested_deduction);
                  return (
                    <tr key={r.attendee_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className={`${tdClass} sticky start-0 bg-white dark:bg-slate-900`}>
                        <div className="font-medium">{r.name}</div>
                        {r.designation && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{r.designation}</div>
                        )}
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {t.salary}: {money(r.salary)} · {t.perDay(money(r.per_day_salary))}
                        </div>
                      </td>
                      <td className={`${tdClass} text-end tabular-nums`}>{n(r.present)}</td>
                      <td className={`${tdClass} text-end tabular-nums ${r.absent ? "font-semibold text-rose-600 dark:text-rose-400" : ""}`}>
                        {n(r.absent)}
                        {r.unmarked > 0 && (
                          <div className="text-[11px] font-normal text-slate-400" title={t.unmarked}>
                            +{n(r.unmarked)} {t.unmarked}
                          </div>
                        )}
                      </td>
                      <td className={`${tdClass} text-end tabular-nums`}>
                        {n(r.late)}
                        {r.late_penalty > 0 && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            {t.latePenalty(n(r.late_penalty))}
                          </div>
                        )}
                      </td>
                      <td className={`${tdClass} text-end tabular-nums`}>{n(r.leave)}</td>
                      <td className={`${tdClass} whitespace-nowrap text-end tabular-nums`}>{hours(r.worked_minutes)}</td>
                      <td className={`${tdClass} text-end tabular-nums`}>
                        {r.avg_check_in ? localizeDigits(clockOf(r.avg_check_in), lang) : "—"}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-end tabular-nums`}>{money(r.suggested_deduction)}</td>
                      <td className={tdClass}>
                        {canEdit ? (
                          <div className="flex items-center gap-1">
                            <input
                              inputMode="decimal"
                              className={`${fieldClass} h-9 w-28 text-end tabular-nums ${
                                edited ? "border-amber-400 dark:border-amber-600" : ""
                              }`}
                              value={edits[r.attendee_id] ?? String(round2(r.suggested_deduction))}
                              onChange={(e) =>
                                setEdits((prev) => ({ ...prev, [r.attendee_id]: e.target.value }))
                              }
                            />
                            {edited && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEdits((prev) => {
                                    const next = { ...prev };
                                    delete next[r.attendee_id];
                                    return next;
                                  })
                                }
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                                title={t.reset}
                                aria-label={t.reset}
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="tabular-nums text-slate-500">{money(r.suggested_deduction)}</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        {r.payroll ? (
                          <div className="space-y-0.5">
                            <Badge tone={isPending(r) ? "yellow" : "green"}>
                              {t.payrollStatus[String(r.payroll.status).toUpperCase()] ?? r.payroll.status}
                            </Badge>
                            <div className="whitespace-nowrap text-[11px] text-slate-400">
                              {t.currentDeduction(money(r.payroll.deductions))}
                            </div>
                            <div className="whitespace-nowrap text-[11px] text-slate-400">
                              {t.net(money(r.payroll.net_amount))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">{t.noPayroll}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <td className={`${tdClass} sticky start-0 bg-slate-50 font-semibold dark:bg-slate-800`}>
                    {t.totals}
                    <div className="text-xs font-normal text-slate-400">{money(totals.salary)}</div>
                  </td>
                  <td className={tdClass} />
                  <td className={`${tdClass} text-end font-semibold tabular-nums`}>{n(totals.absent)}</td>
                  <td className={`${tdClass} text-end font-semibold tabular-nums`}>{n(totals.late)}</td>
                  <td className={`${tdClass} text-end font-semibold tabular-nums`}>{n(totals.leave)}</td>
                  <td className={tdClass} />
                  <td className={tdClass} />
                  <td className={`${tdClass} whitespace-nowrap text-end font-semibold tabular-nums`}>{money(totals.suggested)}</td>
                  <td className={tdClass} colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {type === "STAFF" ? t.staffNoApply : canApply ? t.applyHint : t.noPermission}
            </p>
            {type === "TEACHER" && canApply && (
              <Button onClick={() => setConfirmOpen(true)} disabled={applicable.length === 0 || loading} className="h-10">
                <Wallet size={16} className="me-1.5" />
                {t.apply}
                {applicable.length > 0 && ` (${n(applicable.length)})`}
              </Button>
            )}
          </div>
        </>
      )}

      {confirmOpen && (
        <Modal open title={t.confirmTitle} onClose={applying ? () => undefined : () => setConfirmOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {t.confirmMessage(n(applicable.length), money(applyTotal))}
            </p>
            <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {applicable.map((r) => (
                <li key={r.attendee_id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate text-slate-700 dark:text-slate-200">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {money(r.payroll?.deductions ?? 0)} → <b className="text-slate-800 dark:text-slate-100">{money(deductionOf(r))}</b>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={applying}>
                {t.cancel}
              </Button>
              <Button onClick={apply} disabled={applying}>
                {applying ? t.applying : t.confirm}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {result && (
        <Modal open title={t.resultTitle} onClose={() => setResult(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 size={18} />
              {t.applied(n(result.updated))}
            </div>
            {result.skipped.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                  {t.skipped(n(result.skipped.length))}
                </p>
                {result.skipped.some((s) => s.label) && (
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600 dark:text-slate-300">
                    {result.skipped.map((s, i) => (
                      <li key={i}>
                        {s.label}
                        {s.reason ? <span className="text-xs text-slate-400"> - {s.reason}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setResult(null)}>
                {t.close}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
