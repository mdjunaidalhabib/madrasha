import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import adminApi from "../../../services/adminApi";
import { useAdminAuthStore } from "../../../store/adminAuthStore";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useForceLightTheme } from "@madrasha/shared-ui/src/hooks/useForceLightTheme";
import { LanguageSwitcher, getText, useText } from "@madrasha/shared-ui/src/i18n";
import { loginText } from "./login.text";

export default function SuperAdminLoginPage() {
  useForceLightTheme();
  const t = useText(loginText);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const setAuth = useAdminAuthStore((s) => s.setAuth);

  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await adminApi.post("/super-admin/login", {
        email,
        password,
      });

      if (!res.data?.token) {
        useToastStore.getState().show(getText(loginText).tokenMissing, "error");
        return;
      }

      localStorage.setItem("admin_token", res.data.token);

      setAuth({
        token: res.data.token,
        admin: res.data.admin,
      });

      navigate("/dashboard");
    } catch (err: any) {
      useToastStore.getState().show(err.response?.data?.message || getText(loginText).loginFailed, "error");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="relative flex h-screen items-center justify-center bg-gray-100">
      <LanguageSwitcher className="absolute end-4 top-4" />
      <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow w-full max-w-sm space-y-4">
        <h2 className="text-xl font-bold text-gray-900">{t.title}</h2>

        <Input
          type="email"
          autoComplete="username"
          placeholder={t.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={t.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pe-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            tabIndex={-1}
            aria-label={showPassword ? t.hidePassword : t.showPassword}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t.loggingIn : t.login}
        </Button>
      </form>
    </div>
  );
}
