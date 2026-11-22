import { useState } from "react";
import { useNavigate } from "react-router-dom";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { getTenantGuardianBase } from "../../utils/tenantSlug";
import { useTenantSlug } from "../../utils/useTenantSlug";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";
import { useGuardianLightTheme } from "./useGuardianLightTheme";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import "./guardian.css";

export default function GuardianChangePasswordPage() {
  useGuardianLightTheme();
  const t = useText(guardianText);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password: string | null; confirm: string | null }>({ password: null, confirm: null });

  const markPasswordChanged = useGuardianAuthStore((s) => s.markPasswordChanged);
  const toast = useToastStore();
  const nav = useNavigate();
  const madrasaSlug = useTenantSlug();
  const base = getTenantGuardianBase(madrasaSlug);

  const handleSubmit = async () => {
    if (loading) return;
    const nextErrors = {
      password: !newPassword.trim() ? t.newPasswordRequired : newPassword.length < 4 ? t.passwordTooShort : null,
      confirm: !confirmPassword.trim() ? t.confirmPasswordRequired : newPassword !== confirmPassword ? t.passwordMismatch : null,
    };
    setErrors(nextErrors);
    if (nextErrors.password || nextErrors.confirm) {
      toast.push("error", (nextErrors.password || nextErrors.confirm)!);
      document.getElementById(nextErrors.password ? "guardian-new-password" : "guardian-confirm-password")?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await guardianApi.post("/guardian/change-password", { new_password: newPassword });
      useGuardianAuthStore.setState({ token: res.data.token });
      markPasswordChanged();
      toast.push("success", t.passwordChanged);
      nav(`${base}/dashboard`);
    } catch {
      // handled by guardianApi interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="guardian-password-screen">
      <form
        noValidate
        className="guardian-login-card guardian-login-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <span className="guardian-password-icon">
          <ShieldCheck size={30} strokeWidth={1.5} />
        </span>
        <div className="guardian-login-heading">
          <h2>{t.setNewPassword}</h2>
        </div>
        <p className="guardian-login-help">{t.mustChangeHint}</p>

        <label className="guardian-login-label" htmlFor="guardian-new-password">
          {t.newPassword}
        </label>
        <div className="relative">
        <Input
          id="guardian-new-password"
          required
          minLength={4}
          type={showNewPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={t.newPassword}
          value={newPassword}
          invalid={!!errors.password}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "guardian-new-password-error" : undefined}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setErrors((previous) => ({ ...previous, password: null }));
          }}
          className="pe-11 dark:border-slate-200 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:hover:border-slate-300"
        />
        <button
          type="button"
          onClick={() => setShowNewPassword((value) => !value)}
          aria-label={showNewPassword ? t.hidePassword : t.showPassword}
          aria-pressed={showNewPassword}
          aria-controls="guardian-new-password"
          className="absolute inset-y-0 end-0 flex items-center rounded-lg px-3 text-slate-500 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        </div>
        {errors.password && <p id="guardian-new-password-error" className="guardian-login-field-error">{errors.password}</p>}
        <label className="guardian-login-label" htmlFor="guardian-confirm-password">
          {t.retypePassword}
        </label>
        <div className="relative">
        <Input
          id="guardian-confirm-password"
          required
          minLength={4}
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={t.retypePassword}
          value={confirmPassword}
          invalid={!!errors.confirm}
          aria-invalid={!!errors.confirm}
          aria-describedby={errors.confirm ? "guardian-confirm-password-error" : undefined}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setErrors((previous) => ({ ...previous, confirm: null }));
          }}
          className="pe-11 dark:border-slate-200 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:hover:border-slate-300"
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword((value) => !value)}
          aria-label={showConfirmPassword ? t.hidePassword : t.showPassword}
          aria-pressed={showConfirmPassword}
          aria-controls="guardian-confirm-password"
          className="absolute inset-y-0 end-0 flex items-center rounded-lg px-3 text-slate-500 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        </div>
        {errors.confirm && <p id="guardian-confirm-password-error" className="guardian-login-field-error">{errors.confirm}</p>}

        <Button type="submit" disabled={loading} className="guardian-login-submit mt-6 w-full">
          {loading ? t.saving : t.savePassword}
        </Button>
      </form>
    </div>
  );
}
