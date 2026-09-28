import { Link } from "react-router-dom";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { shellText } from "../../components/topbar/shell.text";

export default function NotFoundPage() {
  const t = useText(shellText);
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow dark:bg-slate-900">
        <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">404</div>
        <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-slate-100">{t.pageNotFound}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{t.pageNotFoundBody}</p>
        <Link
          to="/dashboard"
          className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {t.backToDashboard}
        </Link>
      </div>
    </div>
  );
}
