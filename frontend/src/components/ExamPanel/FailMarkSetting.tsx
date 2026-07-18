import { useEffect, useState } from "react";
import api from "../../services/api";
import { useToastStore } from "../../store/toastStore";

export default function FailMarkSetting({
  value,
  reload,
}: {
  value: number;
  reload: () => void;
}) {
  const [fail, setFail] = useState(value);

  useEffect(() => {
    setFail(value);
  }, [value]);

  const update = async () => {
    if (!fail) return useToastStore.getState().show("Enter fail mark", "error");

    try {
      await api.post("/fail-mark", { value: Number(fail) });
      useToastStore.getState().show("Updated!", "success");
      reload();
    } catch {
      useToastStore.getState().show("Failed to update", "error");
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md space-y-5">
      <h2 className="text-xl font-semibold">❌ Fail Mark</h2>

      <input
        type="number"
        className="border rounded-lg px-3 py-2 w-full"
        value={fail}
        onChange={(e) => setFail(Number(e.target.value))}
      />

      <button
        onClick={update}
        className="bg-green-600 text-white px-4 py-2 rounded-lg w-full"
      >
        Update
      </button>
    </div>
  );
}
