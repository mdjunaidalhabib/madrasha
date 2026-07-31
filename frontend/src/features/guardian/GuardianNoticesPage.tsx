import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";

export default function GuardianNoticesPage() {
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
      <PageHeader title="নোটিশ" subtitle="মাদরাসার সাম্প্রতিক নোটিশসমূহ" />

      {!loading && notices.length === 0 && <EmptyState title="কোনো নোটিশ নেই" />}

      <div className="space-y-3">
        {notices.map((notice) => (
          <div key={notice.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{notice.title}</h3>
              {notice.publishedAt && (
                <span className="text-xs text-slate-400">
                  {new Date(notice.publishedAt).toLocaleDateString("bn-BD")}
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
