import { useState } from "react";
import { useNavigate } from "react-router-dom";
import adminApi from "../../../services/adminApi";
import { useAdminAuthStore } from "../../../store/adminAuthStore";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { useToastStore } from "../../../store/toastStore";

export default function SuperAdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const setAuth = useAdminAuthStore((s) => s.setAuth);

  const navigate = useNavigate();

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await adminApi.post("/super-admin/login", {
        email,
        password,
      });

      if (!res.data?.token) {
        useToastStore.getState().show("Token missing from login response", "error");
        return;
      }

      localStorage.setItem("admin_token", res.data.token);

      setAuth({
        token: res.data.token,
        admin: res.data.admin,
      });

      navigate("/super-admin/dashboard");
    } catch (err: any) {
      useToastStore.getState().show(err.response?.data?.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow w-full max-w-sm space-y-4">
        <h2 className="text-xl font-bold">Super Admin Login</h2>

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
      </div>
    </div>
  );
}
