import { useEffect, useState } from "react";
import { Crown, CalendarDays, Users, GraduationCap, ShieldCheck, PhoneCall } from "lucide-react";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import SectionCard from "../../../components/settings/SectionCard";
import Badge, { type BadgeTone } from "@madrasha/shared-ui/src/components/ui/Badge";
import { getMyPlan, type MyPlan } from "../../../services/planApi";
import { formatDate as formatLangDate, localizeDigits, useLang, useText, type Lang } from "@madrasha/shared-ui/src/i18n";
import { planText } from "./settingsPages.text";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import VendorPromoCard from "../../vendor/VendorPromoCard";

const formatDate = (value: string | null, lang: Lang) => {
  if (!value) return "-";
  return formatLangDate(value, lang, { day: "numeric", month: "long", year: "numeric" }) || "-";
};

function statusTone(plan: MyPlan): BadgeTone {
  if (!plan.has_active_subscription || plan.plan_status === "expired") return "red";
  if (plan.plan_status === "suspended") return "red";
  if (plan.plan_status === "trial") return "blue";
  if (plan.days_remaining !== null && plan.days_remaining <= 7) return "yellow";
  return "green";
}

function UsageBar({
  icon,
  label,
  used,
  limit,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
}) {
  const t = useText(planText);
  const lang = useLang();
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barTone =
    pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="rounded-xl border border-gray-100 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-200">
          {icon}
          {label}
        </div>
        <div className="text-sm text-gray-500 dark:text-slate-400">
          <span className="font-semibold text-gray-900 dark:text-slate-100">
            {localizeDigits(used, lang)}
          </span>{" "}
          / {localizeDigits(limit, lang)}
        </div>
      </div>
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${barTone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 100 && (
        <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {t.limitReached}
        </p>
      )}
    </div>
  );
}

export default function PlanSettingsPage() {
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useText(planText);
  const lang = useLang();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getMyPlan();
        setPlan(data);
      } catch {
        useToastStore.getState().show(t.loadFailed, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !plan) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={t.title} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  const daysLabel =
    plan.days_remaining === null
      ? null
      : plan.days_remaining < 0
        ? t.expiredAlready
        : plan.days_remaining === 0
          ? t.expiresToday
          : t.daysLeft(localizeDigits(plan.days_remaining, lang));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
      />

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-600 to-violet-700 shadow-sm dark:border-slate-700">
        <div className="flex flex-col gap-4 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <Crown size={24} />
            </span>
            <div>
              <p className="text-xs font-medium text-indigo-100">{t.currentPlan}</p>
              <p className="text-xl font-bold">{plan.plan_name || t.noPlan}</p>
              {plan.price !== null && (
                <p className="mt-0.5 text-sm text-indigo-100">
                  {t.pricePer(localizeDigits(plan.price, lang), localizeDigits(plan.duration_days || 0, lang))}
                </p>
              )}
            </div>
          </div>
          <Badge tone={statusTone(plan)} className="self-start bg-white/90 sm:self-center">
            {t.status[plan.plan_status]}
          </Badge>
        </div>
      </div>

      <SectionCard title={t.validity} hint={t.validityHint}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{t.startDate}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-900 dark:text-slate-100">
              <CalendarDays size={14} className="text-gray-400 dark:text-slate-500" />
              {formatDate(plan.start_date, lang)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{t.endDate}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-900 dark:text-slate-100">
              <CalendarDays size={14} className="text-gray-400 dark:text-slate-500" />
              {formatDate(plan.end_date, lang)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{t.state}</p>
            <p
              className={`mt-0.5 text-sm font-semibold ${
                statusTone(plan) === "red"
                  ? "text-rose-600 dark:text-rose-400"
                  : statusTone(plan) === "yellow"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {daysLabel || "-"}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t.usageLimits} hint={t.usageLimitsHint}>
        <div className="space-y-3">
          <UsageBar
            icon={<GraduationCap size={16} className="text-gray-400 dark:text-slate-500" />}
            label={t.studentLimit}
            used={plan.usage.students}
            limit={plan.student_limit}
          />
          <UsageBar
            icon={<Users size={16} className="text-gray-400 dark:text-slate-500" />}
            label={t.userLimit}
            used={plan.usage.users}
            limit={plan.user_limit}
          />
        </div>
      </SectionCard>

      <SectionCard title={t.changePlan}>
        <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <p>{t.changePlanBody}</p>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <PhoneCall size={14} className="text-gray-400 dark:text-slate-500" />
          {t.supportHint}
        </div>
      </SectionCard>

      <VendorPromoCard />
    </div>
  );
}
