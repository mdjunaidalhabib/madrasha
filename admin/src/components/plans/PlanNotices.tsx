import { Link } from "react-router-dom";
import { AlertTriangle, Mail, PhoneCall } from "lucide-react";
import { formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import type { MyPlan } from "../../services/planApi";
import { usePlanStore } from "../../store/planStore";
import { planText } from "../../features/admin/settings/settingsPages.text";

export function PlanContact({ plan }: { plan: MyPlan | null }) {
  const t = useText(planText);
  const contact = plan?.renewal_contact;
  const phone = (contact?.phone_intl || contact?.phone_display || "").replace(/[^+\d]/g, "");
  const publicSite = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {phone ? (
        <a
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          href={`tel:${phone}`}
        >
          <PhoneCall size={16} aria-hidden="true" />
          {t.renewalContact}
          <span className="text-xs font-normal" dir="ltr">
            {contact?.phone_display || phone}
          </span>
        </a>
      ) : publicSite ? (
        <a
          href={`${publicSite.replace(/\/$/, "")}/#demo`}
          className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white"
        >
          {t.publicContact}
        </a>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.supportHint}</p>
      )}
      {contact?.email && (
        <a
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm dark:border-slate-600"
          href={`mailto:${encodeURIComponent(contact.email)}`}
        >
          <Mail size={16} aria-hidden="true" />
          {t.emailContact}
        </a>
      )}
    </div>
  );
}

export function PlanExpiryNotice({ plan }: { plan: MyPlan | null }) {
  const t = useText(planText);
  const lang = useLang();
  const block = usePlanStore((s) => s.block);
  const days = plan?.retention_warning_days ?? block?.retentionWarningDays;
  const notice =
    days != null
      ? t.retentionNotice(formatNumber(days, lang))
      : plan?.retention_notice || block?.retentionNotice || block?.message || t.supportHint;
  return (
    <section
      className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
      aria-labelledby="plan-retention-heading"
    >
      <h2 id="plan-retention-heading" className="flex items-center gap-2 font-semibold">
        <AlertTriangle size={18} aria-hidden="true" />
        {t.retentionTitle}
      </h2>
      <p className="mt-3 text-sm leading-7">{notice}</p>
    </section>
  );
}

export function OverLimitNotice({ plan, compact = false }: { plan: MyPlan; compact?: boolean }) {
  const t = useText(planText);
  const lang = useLang();
  const over = plan.over_limit;
  if (!over) return null;
  const money = (amount: number) => `৳${formatNumber(amount, lang)}`;
  return (
    <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <h3 className="font-semibold">{t.overLimitTitle}</h3>
      <p>
        {t.overLimitBody(
          formatNumber(plan.usage.students, lang),
          formatNumber(plan.student_limit, lang),
          formatNumber(over.extra_students, lang),
          money(over.extra_charge),
        )}{" "}
        {over.upgrade_to &&
          t.upgradeOption(over.upgrade_to.plan_name, money(over.upgrade_to.charge))}
      </p>
      <p className="font-semibold">
        {over.recommended === "UPGRADE" ? t.cheaperUpgrade : t.cheaperExtra}
      </p>
      {compact && (
        <Link to="/settings/plan" className="font-semibold underline">
          {t.currentPlan}
        </Link>
      )}
    </aside>
  );
}
