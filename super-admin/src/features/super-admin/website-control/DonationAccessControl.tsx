import { useEffect, useState } from "react";
import { useLang } from "@madrasha/shared-ui/src/i18n";
import adminApi from "../../../services/adminApi";

export default function DonationAccessControl({ institutionId, disabled }: { institutionId: string; disabled: boolean }) {
  const lang = useLang();
  const tx = (bn: string, en: string) => lang === "bn" ? bn : en;
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let current = true;
    setAllowed(null); setError(""); setMessage("");
    if (!institutionId) return;
    adminApi.get(`/website/super/madrasas/${institutionId}/donations`)
      .then(({ data }) => { if (current) setAllowed(data.data.allowed); })
      .catch(() => { if (current) setError(tx("অনুমতির তথ্য আনা যায়নি।", "Unable to load donation access.")); });
    return () => { current = false; };
  }, [institutionId]);
  const toggle = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await adminApi.patch(`/website/super/madrasas/${institutionId}/donations`, { allowed: !allowed });
      setAllowed(data.data.allowed);
      setMessage(tx("অনুদানের অনুমতি সংরক্ষিত হয়েছে।", "Donation access saved."));
    } catch (err: any) { setError(err?.response?.data?.message || tx("অনুমতি সংরক্ষণ করা যায়নি।", "Unable to save access.")); }
    finally { setBusy(false); }
  };
  return <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5 dark:border-teal-900 dark:bg-teal-950/20">
    <h2 className="font-semibold dark:text-white">{tx("পাবলিক ওয়েবসাইটে অনুদান", "Public website donations")}</h2>
    <p className="my-2 text-sm leading-6 text-slate-500">{tx("ডিফল্টে বন্ধ। অনুমতি দিলে এই প্রতিষ্ঠান অনুদানের তথ্য ও পেমেন্ট মাধ্যম প্রকাশ করতে পারবে। অনুমতি তুলে নিলে পাবলিক সাইট থেকে সঙ্গে সঙ্গে লুকানো হবে।", "Disabled by default. Grant access so this institution can publish donation details and payment methods. Revoking access hides them from the public site.")}</p>
    <button type="button" role="switch" aria-checked={allowed === true} disabled={disabled || busy || allowed === null} onClick={toggle}
      className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${allowed ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-800"}`}>
      {busy ? tx("সংরক্ষণ হচ্ছে…", "Saving…") : allowed === null ? tx("লোড হচ্ছে…", "Loading…") : allowed ? tx("অনুমতি চালু", "Access enabled") : tx("অনুমতি বন্ধ", "Access disabled")}
    </button>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="mt-2 text-sm text-teal-700">{message}</p>}
  </div>;
}
