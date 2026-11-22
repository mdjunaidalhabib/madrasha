import { useState } from "react";
import { defineText, useText } from "@madrasha/shared-ui/src/i18n";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import api from "../../services/api";

export const guardianPasswordResetText = defineText({
  bn: {
    title: "অভিভাবকের পাসওয়ার্ড রিসেট",
    verifyTitle: "আগে কার্ড যাচাই করুন",
    verifyWarning: "অভিভাবকের কার্ড দেখে পরিচয় এবং শিক্ষার্থীর সঙ্গে সম্পর্ক মিলিয়ে নিন। কার্ড যাচাই না করে পাসওয়ার্ড রিসেট করবেন না।",
    cardVerified: "আমি কার্ড দেখে অভিভাবকের পরিচয় যাচাই করেছি।",
    continue: "যাচাই করেছি, এগিয়ে যান",
    finalTitle: "রিসেট নিশ্চিত করুন",
    doubleCheck: "কার্ড যাচাই করা হয়েছে এবং আমি পাসওয়ার্ড রিসেট নিশ্চিত করছি।",
    confirm: "রিসেট করলে অভিভাবক নিবন্ধিত মোবাইল নম্বরের শেষ ৪ ডিজিট দিয়ে লগইন করতে পারবেন। আগের পাসওয়ার্ড ও লগইন সেশন বাতিল হবে। একই অভিভাবকের সব সন্তানের জন্য এই পরিবর্তন প্রযোজ্য।",
    reset: "রিসেট করুন", busy: "রিসেট হচ্ছে…", cancel: "বাতিল", done: "বন্ধ করুন",
    success: "পাসওয়ার্ড রিসেট হয়েছে", phone: "নিবন্ধিত মোবাইল নম্বর", password: "লগইন পাসওয়ার্ড · শেষ ৪ ডিজিট",
    share: "অভিভাবক এই নম্বরের শেষ ৪ ডিজিট দিয়ে লগইন করতে পারবেন। লগইনের পর নতুন পাসওয়ার্ড সেট করতে হবে।",
    failed: "পাসওয়ার্ড রিসেট করা যায়নি। আবার চেষ্টা করুন।",
  },
  en: {
    title: "Reset guardian password",
    verifyTitle: "Verify the card first",
    verifyWarning: "Check the guardian's card to verify their identity and relationship to the student. Do not reset the password without checking the card.",
    cardVerified: "I have checked the card and verified the guardian's identity.",
    continue: "Verified, continue",
    finalTitle: "Confirm password reset",
    doubleCheck: "The card has been verified and I confirm this password reset.",
    confirm: "Reset the password to the last 4 digits of the guardian's registered mobile number. Their previous password and login sessions will stop working. This applies to the shared login for all their children.",
    reset: "Reset password", busy: "Resetting…", cancel: "Cancel", done: "Close",
    success: "Password reset", phone: "Registered mobile number", password: "Login password · last 4 digits",
    share: "The guardian can log in with the last 4 digits of this mobile number. They must then set a new password.",
    failed: "Could not reset password. Please try again.",
  },
});

export default function GuardianPasswordReset({ studentId, phone, onClose }: { studentId: string | number; phone: string; onClose: () => void }) {
  const t = useText(guardianPasswordResetText);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"verify" | "confirm">("verify");
  const [cardVerified, setCardVerified] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [result, setResult] = useState<{ phone: string; temporaryPassword: string } | null>(null);
  if (!hasPermission(user, permissions, "students.update") || !phone) return null;
  const close = () => { if (!busy) onClose(); };
  const reset = async () => {
    if (busy || step !== "confirm" || !cardVerified || !resetConfirmed) return;
    setBusy(true); setError("");
    try {
      const response = await api.post(`/students/${studentId}/guardian/reset-password`, {
        card_verified: cardVerified,
        reset_confirmed: resetConfirmed,
      });
      setResult(response.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || t.failed);
    } finally { setBusy(false); }
  };
  const buttonClass = "min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-slate-600";
  return (
      <Modal open title={result ? t.success : step === "verify" ? t.verifyTitle : t.finalTitle} onClose={close} maxWidthClassName="max-w-lg">
        {result ? <div className="space-y-4">
          <p className="text-sm">{t.share}</p>
          <dl className="space-y-3">
            <div><dt className="text-sm">{t.phone}</dt><dd dir="ltr" className="select-all text-lg font-semibold">{result.phone}</dd></div>
            <div><dt className="text-sm">{t.password}</dt><dd dir="ltr" className="select-all rounded-lg bg-slate-100 p-3 font-mono text-xl font-bold text-slate-900">{result.temporaryPassword}</dd></div>
          </dl>
          <button type="button" className={buttonClass} onClick={close}>{t.done}</button>
        </div> : step === "verify" ? <div className="space-y-5">
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{t.verifyWarning}</p>
          <div><p className="text-sm text-slate-500 dark:text-slate-400">{t.phone}</p><p dir="ltr" className="mt-1 font-semibold">{phone}</p></div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input type="checkbox" checked={cardVerified} onChange={(event) => setCardVerified(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-teal-700" />
            <span>{t.cardVerified}</span>
          </label>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className={buttonClass} onClick={close}>{t.cancel}</button>
            <button type="button" disabled={!cardVerified} className="min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { if (cardVerified) setStep("confirm"); }}>{t.continue}</button>
          </div>
        </div> : <div className="space-y-4">
          <p className="text-sm leading-6">{t.confirm}</p>
          <p dir="ltr" className="font-semibold">{phone}</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm leading-6 dark:border-slate-700">
            <input type="checkbox" checked={resetConfirmed} disabled={busy} onChange={(event) => setResetConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-teal-700" />
            <span>{t.doubleCheck}</span>
          </label>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={busy} className={buttonClass} onClick={close}>{t.cancel}</button>
            <button type="button" disabled={busy || !cardVerified || !resetConfirmed} className="min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void reset()}>{busy ? t.busy : t.reset}</button>
          </div>
        </div>}
      </Modal>
  );
}
