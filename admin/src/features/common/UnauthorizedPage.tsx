import { useText } from "@madrasha/shared-ui/src/i18n";
import { shellText } from "../../components/topbar/shell.text";

export default function UnauthorizedPage() {
  const t = useText(shellText);
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow dark:bg-slate-900">
      <div className="text-4xl">🔒</div>
      <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-slate-100">{t.accessRestricted}</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
        {t.accessRestrictedBody}
      </p>
    </div>
  );
}
