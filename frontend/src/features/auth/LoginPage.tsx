import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useToastStore } from "../../store/toastStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const toast = useToastStore();
  const nav = useNavigate();
  const { madrasaSlug = "" } = useParams();

  const handleLogin = async () => {
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
      <div className="w-full max-w-sm rounded bg-white p-6 shadow space-y-4">
        <h2 className="text-xl font-bold">Madrasa Admin Login</h2>
        <p className="text-xs text-gray-500">
          Tenant: <b>{madrasaSlug || "demo-madrasa"}</b>
        </p>

        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button onClick={handleLogin} disabled={loading} className="w-full">
          {loading ? "Logging in..." : "Login"}
        </Button>

        <p className="text-xs text-gray-500">
          Path-based tenant example: <b>/jamia/admin/login</b>
        </p>
      </div>
    </div>
  );
}
