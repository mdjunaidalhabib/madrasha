import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { commonText, useText } from "../../i18n";
import { designerText } from "./designer.text";

export default function CreateTemplateModal({
  open,
  defaultName,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  defaultName: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const t = useText(designerText);
  const c = useText(commonText);
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const trimmed = name.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  };

  return (
    <Modal open={open} title={t.createTemplateTitle} onClose={onClose} maxWidthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.templateName}</label>
          <input
            autoFocus
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder={t.templateNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {t.createHint}
          </p>
        </div>

        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {c.cancel}
          </button>
          <Button type="submit" disabled={!trimmed || busy}>
            {busy ? t.creating : c.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
