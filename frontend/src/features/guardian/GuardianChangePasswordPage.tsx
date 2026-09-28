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
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm space-y-4 rounded bg-white p-6 shadow">
        <h2 className="text-xl font-bold">{t.setNewPassword}</h2>
        <p className="text-xs text-gray-500">
          {t.mustChangeHint}
        </p>

        <Input
          type="password"
          autoComplete="new-password"
          placeholder={t.newPassword}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder={t.retypePassword}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button onClick={handleSubmit} disabled={loading} className="w-full">
          {loading ? t.saving : t.savePassword}
        </Button>
      </div>
    </div>
  );
}
