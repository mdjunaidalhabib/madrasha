import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { LanguageSwitcher, useText } from "@madrasha/shared-ui/src/i18n";
import { authText } from "./auth.text";

export default function ForgotPasswordPage() {
  const [madrasaCode, setMadrasaCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Only populated outside production (see backend auth.service.ts) since
  // there is no email/SMS service wired up yet - lets the flow be tested
  // end-to-end without a mail provider.
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  const nav = useNavigate();
  const t = useText(authText);

  const handleSubmit = async () => {
    if (!madrasaCode.trim()) {
      useToastStore.getState().show(t.enterInstitutionCode, "error");
      return;
    }
    if (!email.trim()) {
      useToastStore.getState().show(t.enterEmail, "error");
      return;
    }

    try {
      setLoading(true);
      const slug = madrasaCode.trim().toLowerCase();
      const res = await api.post(
        "/auth/forgot-password",
        { email: email.trim() },
        { headers: { "X-Madrasa-Slug": slug } },
      );
      setSubmitted(true);
      setDevResetToken(res.data?.dev_reset_token || null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.requestFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen items-center justify-center bg-gray-100 p-4 dark:bg-slate-950">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-4 rounded bg-white p-6 shadow dark:bg-slate-900">
        <h2 className="text-xl font-bold dark:text-slate-100">{t.forgotPassword}</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {t.forgotHint}
        </p>

        {submitted ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700 dark:text-green-400">
              {t.resetLinkSent}
            </p>

            {devResetToken && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                <p className="mb-1 font-medium">
                  {t.devMode}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    nav(
                      `/reset-password?token=${devResetToken}&slug=${madrasaCode.trim().toLowerCase()}`,
                    )
                  }
                  className="break-all text-start text-blue-600 underline dark:text-blue-400"
                >
                  {t.goToResetLink}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => nav("/login")}
              className="w-full text-center text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {t.backToLogin}
            </button>
          </div>
        ) : (
          <>
            <Input
              placeholder={t.institutionCode}
              value={madrasaCode}
              onChange={(e) => setMadrasaCode(e.target.value)}
            />
            <Input
              placeholder={t.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? t.sending : t.sendResetLink}
            </Button>
            <button
              type="button"
              onClick={() => nav("/login")}
              className="w-full text-center text-xs text-gray-500 hover:underline dark:text-slate-400"
            >
              {t.backToLogin}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
