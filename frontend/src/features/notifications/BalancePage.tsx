import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { notificationApi } from "../../services/phase4Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";

type CheckState = {
  loading: boolean;
  checked: boolean;
  success: boolean;
  balance?: number | string;
  raw?: string;
  errorMessage?: string;
};

const INITIAL_STATE: CheckState = { loading: false, checked: false, success: false };

function BalanceCard({
  title,
  description,
  actionLabel,
  channel,
}: {
  title: string;
  description: string;
  actionLabel: string;
  channel: "SMS" | "EMAIL";
}) {
  const toast = useToastStore((s) => s.show);
  const [state, setState] = useState<CheckState>(INITIAL_STATE);

  const check = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await notificationApi.checkBalance(channel);
      const data = res.data.data;
      setState({
        loading: false,
        checked: true,
        success: data.success,
        balance: data.balance,
        raw: data.raw,
        errorMessage: data.errorMessage,
      });
      if (!data.success) toast(data.errorMessage || "চেক করা যায়নি", "error");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "চেক করা যায়নি";
      logger.error(`CHECK ${channel} BALANCE ERROR:`, err);
      setState({ loading: false, checked: true, success: false, errorMessage: msg });
      toast(msg, "error");
    }
  };

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      {state.checked && (
        <div
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            state.success
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          }`}
        >
          {state.success ? (
            channel === "SMS" ? (
              state.balance !== undefined ? (
                <>ব্যালেন্স: <span className="font-bold">{String(state.balance)}</span></>
              ) : state.raw ? (
                <>গেটওয়ে সাড়া দিয়েছে: {state.raw}</>
              ) : (
                "গেটওয়ে সংযুক্ত আছে"
              )
            ) : (
              "SMTP সংযোগ সফল — Email পাঠানো যাবে"
            )
          ) : (
            state.errorMessage || "চেক করা যায়নি"
          )}
        </div>
      )}

      <button
        type="button"
        onClick={check}
        disabled={state.loading}
        className="flex h-9 items-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
      >
        <RefreshCw size={14} className={state.loading ? "animate-spin" : ""} />
        {state.loading ? "চেক হচ্ছে..." : actionLabel}
      </button>
    </div>
  );
}

const BalancePage = () => (
  <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
          SMS/Email ব্যালেন্স
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          গেটওয়ে অ্যাকাউন্ট Super Admin থেকে কনফিগার করা হয় — এখান থেকে শুধু বর্তমান অবস্থা যাচাই করা যাবে।
        </p>
      </div>

      <BalanceCard
        title="SMS ব্যালেন্স"
        description="SMS গেটওয়ে অ্যাকাউন্টে বর্তমানে কত ব্যালেন্স আছে তা যাচাই করুন।"
        actionLabel="ব্যালেন্স চেক করুন"
        channel="SMS"
      />
      <BalanceCard
        title="Email (SMTP) অবস্থা"
        description="Email পাঠানোর SMTP সংযোগ ঠিকভাবে কাজ করছে কিনা যাচাই করুন।"
        actionLabel="সংযোগ চেক করুন"
        channel="EMAIL"
      />
    </div>
  </div>
);

export default BalancePage;
