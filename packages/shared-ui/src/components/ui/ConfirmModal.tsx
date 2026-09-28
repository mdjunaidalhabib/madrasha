import Modal from "./Modal";
import { commonText, useText } from "../../i18n";
import { uiText } from "./ui.text";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const c = useText(commonText);
  const t = useText(uiText);
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-slate-300">{message}</p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {cancelText ?? c.cancel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60",
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-black hover:bg-black/90 dark:bg-slate-700 dark:hover:bg-slate-600",
            ].join(" ")}
          >
            {loading ? t.pleaseWait : confirmText ?? c.confirm}
          </button>
        </div>
      </div>
    </Modal>
  );
}
