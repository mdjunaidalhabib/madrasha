import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { formatDate, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

export default function GuardianNoticesPage() {
  const t = useText(guardianText);
  const lang = useLang();
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await guardianApi.get("/guardian/notices");
      setNotices(res.data?.data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title={t.notices} subtitle={t.noticesSubtitle} />

      {!loading && notices.length === 0 && <EmptyState title={t.noNotices} />}

      <div className="space-y-3">
        {notices.map((notice) => (
          <div key={notice.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{notice.title}</h3>
              {notice.publishedAt && (
                <span className="text-xs text-slate-400">
                  {formatDate(notice.publishedAt, lang)}
                </span>
              )}
            </div>
            {notice.content && <p className="mt-2 text-sm text-slate-600">{notice.content}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
