import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useToastStore } from "../../store/toastStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Only populated outside production (see backend auth.service.ts) since
  // there is no email/SMS service wired up yet - lets the flow be tested
  // end-to-end without a mail provider.
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  const nav = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const handleSubmit = async () => {
    if (!email.trim()) {
      useToastStore.getState().show("ইমেইল দিন", "error");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/auth/forgot-password", { email: email.trim() });
      setSubmitted(true);
      setDevResetToken(res.data?.dev_reset_token || null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "অনুরোধ ব্যর্থ হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm space-y-4 rounded bg-white p-6 shadow dark:bg-slate-900">
        <h2 className="text-xl font-bold dark:text-slate-100">পাসওয়ার্ড ভুলে গেছেন?</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          আপনার অ্যাকাউন্টের ইমেইল দিন — একটা রিসেট লিংক পাঠানো হবে।
        </p>

        {submitted ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700 dark:text-green-400">
              যদি এই ইমেইলে অ্যাকাউন্ট থাকে, একটা পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।
            </p>

            {devResetToken && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                <p className="mb-1 font-medium">
                  ডেভ মোড (এখনো ইমেইল সার্ভিস সেটআপ করা হয়নি):
                </p>
                <button
                  type="button"
                  onClick={() =>
                    nav(`${adminBase}/reset-password?token=${devResetToken}`)
                  }
                  className="break-all text-left text-blue-600 underline dark:text-blue-400"
                >
                  রিসেট লিংকে যেতে ক্লিক করুন
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => nav(`${adminBase}/login`)}
              className="w-full text-center text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              লগইন পেজে ফিরে যান
            </button>
          </div>
        ) : (
          <>
            <Input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? "পাঠানো হচ্ছে..." : "রিসেট লিংক পাঠান"}
            </Button>
            <button
              type="button"
              onClick={() => nav(`${adminBase}/login`)}
              className="w-full text-center text-xs text-gray-500 hover:underline dark:text-slate-400"
            >
              লগইন পেজে ফিরে যান
            </button>
          </>
        )}
      </div>
    </div>
  );
}
