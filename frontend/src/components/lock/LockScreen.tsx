import { useState } from "react";
import { useUIStore } from "../../store/uiStore";
import api from "../../services/api";
import Button from "../ui/Button";
import Input from "../ui/Input";

export default function LockScreen() {
  const unlock = useUIStore((s) => s.unlock);
  const isLocked = useUIStore((s) => s.isLocked);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!isLocked) return null;

  const handleUnlock = async () => {
    setError("");
    try {
      await api.post("/auth/unlock", { password });
      unlock();
    } catch {
      setError("Wrong password");
    }
  };

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded bg-white p-6 shadow">
        <h2 className="text-lg font-bold mb-3">Screen Locked</h2>
        <Input
          type="password"
          placeholder="Enter your account password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4">
          <Button className="w-full" onClick={handleUnlock}>
            Unlock
          </Button>
        </div>
      </div>
    </div>
  );
}
