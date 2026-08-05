import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import { useToastStore } from "../../store/toastStore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { getTenantGuardianBase } from "../../utils/tenantSlug";

export default function GuardianChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const markPasswordChanged = useGuardianAuthStore((s) => s.markPasswordChanged);
  const toast = useToastStore();
  const nav = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const base = getTenantGuardianBase(madrasaSlug);

  const handleSubmit = async () => {
    if (newPassword.length < 4) {
      toast.push("error", "পাসওয়ার্ড কমপক্ষে ৪ ক্যারেক্টার হতে হবে");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.push("error", "দুটি পাসওয়ার্ড মিলছে না");
      return;
    }

    setLoading(true);
    try {
      await guardianApi.post("/guardian/change-password", { new_password: newPassword });
      markPasswordChanged();
      toast.push("success", "পাসওয়ার্ড পরিবর্তন হয়েছে");
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
        <h2 className="text-xl font-bold">নতুন পাসওয়ার্ড সেট করুন</h2>
        <p className="text-xs text-gray-500">
          নিরাপত্তার জন্য প্রথমবার লগইনে পাসওয়ার্ড পরিবর্তন করা আবশ্যক।
        </p>

        <Input
          type="password"
          placeholder="নতুন পাসওয়ার্ড"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="পাসওয়ার্ড আবার লিখুন"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button onClick={handleSubmit} disabled={loading} className="w-full">
          {loading ? "সংরক্ষণ হচ্ছে..." : "পাসওয়ার্ড সংরক্ষণ করুন"}
        </Button>
      </div>
    </div>
  );
}
