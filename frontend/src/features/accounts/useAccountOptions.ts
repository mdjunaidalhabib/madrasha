import { useEffect, useState } from "react";
import { accountOptionsApi, type AccountOptions } from "../../services/accountFundApi";
import { logger } from "../../utils/logger";

const EMPTY_OPTIONS: AccountOptions = { incomeFunds: [], expenseGroups: [], paymentMethods: [] };

/** ফান্ড/খাত এখন DB-driven (settings > ফান্ড ও খাত সেটিংস থেকে ম্যানেজ করা যায়),
 * তাই আয়/ব্যয় ফর্ম ও লেনদেন ফিল্টার সবাই এই হুক দিয়ে `/accounts/options` থেকে
 * লাইভ ডেটা টানে - আগের মতো accountingData.ts এর স্ট্যাটিক লিস্ট আর ব্যবহার হয় না। */
export function useAccountOptions() {
  const [options, setOptions] = useState<AccountOptions>(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await accountOptionsApi.get();
        if (!cancelled) setOptions(res.data);
      } catch (err) {
        logger.error("Account options load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...options, loading };
}
