import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import api from "../../services/api";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { LanguageSwitcher, commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { authText } from "./auth.text";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const slug = searchParams.get("slug") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const nav = useNavigate();
  const t = useText(authText);
  const c = useText(commonText);

  const handleSubmit = async () => {
    if (!token) {
      useToastStore.getState().show(t.invalidResetLink, "error");
      return;
    }
    if (newPassword.length < 6) {
      useToastStore.getState().show(t.passwordMin6, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      useToastStore.getState().show(t.passwordMismatch, "error");
      return;
    }

    try {
      setLoading(true);
      await api.post(
        "/auth/reset-password",
        { token, new_password: newPassword },
        { headers: { "X-Madrasa-Slug": slug } },
      );
      setDone(true);
      useToastStore.getState().show(t.passwordChanged, "success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.resetFailed;
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
        <h2 className="text-xl font-bold dark:text-slate-100">{t.setNewPassword}</h2>

        {!token ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {t.linkInvalidTryAgain}
          </p>
        ) : done ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700 dark:text-green-400">
              {t.passwordChangedLogin}
            </p>
            <Button onClick={() => nav("/login")} className="w-full">
              {t.loginNow}
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t.newPassword}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t.retypePassword}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? c.saving : t.changePassword}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
