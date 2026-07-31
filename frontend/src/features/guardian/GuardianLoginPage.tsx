import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { getTenantGuardianBase } from "../../utils/tenantSlug";

export default function GuardianLoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const setAuth = useGuardianAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const base = getTenantGuardianBase(madrasaSlug);

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
    } catch {
      // guardianApi's response interceptor already shows the server error as a toast.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm space-y-4 rounded bg-white p-6 shadow">
        <h2 className="text-xl font-bold">অভিভাবক লগইন</h2>
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
      </div>
    </div>
  );
}
