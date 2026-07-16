import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { getPublicWebsite } from "../../../services/websiteApi";
import EmptyState from "../../../components/ui/EmptyState";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  );
}

export default function PublicWebsitePage() {
  const params = useParams();
  const slug = params.madrasaSlug || params.slug || "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getPublicWebsite(slug)
      .then(setData)
      .catch((err) => setError(err?.response?.data?.message || "Website unavailable"))
      .finally(() => setLoading(false));
  }, [slug]);

  const madrasa = data?.madrasa;
  const settings = data?.settings || {};
  const pages = data?.pages || [];
  const notices = data?.notices || [];
  const teachers = data?.teachers || [];
  const gallery = data?.gallery || [];

  const pageMap = useMemo(() => {
    const map: Record<string, any> = {};
    pages.forEach((page: any) => {
      map[page.page_key] = page;
    });
    return map;
  }, [pages]);

  if (loading)
    return <div className="min-h-screen bg-gray-50 p-8 text-center">Loading website...</div>;
  if (error)
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <EmptyState
          title={error}
          hint="Super Admin অথবা Madrasa Admin website status/settings check করতে পারেন।"
        />
      </div>
    );

  const themeColor = settings.theme_color || "#2563eb";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {settings.logo_url && (
              <img
                src={settings.logo_url}
                alt="Logo"
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            )}
            <div className="min-w-0">
              <div className="truncate font-bold text-lg">{madrasa?.name}</div>
              <div className="text-xs text-slate-500">Official Website</div>
            </div>
          </div>
          <div className="text-sm text-slate-500">{madrasa?.phone}</div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div
          className="rounded-3xl bg-white p-8 shadow-sm"
          style={{ borderTop: `5px solid ${themeColor}` }}
        >
          <p className="text-sm font-semibold" style={{ color: themeColor }}>
            Official Madrasa Website
          </p>
          <h1 className="mt-3 text-3xl font-bold md:text-5xl">
            {settings.hero_title || madrasa?.name}
          </h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            {settings.hero_subtitle || madrasa?.address || "Welcome to our madrasa website."}
          </p>
          {madrasa?.website_status === "limited" && (
            <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Limited mode enabled by Super Admin.
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-14 md:grid-cols-3">
        <div className="md:col-span-2 space-y-5">
          {settings.show_about !== 0 && pageMap.about && (
            <Section title={pageMap.about.title}>
              <p className="whitespace-pre-line">{pageMap.about.content}</p>
            </Section>
          )}

          {settings.show_admission !== 0 && pageMap.admission && (
            <Section title={pageMap.admission.title}>
              <p className="whitespace-pre-line">{pageMap.admission.content}</p>
            </Section>
          )}

          {settings.show_teachers !== 0 && (
            <Section title="শিক্ষকবৃন্দ">
              {teachers.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {teachers.map((teacher: any) => (
                    <div key={teacher.id} className="rounded-xl border p-3">
                      <div className="font-semibold text-slate-900">
                        {teacher.name || teacher.teacher_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {teacher.designation || teacher.subject || "Teacher"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>শিক্ষক তথ্য এখনো প্রকাশ করা হয়নি।</p>
              )}
            </Section>
          )}

          {settings.show_gallery !== 0 && (
            <Section title="গ্যালারি">
              {gallery.length ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {gallery.map((item: any) => (
                    <img
                      key={item.id || item.image_url}
                      src={item.image_url}
                      alt={item.title || "Gallery"}
                      className="h-32 w-full rounded-xl object-cover"
                    />
                  ))}
                </div>
              ) : (
                <p>Gallery section চালু আছে। ছবি upload করলে এখানে দেখা যাবে।</p>
              )}
            </Section>
          )}
        </div>

        <aside className="space-y-5">
          {settings.show_notices !== 0 && (
            <Section title="Notices">
              <div className="space-y-3">
                {notices.length ? (
                  notices.map((notice: any) => (
                    <div key={notice.id} className="rounded-xl border p-3">
                      <div className="font-semibold text-slate-900">{notice.title}</div>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                        {notice.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>No notices published.</p>
                )}
              </div>
            </Section>
          )}

          {settings.show_contact !== 0 && (
            <Section title={pageMap.contact?.title || "যোগাযোগ"}>
              {pageMap.contact?.content && (
                <p className="mb-3 whitespace-pre-line">{pageMap.contact.content}</p>
              )}
              <div className="space-y-1">
                {madrasa?.phone && <p>Phone: {madrasa.phone}</p>}
                {madrasa?.email && <p>Email: {madrasa.email}</p>}
                {madrasa?.address && <p>Address: {madrasa.address}</p>}
              </div>
            </Section>
          )}
        </aside>
      </main>
    </div>
  );
}
