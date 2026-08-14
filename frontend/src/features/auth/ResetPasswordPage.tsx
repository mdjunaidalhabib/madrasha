import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useToastStore } from "../../store/toastStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const nav = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const handleSubmit = async () => {
    if (!token) {
      useToastStore.getState().show("রিসেট লিংক সঠিক নয়", "error");
      return;
    }
    if (newPassword.length < 6) {
      useToastStore.getState().show("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      useToastStore.getState().show("দুটো পাসওয়ার্ড মিলছে না", "error");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/reset-password", { token, new_password: newPassword });
      setDone(true);
      useToastStore.getState().show("পাসওয়ার্ড পরিবর্তন হয়েছে", "success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "রিসেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm space-y-4 rounded bg-white p-6 shadow dark:bg-slate-900">
        <h2 className="text-xl font-bold dark:text-slate-100">নতুন পাসওয়ার্ড সেট করুন</h2>

        {!token ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            এই লিংকটি সঠিক নয়। আবার "পাসওয়ার্ড ভুলে গেছেন" থেকে চেষ্টা করুন।
          </p>
        ) : done ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700 dark:text-green-400">
              আপনার পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। এখন লগইন করুন।
            </p>
            <Button onClick={() => nav(`${adminBase}/login`)} className="w-full">
              লগইন করুন
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="নতুন পাসওয়ার্ড"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <Input
              type={showPassword ? "text" : "password"}
              placeholder="পাসওয়ার্ড আবার লিখুন"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? "সংরক্ষণ হচ্ছে..." : "পাসওয়ার্ড পরিবর্তন করুন"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
