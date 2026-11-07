import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { usePlanStore } from "../../store/planStore";
import { isPlanSuspended } from "../../services/planApi";
import { planText } from "../../features/admin/settings/settingsPages.text";
import { OverLimitNotice, PlanExpiryNotice } from "./PlanNotices";

export default function PlanRenewalBanner({ showOverLimit = true }: { showOverLimit?: boolean }) {
  const plan = usePlanStore((s) => s.plan);
  const t = useText(planText);
  const lang = useLang();
  if (!plan || isPlanSuspended(plan)) return null;
  const nearExpiry =
    plan.days_remaining !== null && plan.days_remaining >= 0 && plan.days_remaining <= 7;
  if (!nearExpiry && (!showOverLimit || !plan.over_limit)) return null;
  return (
    <div className="mb-5 space-y-3">
      {nearExpiry && (
        <aside className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="flex items-center gap-2">
            <CalendarClock size={18} className="shrink-0" aria-hidden="true" />
            {t.renewalBanner(
              formatNumber(plan.days_remaining!, lang),
              plan.next_renewal_price == null
                ? t.negotiated
                : `৳${formatNumber(plan.next_renewal_price, lang)}`,
            )}
          </p>
          <Link to="/settings/plan" className="font-semibold underline">
            {t.renewalContact}
          </Link>
        </aside>
      )}
      {nearExpiry && <PlanExpiryNotice plan={plan} />}
      {showOverLimit && <OverLimitNotice plan={plan} compact />}
    </div>
  );
}
