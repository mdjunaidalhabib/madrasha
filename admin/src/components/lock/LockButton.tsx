import { useUIStore } from "../../store/uiStore";
import { LockKeyhole } from "lucide-react";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { shellText } from "../topbar/shell.text";

export default function LockButton() {
  const lock = useUIStore((s) => s.lock);
  const t = useText(shellText);

  return (
    <button
      type="button"
      onClick={lock}
      aria-label={t.lockScreen}
      title={t.lockScreen}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
    >
      <LockKeyhole size={16} />
    </button>
  );
}
