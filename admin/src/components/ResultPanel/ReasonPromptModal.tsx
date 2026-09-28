import { useState } from "react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { resultPanelText } from "./resultPanel.text";

interface Props {
  open: boolean;
  title: string;
  message?: string;
  label?: string;
  confirmText?: string;
  /** Rejections stay red (the default); a constructive confirm - e.g.
   * submitting a correction - can opt into the primary style. */
  confirmVariant?: "danger" | "primary";
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/** A small "type a reason and confirm" dialog — used everywhere the backend
 * requires a non-empty reason/remarks string (subject reject, result
 * reject) instead of a bare confirm. Reason is validated non-empty here
 * too, so the doomed request never leaves the browser. */
export default function ReasonPromptModal({
  open,
  title,
  message,
  label,
  confirmText,
  confirmVariant = "danger",
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  const t = useText(resultPanelText).reason;
  const c = useText(commonText);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  if (!open) return null;

  const trimmed = reason.trim();
  const isInvalid = touched && trimmed === "";

  const handleConfirm = () => {
    if (trimmed === "") {
      setTouched(true);
      return;
    }
    onConfirm(trimmed);
    setReason("");
    setTouched(false);
  };

  const handleCancel = () => {
    setReason("");
    setTouched(false);
    onCancel();
  };

  return (
    <Modal open={open} title={title} onClose={handleCancel} maxWidthClassName="max-w-md">
      <div className="space-y-3">
        {message && <p className="text-sm text-gray-600 dark:text-slate-400">{message}</p>}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{label ?? t.label}</label>
          <textarea
            autoFocus
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`w-full rounded-lg border p-2 text-sm outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
              isInvalid
                ? "border-red-400 focus:ring-red-400 dark:border-red-700"
                : "border-gray-300 focus:ring-blue-400 dark:border-slate-600"
            }`}
            placeholder={t.placeholder}
          />
          {isInvalid && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t.required}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={handleCancel} disabled={loading}>
            {c.cancel}
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={loading}>
            {loading ? "..." : (confirmText ?? c.confirm)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
