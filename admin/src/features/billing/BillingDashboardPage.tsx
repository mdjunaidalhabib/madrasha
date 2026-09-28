import { useCallback, useEffect, useRef, useState } from "react";
import { billingApi, type BillingChannel, type SubscriptionSummaryDto } from "../../services/billingApi";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import SubscriptionSummaryCards from "./SubscriptionSummaryCards";
import PackageList from "./PackageList";
import PurchaseRequestsTable, { type PurchaseRequestsTableHandle } from "./PurchaseRequestsTable";
import BillingHistoryTables from "./BillingHistoryTables";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { billingText } from "./billing.text";

type MainTab = "packages" | "requests" | "history";

const TABS: MainTab[] = ["packages", "requests", "history"];

const BillingDashboardPage = () => {
  const tx = useText(billingText);
  const [subscriptions, setSubscriptions] = useState<SubscriptionSummaryDto[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [tab, setTab] = useState<MainTab>("packages");
  const [packageChannel, setPackageChannel] = useState<BillingChannel>("SMS");
  const requestsTableRef = useRef<PurchaseRequestsTableHandle>(null);

  const loadSubscriptions = useCallback(() => {
    setLoadingSubscriptions(true);
    billingApi
      .getSubscriptions()
      .then((res) => setSubscriptions(res.data.data || []))
      .catch((err) => {
        logger.error("LOAD SUBSCRIPTIONS ERROR:", err);
        setSubscriptions([]);
      })
      .finally(() => setLoadingSubscriptions(false));
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleBuyClick = (channel: BillingChannel) => {
    setPackageChannel(channel);
    setTab("packages");
  };

  const handlePurchased = () => {
    loadSubscriptions();
    requestsTableRef.current?.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">{tx.pageTitle}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            {tx.pageSubtitle}
          </p>
        </div>

        <div className="mb-4">
          <SubscriptionSummaryCards
            subscriptions={subscriptions}
            loading={loadingSubscriptions}
            onBuyClick={handleBuyClick}
          />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`h-9 rounded-md px-4 text-sm font-medium transition ${
                tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {tx.tabs[t]}
            </button>
          ))}
        </div>

        {tab === "packages" && (
          <PackageList channel={packageChannel} onChannelChange={setPackageChannel} onPurchased={handlePurchased} />
        )}
        {tab === "requests" && (
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <PurchaseRequestsTable ref={requestsTableRef} />
          </div>
        )}
        {tab === "history" && <BillingHistoryTables />}
      </div>
    </div>
  );
};

export default BillingDashboardPage;
