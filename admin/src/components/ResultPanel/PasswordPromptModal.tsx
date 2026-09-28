import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { resultPanelText } from "./resultPanel.text";

interface Props {
  open: boolean;
  title: string;
  message?: string;
  loading?: boolean;
  /** Server-side error from the last verification attempt (e.g. wrong
   * password) - shown inline instead of closing the modal, so the user can
   * just retry without re-triggering the whole confirm flow. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}

/** Step-up re-authentication for a destructive in-app action (e.g. wiping a
 * whole class's entered marks) - asks the CURRENT user to type their own
 * password again before proceeding, verified server-side via
 * /auth/verify-password. Not a login screen: it never touches the session,
 * only confirms "this is really you" for one sensitive click. */
export default function PasswordPromptModal({
  open,
  title,
  message,
  loading = false,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const t = useText(resultPanelText).password;
  const c = useText(commonText);
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!open) return null;

  const isEmpty = touched && password === "";

  const handleConfirm = () => {
    if (password === "") {
      setTouched(true);
      return;
    }
    onConfirm(password);
  };

  const handleCancel = () => {
    setPassword("");
    setTouched(false);
    onCancel();
  };

  return (
    <Modal open={open} title={title} onClose={handleCancel} maxWidthClassName="max-w-md">
      <div className="space-y-3">
        {message && <p className="text-sm text-gray-600 dark:text-slate-400">{message}</p>}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
            {t.label}
          </label>
          <div className="relative">
            <input
              autoFocus
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setTouched(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              disabled={loading}
              className={`w-full rounded-lg border p-2 pe-10 text-sm outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
                isEmpty || error
                  ? "border-red-400 focus:ring-red-400 dark:border-red-700"
                  : "border-gray-300 focus:ring-blue-400 dark:border-slate-600"
              }`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label={showPassword ? t.hide : t.show}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {isEmpty && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t.required}</p>}
          {!isEmpty && error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={handleCancel} disabled={loading}>
            {c.cancel}
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={loading}>
            {loading ? t.verifying : c.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
