import { useState } from "react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { commonText, formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { superAdminText } from "./superAdmin.text";

export default function DeleteConfirmModal({
  stats,
  count = 1,
  busy = false,
  busyLabel,
  onConfirm,
  onClose,
}: {
  stats: { students: number; users: number; accounts: number };
  count?: number;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useText(superAdminText);
  const c = useText(commonText);
  const lang = useLang();
  const [text, setText] = useState("");

  const valid = text === "DELETE";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded shadow w-full max-w-[420px] space-y-4 dark:bg-slate-900">
        <h3 className="font-bold text-lg text-red-600 dark:text-red-400">{t.permanentDeleteWarning}</h3>

        {count > 1 && (
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t.willBePermanentlyDeleted(formatNumber(count, lang))}
          </p>
        )}

        <div className="text-sm space-y-1 bg-gray-50 p-3 rounded dark:bg-slate-800 dark:text-slate-200">
          <p>{t.statStudents}: {formatNumber(stats.students, lang)}</p>
          <p>{t.statUsers}: {formatNumber(stats.users, lang)}</p>
          <p>{t.statAccounts}: {formatNumber(stats.accounts, lang)}</p>
        </div>

        <p className="text-sm text-gray-600 dark:text-slate-400">
          {t.cannotBeUndone}
          <br />
          {t.typeDeleteToConfirmBefore}
          <b>DELETE</b>
          {t.typeDeleteToConfirmAfter}
        </p>

        <input
          className="border p-2 w-full rounded dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder={t.typeDeletePlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            {c.cancel}
          </Button>
          <Button variant="danger" disabled={!valid || busy} onClick={onConfirm}>
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {busyLabel ?? t.deleting}
              </span>
            ) : (
              t.permanentlyDelete
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
