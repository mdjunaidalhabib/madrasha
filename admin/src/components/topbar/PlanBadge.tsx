import { Link } from "react-router-dom";
import { Crown } from "lucide-react";
import { usePlanStore } from "../../store/planStore";
import { localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { shellText } from "./shell.text";

const TONE_CLASSES: Record<"green" | "yellow" | "red", string> = {
  green:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
  yellow:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
};

// শুধু আইকন - প্ল্যানের বিস্তারিত (নাম, মেয়াদ) hover টাইটেলে; নেভবারে টেক্সট
// দেখানো হয় না, ক্লিক করলে প্ল্যান পেজে যায়।
export default function PlanBadge() {
  const plan = usePlanStore((s) => s.plan);
  const t = useText(shellText);
  const lang = useLang();
  if (!plan) return null;

  const expired = plan.plan_status === "expired" || plan.plan_status === "suspended" || !plan.has_active_subscription;
  const nearExpiry = !expired && plan.days_remaining !== null && plan.days_remaining <= 7;
  const tone: "green" | "yellow" | "red" = expired ? "red" : nearExpiry ? "yellow" : "green";

  const daysLabel =
    plan.days_remaining === null
      ? ""
      : plan.days_remaining < 0
        ? t.expired
        : plan.days_remaining === 0
          ? t.endsToday
          : t.daysLeft(localizeDigits(plan.days_remaining, lang));

  const statusLabel = plan.plan_status === "suspended" ? t.suspended : !plan.has_active_subscription ? t.noSubscription : "";

  return (
    <Link
      to={`/settings/plan`}
      title={`${t.planTitle(plan.plan_name || "")} ${statusLabel || daysLabel}`.trim()}
      aria-label={t.planStatus}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition hover:opacity-80 ${TONE_CLASSES[tone]}`}
    >
      <Crown size={15} className="shrink-0" />
    </Link>
  );
}
