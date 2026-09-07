import { useState } from "react";
import Button from "./Button";
import { useConfirmStore } from "../../store/confirmStore";

export default function ConfirmDialog() {
  const { open, title, message, confirmText, danger, onConfirm, onCancel, hide } =
    useConfirmStore();
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleCancel = () => {
    if (loading) return;
    onCancel?.();
    hide();
  };

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm?.();
    } finally {
      setLoading(false);
      hide();
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded bg-white p-5 shadow dark:bg-slate-900">
        <h3 className="text-lg font-semibold dark:text-slate-100">{title || "Confirm"}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{message || "Are you sure?"}</p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Please wait...
              </span>
            ) : (
              confirmText || "Confirm"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
