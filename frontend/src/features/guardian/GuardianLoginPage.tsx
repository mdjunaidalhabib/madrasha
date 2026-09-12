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

export default function GuardianLoginPage() {
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
        {!tenantBlock && <h2 className="text-xl font-bold">অভিভাবক লগইন</h2>}

        {tenantBlock && (
          <TenantBlockedScreen
            status={tenantBlock.status}
            message={tenantBlock.message}
            onBack={() => setTenantBlock(null)}
            backLabel="আবার চেষ্টা করুন"
          />
        )}

        {!tenantBlock && (
          <>
            <p className="text-xs text-gray-500">
              মাদরাসা: <b>{madrasaSlug || "demo-madrasa"}</b>
            </p>

            <Input
              placeholder="মোবাইল নম্বর"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="পাসওয়ার্ড"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <p className="text-xs text-slate-500">
              প্রথমবার লগইন করছেন? ডিফল্ট পাসওয়ার্ড আপনার মোবাইল নম্বরের শেষ ৪ ডিজিট।
            </p>

            <Button onClick={handleLogin} disabled={loading} className="w-full">
              {loading ? "লগইন হচ্ছে..." : "লগইন"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
