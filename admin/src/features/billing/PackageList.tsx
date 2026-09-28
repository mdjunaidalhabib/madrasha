import { useEffect, useState } from "react";
import { billingApi, type BillingChannel, type MessagePackage } from "../../services/billingApi";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import PurchaseRequestModal from "./PurchaseRequestModal";
import { useLang, useText, formatNumber } from "@madrasha/shared-ui/src/i18n";
import { billingText } from "./billing.text";

interface PackageListProps {
  channel: BillingChannel;
  onChannelChange: (channel: BillingChannel) => void;
  onPurchased: () => void;
}

const PackageList = ({ channel, onChannelChange, onPurchased }: PackageListProps) => {
  const tx = useText(billingText);
  const lang = useLang();
  const [packages, setPackages] = useState<MessagePackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<MessagePackage | null>(null);

  useEffect(() => {
    setLoading(true);
    billingApi
      .getPackages(channel)
      .then((res) => setPackages(res.data.data || []))
      .catch((err) => {
        logger.error("LOAD PACKAGES ERROR:", err);
        setPackages([]);
      })
      .finally(() => setLoading(false));
  }, [channel]);

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => onChannelChange("SMS")}
          className={`h-9 rounded-md px-4 text-sm font-medium transition ${
            channel === "SMS" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          SMS
        </button>
        <button
          type="button"
          onClick={() => onChannelChange("EMAIL")}
          className={`h-9 rounded-md px-4 text-sm font-medium transition ${
            channel === "EMAIL" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {tx.email}
        </button>
      </div>

      {loading ? (
        <SkeletonList items={3} />
      ) : packages.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">{tx.noPackages}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-col justify-between rounded-lg border border-gray-200 p-3 dark:border-slate-700"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-800 dark:text-slate-100">{pkg.name}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      pkg.type === "RECHARGE"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                    }`}
                  >
                    {pkg.type === "RECHARGE" ? tx.recharge : tx.packageBadge}
                  </span>
                </div>
                {pkg.description && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{pkg.description}</p>
                )}
                <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                  {tx.creditCount(formatNumber(pkg.credit, lang), channel === "SMS" ? "SMS" : tx.email)}
                  {pkg.type === "PACKAGE" && ` · ${tx.validity(formatNumber(pkg.validityDays, lang))}`}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-800 dark:text-slate-100">
                  ৳{formatNumber(Number(pkg.price), lang)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPackage(pkg)}
                className="mt-3 h-9 w-full rounded-md bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                {tx.buy}
              </button>
            </div>
          ))}
        </div>
      )}

      <PurchaseRequestModal
        pkg={selectedPackage}
        onClose={() => setSelectedPackage(null)}
        onSuccess={onPurchased}
      />
    </div>
  );
};

export default PackageList;
