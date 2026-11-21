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
import { ShieldCheck } from "lucide-react";
import "./guardian.css";

export default function GuardianChangePasswordPage() {
  const t = useText(guardianText);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const markPasswordChanged = useGuardianAuthStore((s) => s.markPasswordChanged);
  const toast = useToastStore();
  const nav = useNavigate();
  const madrasaSlug = useTenantSlug();
  const base = getTenantGuardianBase(madrasaSlug);

  const handleSubmit = async () => {
    if (newPassword.length < 4) {
      toast.push("error", t.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.push("error", t.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      await guardianApi.post("/guardian/change-password", { new_password: newPassword });
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
        <Input
          id="guardian-new-password"
          required
          minLength={4}
          type="password"
          autoComplete="new-password"
          placeholder={t.newPassword}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <label className="guardian-login-label" htmlFor="guardian-confirm-password">
          {t.retypePassword}
        </label>
        <Input
          id="guardian-confirm-password"
          required
          minLength={4}
          type="password"
          autoComplete="new-password"
          placeholder={t.retypePassword}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button type="submit" disabled={loading} className="guardian-login-submit mt-6 w-full">
          {loading ? t.saving : t.savePassword}
        </Button>
      </form>
    </div>
  );
}
