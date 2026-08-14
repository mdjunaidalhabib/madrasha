import { useState } from "react";
import Button from "../ui/Button";

export default function DeleteConfirmModal({
  stats,
  count = 1,
  busy = false,
  busyLabel = "Deleting...",
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
  const [text, setText] = useState("");

  const valid = text === "DELETE";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded shadow w-full max-w-[420px] space-y-4 dark:bg-slate-900">
        <h3 className="font-bold text-lg text-red-600 dark:text-red-400">Permanent Delete Warning</h3>

        {count > 1 && (
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {count}টি মাদ্রাসা স্থায়ীভাবে মুছে ফেলা হবে
          </p>
        )}

        <div className="text-sm space-y-1 bg-gray-50 p-3 rounded dark:bg-slate-800 dark:text-slate-200">
          <p>Students: {stats.students}</p>
          <p>Users: {stats.users}</p>
          <p>Accounts: {stats.accounts}</p>
        </div>

        <p className="text-sm text-gray-600 dark:text-slate-400">
          This action cannot be undone.
          <br />
          Type <b>DELETE</b> to confirm.
        </p>

        <input
          className="border p-2 w-full rounded dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Type DELETE"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!valid || busy} onClick={onConfirm}>
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {busyLabel}
              </span>
            ) : (
              "Permanently Delete"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
