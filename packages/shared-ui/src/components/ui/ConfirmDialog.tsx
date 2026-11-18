import { useEffect, useState } from "react";
import Button from "./Button";
import { useConfirmStore } from "../../store/confirmStore";
import { commonText, useText } from "../../i18n";
import { uiText } from "./ui.text";

export default function ConfirmDialog() {
  const { open, title, message, confirmText, danger, passwordLabel, onConfirm, onCancel, hide, generation } =
    useConfirmStore();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setPassword(""); setError(""); }, [generation, open]);
  const t = useText(uiText);
  const c = useText(commonText);

  if (!open) return null;

  const handleCancel = () => {
    if (loading) return;
    onCancel?.();
    hide();
  };

  const handleConfirm = async () => {
    if (loading || (passwordLabel && !password)) return;
    // Chaining a second confirmation from inside onConfirm (e.g. a
    // sterner "are you REALLY sure?" step) calls show() again, which bumps
    // this generation counter - only hide the dialog afterward if nothing
    // re-opened it in the meantime, so that chained step isn't
    // immediately clobbered by this same handler's own cleanup.
    const startedGeneration = generation;
    setLoading(true);
    setError("");
    let failed = false;
    try {
      await onConfirm?.(passwordLabel ? password : undefined);
    } catch (err: any) {
      failed = true;
      setError(err?.response?.data?.message || err?.message || t.confirmQuestion);
    } finally {
      setLoading(false);
      if ((!failed || !passwordLabel) && useConfirmStore.getState().generation === startedGeneration) {
        hide();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded bg-white p-5 shadow dark:bg-slate-900">
        <h3 className="text-lg font-semibold dark:text-slate-100">{title || c.confirm}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{message || t.confirmQuestion}</p>
        {passwordLabel && (
          <label className="mt-4 block text-sm text-gray-700 dark:text-slate-200">
            {passwordLabel}
            <input type="password" autoComplete="current-password" autoFocus value={password}
              disabled={loading} onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleConfirm(); } }}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800" />
          </label>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={handleCancel} disabled={loading}>
            {c.cancel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={handleConfirm} disabled={loading || Boolean(passwordLabel && !password)}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {t.pleaseWait}
              </span>
            ) : (
              confirmText || c.confirm
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
