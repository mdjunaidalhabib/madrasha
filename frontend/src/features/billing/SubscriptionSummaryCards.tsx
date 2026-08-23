import { type BillingChannel, type SubscriptionSummaryDto } from "../../services/billingApi";
import { SkeletonCard } from "../../components/ui/Skeleton";

const CHANNEL_LABELS: Record<BillingChannel, string> = { SMS: "SMS", EMAIL: "ইমেইল" };

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("bn-BD") : "—";

interface SubscriptionCardProps {
  channel: BillingChannel;
  subscription?: SubscriptionSummaryDto;
  onBuyClick: (channel: BillingChannel) => void;
}

const SubscriptionCard = ({ channel, subscription, onBuyClick }: SubscriptionCardProps) => {
  const label = CHANNEL_LABELS[channel];

  if (!subscription || !subscription.active) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400">{label}</h3>
        <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
          {label} প্যাকেজ সক্রিয় নেই
        </p>
        <button
          type="button"
          onClick={() => onBuyClick(channel)}
          className="mt-3 h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          প্যাকেজ কিনুন
        </button>
      </div>
    );
  }

  const usedPct = subscription.totalCredit > 0
    ? Math.min(100, Math.round((subscription.usedCredit / subscription.totalCredit) * 100))
    : 0;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400">{label}</h3>
          <p className="mt-0.5 text-base font-bold text-gray-800 dark:text-slate-100">
            {subscription.packageName}
          </p>
        </div>
        {subscription.isLowCredit && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            {label} কম আছে
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full ${subscription.isLowCredit ? "bg-amber-500" : "bg-blue-600"}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
          ব্যবহৃত হয়েছে {subscription.usedCredit.toLocaleString("bn-BD")} / মোট{" "}
          {subscription.totalCredit.toLocaleString("bn-BD")} টি {label}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400">অবশিষ্ট আছে</p>
          <p
            className={`text-2xl font-extrabold ${
              subscription.isLowCredit ? "text-amber-600 dark:text-amber-400" : "text-gray-800 dark:text-slate-100"
            }`}
          >
            {subscription.remainingCredit.toLocaleString("bn-BD")}{" "}
            <span className="text-sm font-semibold">টি {label}</span>
          </p>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          মেয়াদ: {formatDate(subscription.expiryDate)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onBuyClick(channel)}
        className="mt-3 h-8 rounded-md bg-gray-100 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        আরও কিনুন
      </button>
    </div>
  );
};

interface SubscriptionSummaryCardsProps {
  subscriptions: SubscriptionSummaryDto[];
  loading: boolean;
  onBuyClick: (channel: BillingChannel) => void;
}

const SubscriptionSummaryCards = ({ subscriptions, loading, onBuyClick }: SubscriptionSummaryCardsProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  const smsSubscription = subscriptions.find((s) => s.channel === "SMS");
  const emailSubscription = subscriptions.find((s) => s.channel === "EMAIL");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SubscriptionCard channel="SMS" subscription={smsSubscription} onBuyClick={onBuyClick} />
      <SubscriptionCard channel="EMAIL" subscription={emailSubscription} onBuyClick={onBuyClick} />
    </div>
  );
};

export default SubscriptionSummaryCards;
