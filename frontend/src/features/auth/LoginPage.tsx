import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useToastStore } from "../../store/toastStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { useForceLightTheme } from "../../hooks/useForceLightTheme";

export default function LoginPage() {
  useForceLightTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const toast = useToastStore();
  const nav = useNavigate();
  const { madrasaSlug = "" } = useParams();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      setAuth(res.data);

      toast.push("success", "Logged in");

      nav(`${getTenantAdminBase(madrasaSlug)}/dashboard`);
    } catch {
      // No local toast here — the global api.ts response interceptor
      // already shows the exact error from the server (e.g. wrong
      // password, "madrasa suspended", "madrasa deleted"). Showing it
      // again here was producing two identical toasts per failed login.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded bg-white p-6 shadow space-y-4"
      >
        <h2 className="text-xl font-bold">Madrasa Admin Login</h2>
        <p className="text-xs text-gray-500">
          Tenant: <b>{madrasaSlug || "demo-madrasa"}</b>
        </p>

        <Input
          type="email"
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Password"
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

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Logging in..." : "Login"}
        </Button>

        <button
          type="button"
          onClick={() => nav(`${getTenantAdminBase(madrasaSlug)}/forgot-password`)}
          className="w-full text-center text-xs text-blue-600 hover:underline"
        >
          পাসওয়ার্ড ভুলে গেছেন?
        </button>
      </form>
    </div>
  );
}
