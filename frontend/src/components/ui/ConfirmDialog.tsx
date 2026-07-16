import Button from "./Button";
import { useConfirmStore } from "../../store/confirmStore";

export default function ConfirmDialog() {
  const { open, title, message, confirmText, danger, onConfirm, onCancel, hide } =
    useConfirmStore();

  if (!open) return null;

  const handleCancel = () => {
    onCancel?.();
    hide();
  };

  const handleConfirm = async () => {
    try {
      await onConfirm?.();
    } finally {
      hide();
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded bg-white p-5 shadow">
        <h3 className="text-lg font-semibold">{title || "Confirm"}</h3>
        <p className="mt-2 text-sm text-gray-600">{message || "Are you sure?"}</p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={handleConfirm}>
            {confirmText || "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
