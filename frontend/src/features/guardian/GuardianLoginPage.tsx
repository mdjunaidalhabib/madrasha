import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import guardianApi, { GUARDIAN_TENANT_BLOCK_STORAGE_KEY } from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import TenantBlockedScreen, {
  type TenantBlockInfo,
} from "@madrasha/shared-ui/src/components/ui/TenantBlockedScreen";
import { getTenantGuardianBase } from "../../utils/tenantSlug";
import { useTenantSlug } from "../../utils/useTenantSlug";
import { LanguageSwitcher, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

export default function GuardianLoginPage() {
  const t = useText(guardianText);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Set either when this login attempt itself fails with 410/423 (madrasa
  // suspended/deleted), or on mount when guardianApi.ts's response
  // interceptor redirected here after that happened mid-session. While set,
  // the form is replaced by TenantBlockedScreen instead of staying usable.
  const [tenantBlock, setTenantBlock] = useState<TenantBlockInfo | null>(null);

  const setAuth = useGuardianAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const madrasaSlug = useTenantSlug();
  const base = getTenantGuardianBase(madrasaSlug);

  useEffect(() => {
    try {
      const stashed = window.sessionStorage.getItem(GUARDIAN_TENANT_BLOCK_STORAGE_KEY);
      if (stashed) {
        window.sessionStorage.removeItem(GUARDIAN_TENANT_BLOCK_STORAGE_KEY);
        setTenantBlock(JSON.parse(stashed));
      }
    } catch {
      // ignore storage/parse errors (e.g. private browsing mode)
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await guardianApi.post("/guardian/login", { phone, password });
      setAuth({ token: res.data.token, guardian: res.data.guardian });

      if (res.data.guardian.mustChangePassword) {
        nav(`${base}/change-password`);
      } else {
        nav(`${base}/dashboard`);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 410 || status === 423) {
        setTenantBlock({ status, message: err?.response?.data?.message });
      }
      // Otherwise guardianApi's response interceptor already shows the
      // server error as a toast.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm space-y-4 rounded bg-white p-6 shadow">
        {!tenantBlock && (
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{t.loginTitle}</h2>
            <LanguageSwitcher />
          </div>
        )}

        {tenantBlock && (
          <TenantBlockedScreen
            status={tenantBlock.status}
            message={tenantBlock.message}
            onBack={() => setTenantBlock(null)}
            backLabel={t.tryAgain}
          />
        )}

        {!tenantBlock && (
          <>
            <p className="text-xs text-gray-500">
              {t.institutionLabel} <b>{madrasaSlug || "demo-madrasa"}</b>
            </p>

            <Input
              placeholder={t.mobileNumber}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={t.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {t.firstLoginHint}
            </p>

            <Button onClick={handleLogin} disabled={loading} className="w-full">
              {loading ? t.loggingIn : t.login}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
