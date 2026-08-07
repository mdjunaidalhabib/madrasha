import { useState } from "react";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import Button from "../ui/Button";
import Input from "../ui/Input";

export default function LockScreen() {
  const unlock = useUIStore((s) => s.unlock);
  const isLocked = useUIStore((s) => s.isLocked);
  const user = useAuthStore((s) => s.user);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!isLocked) return null;

  const handleUnlock = async () => {
    setError("");
    try {
      await api.post("/auth/unlock", { password });
      setPassword("");
      unlock();
    } catch {
      setError("পাসওয়ার্ড সঠিক নয়।");
    }
  };

  const avatarLetter = (user?.name || "ম").trim().charAt(0).toUpperCase();

  return (
    // A soft, desaturated tint (not flat black) over a heavily blurred
    // backdrop - the app's own colours still bleed through faintly so it
    // reads as "blurred", not "blacked out", while no text stays legible.
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-2xl">
      <div className="w-full max-w-sm rounded-2xl border border-white/40 bg-white/95 p-8 shadow-2xl">
        <div className="mb-5 flex flex-col items-center text-center">
          {user?.photo_url ? (
            <img
              src={user.photo_url}
              alt={user.name}
              className="mb-3 h-16 w-16 rounded-full border-2 border-blue-100 object-cover"
            />
          ) : (
            <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
              {avatarLetter}
            </span>
          )}
          <h2 className="text-lg font-bold text-gray-900">স্ক্রিন লক করা আছে</h2>
          <p className="mt-1 text-sm text-gray-500">
            {user?.name
              ? `${user.name}, চালিয়ে যেতে পাসওয়ার্ড দিন`
              : "চালিয়ে যেতে পাসওয়ার্ড দিন"}
          </p>
        </div>

        <Input
          type="password"
          autoFocus
          placeholder="পাসওয়ার্ড দিন"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4">
          <Button className="w-full" onClick={handleUnlock}>
            আনলক করুন
          </Button>
        </div>
      </div>
    </div>
  );
}
