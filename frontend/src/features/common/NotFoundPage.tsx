import { useText } from "@madrasha/shared-ui/src/i18n";
import { appText } from "../../app/app.text";

export default function NotFoundPage() {
  const t = useText(appText);
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
        <div className="text-5xl font-bold text-blue-600">404</div>
        <h1 className="mt-3 text-xl font-bold text-gray-900">{t.pageNotFound}</h1>
        <p className="mt-2 text-sm text-gray-600">{t.notFound}</p>
      </div>
    </div>
  );
}
