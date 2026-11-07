import { useEffect, useState } from "react";
import { CheckCircle2, GraduationCap, ShieldCheck, XCircle } from "lucide-react";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import PlanCard, { type PlanCardData } from "@madrasha/shared-ui/src/components/plans/PlanCard";
import Badge from "@madrasha/shared-ui/src/components/ui/Badge";
import { formatDate, formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import SectionCard from "../../../components/settings/SectionCard";
import { getPlanAppearance, isPlanSuspended, type MyPlan } from "../../../services/planApi";
import { usePlanStore } from "../../../store/planStore";
import {
  OverLimitNotice,
  PlanContact,
  PlanExpiryNotice,
} from "../../../components/plans/PlanNotices";
import PlanRenewalBanner from "../../../components/plans/PlanRenewalBanner";
import VendorPromoCard from "../../vendor/VendorPromoCard";
import { planText } from "./settingsPages.text";

function StudentUsage({ plan }: { plan: MyPlan }) {
  const t = useText(planText);
  const lang = useLang();
  const ratio =
    plan.student_limit > 0
      ? plan.usage.students / plan.student_limit
      : plan.usage.students > 0
        ? 1
        : 0;
  const percent = Math.min(100, Math.max(0, ratio * 100));
  return (
    <SectionCard title={t.studentUsage} hint={t.usageNote}>
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <GraduationCap size={20} aria-hidden="true" />
        {t.usageValue(
          formatNumber(plan.usage.students, lang),
          formatNumber(plan.student_limit, lang),
        )}
      </p>
      <div
        role="progressbar"
        aria-label={t.studentUsage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          className={`h-full rounded-full ${ratio >= 0.9 ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="my-3 text-sm text-slate-500 dark:text-slate-400">{t.unlimitedUsers}</p>
      <OverLimitNotice plan={plan} />
    </SectionCard>
  );
}

export default function PlanSettingsPage({
  suspended = false,
  onRefresh,
}: { suspended?: boolean; onRefresh?: () => void } = {}) {
  const plan = usePlanStore((s) => s.plan);
  const block = usePlanStore((s) => s.block);
  const [appearance, setAppearance] = useState<Partial<PlanCardData> | null>(null);
  const t = useText(planText);
  const lang = useLang();
  const planName = plan?.plan_name;

  useEffect(() => {
    setAppearance(null);
    if (!planName) return;
    const controller = new AbortController();
    void getPlanAppearance(planName, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setAppearance(value);
      })
      .catch(() => {
        /* Hidden plans use the shared card palette. */
      });
    return () => controller.abort();
  }, [planName]);

  const money = (amount: number | null | undefined) =>
    amount == null ? t.negotiated : `৳${formatNumber(amount, lang)}`;
  const date = (value: string | null | undefined) =>
    value ? formatDate(value, lang, { day: "numeric", month: "long", year: "numeric" }) : "—";
  if (!plan)
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title={block ? t.expiredTitle : t.title} />
        <p>{t.loadFailed}</p>
        {block && <PlanExpiryNotice plan={null} />}
        {onRefresh && (
          <button className="rounded-xl border px-4 py-2 dark:border-slate-600" onClick={onRefresh}>
            {t.retry}
          </button>
        )}
        <PlanContact plan={null} />
      </div>
    );

  const blocked = suspended || !!block || isPlanSuspended(plan);
  const expired =
    plan.days_since_expiry != null ||
    plan.plan_status === "expired" ||
    (plan.days_remaining !== null && plan.days_remaining < 0);
  const status = blocked ? (expired ? "expired" : "suspended") : plan.plan_status;
  const daysLabel =
    plan.days_remaining === null
      ? "—"
      : plan.days_remaining < 0
        ? t.expiredAlready
        : plan.days_remaining === 0
          ? t.expiresToday
          : t.daysLeft(formatNumber(plan.days_remaining, lang));
  const progress =
    plan.days_remaining === null || !plan.duration_days
      ? 0
      : Math.max(0, Math.min(100, ((plan.days_remaining + 1) / plan.duration_days) * 100));
  const tone = blocked
    ? "red"
    : plan.over_limit || (plan.days_remaining !== null && plan.days_remaining <= 7)
      ? "yellow"
      : "green";
  const renewal = (
    <SectionCard title={t.nextRenewal} hint={t.nextRenewalHint}>
      <p className="text-2xl font-bold">{money(plan.next_renewal_price)}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {t.endDate}: {date(plan.end_date)}
      </p>
    </SectionCard>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title={blocked ? (expired ? t.expiredTitle : t.suspendedTitle) : t.title}
        subtitle={blocked ? t.expiredBody : t.subtitle}
      />
      {blocked && <PlanExpiryNotice plan={plan} />}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PlanCard
          preview
          ctaLabel={t.currentPlan}
          plan={{
            ...appearance,
            name: plan.plan_name || t.noPlan,
            nameBn: plan.plan_name_bn,
            studentLimit: plan.student_limit,
            price: plan.price,
            renewalPrice: plan.renewal_price,
            accentColor: plan.accent_color ?? appearance?.accentColor,
            sortOrder: plan.sort_order ?? appearance?.sortOrder,
          }}
        />
        <SectionCard
          title={t.validity}
          hint={
            plan.cycle === "RENEWAL"
              ? t.renewalCycle
              : plan.cycle === "FIRST"
                ? t.firstCycle
                : t.validityHint
          }
        >
          <Badge tone={tone}>{t.status[status]}</Badge>
          <dl className="my-5 grid grid-cols-2 gap-4 text-sm">
            {[
              [t.startDate, date(plan.start_date)],
              [t.endDate, date(plan.end_date)],
              [t.pricePaid, plan.price_paid == null ? t.notRecorded : money(plan.price_paid)],
              [t.state, daysLabel],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="mt-1 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div
            role="progressbar"
            aria-label={t.termProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <div
              className={`h-full rounded-full ${blocked ? "bg-rose-500" : "bg-emerald-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </SectionCard>
      </div>
      {blocked ? (
        <>
          {renewal}
          <PlanContact plan={plan} />
        </>
      ) : (
        <>
          <StudentUsage plan={plan} />
          {renewal}
          <div className="grid gap-6 md:grid-cols-2">
            {(["includes", "excludes"] as const).map((key) => (
              <SectionCard key={key} title={key === "includes" ? t.included : t.excluded}>
                <ul className="space-y-3">
                  {plan[key]?.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm leading-6">
                      {key === "includes" ? (
                        <CheckCircle2
                          size={18}
                          className="mt-1 shrink-0 text-emerald-600"
                          aria-hidden="true"
                        />
                      ) : (
                        <XCircle
                          size={18}
                          className="mt-1 shrink-0 text-slate-400"
                          aria-hidden="true"
                        />
                      )}
                      {item[lang]}
                    </li>
                  ))}
                </ul>
                {!plan[key]?.length && (
                  <p className="text-sm text-slate-500">{t.metadataMissing}</p>
                )}
              </SectionCard>
            ))}
          </div>
          <SectionCard title={t.domain}>
            {plan.custom_domain ? (
              <div className="space-y-3">
                <p className="break-all text-lg font-semibold" dir="ltr">
                  {plan.custom_domain.domain}
                </p>
                <Badge tone={plan.custom_domain.is_active ? "green" : "yellow"}>
                  {plan.custom_domain.is_active ? t.status.active : t.domainInactive}
                </Badge>
                <p className="text-sm">
                  {t.endDate}: {date(plan.custom_domain.end_date)}
                </p>
                {!plan.custom_domain.is_active && (
                  <p className="text-sm text-slate-500">{t.domainRetained}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p>{t.domainOffer}</p>
                {plan.custom_domain_prices && (
                  <p className="text-sm">
                    {t.domainPrices(
                      money(plan.custom_domain_prices.firstYear),
                      money(plan.custom_domain_prices.renewal),
                    )}
                  </p>
                )}
                <PlanContact plan={plan} />
              </div>
            )}
          </SectionCard>
          <SectionCard title={t.payments}>
            {plan.payments?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b dark:border-slate-700">
                      {[t.date, t.amount, t.method, t.state].map((label) => (
                        <th key={label} className="whitespace-nowrap px-3 py-3 font-semibold">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.payments.slice(0, 10).map((payment, index) => (
                      <tr key={index} className="border-b last:border-0 dark:border-slate-800">
                        <td className="whitespace-nowrap px-3 py-3">{date(payment.date)}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {payment.amount == null ? t.notRecorded : money(payment.amount)}
                        </td>
                        <td className="px-3 py-3">
                          {payment.method?.toLowerCase() === "manual"
                            ? t.manual
                            : payment.method || t.manual}
                        </td>
                        <td className="px-3 py-3">
                          {payment.status?.toLowerCase() === "paid"
                            ? t.paid
                            : payment.status?.toLowerCase() === "pending"
                              ? t.pending
                              : payment.status?.toLowerCase() === "failed"
                                ? t.failed
                                : payment.status || t.notRecorded}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t.noPayments}</p>
            )}
          </SectionCard>
          {/* DECISION: refund eligibility comes from the first purchase only. Tenant users contact support; cancellation/refund remain owner actions. */}
          {plan.refund?.eligible && plan.refund.until && (
            <SectionCard title={t.refundTitle}>
              <p className="flex items-start gap-2 text-sm leading-7">
                <ShieldCheck
                  size={20}
                  className="mt-1 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                {t.refundUntil(date(plan.refund.until))}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
                {t.refundBody}
              </p>
            </SectionCard>
          )}
          <PlanRenewalBanner showOverLimit={false} />
          <PlanContact plan={plan} />
          <VendorPromoCard />
        </>
      )}
    </div>
  );
}
