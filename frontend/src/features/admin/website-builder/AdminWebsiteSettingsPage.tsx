import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import EmptyState from "../../../components/ui/EmptyState";
import {
  deleteWebsiteGalleryItem,
  deleteWebsiteNotice,
  getWebsiteSettings,
  saveWebsiteGalleryItem,
  saveWebsiteNotice,
  saveWebsitePage,
  saveWebsiteSettings,
  type WebsiteGalleryPayload,
  type WebsiteNoticePayload,
  type WebsitePagePayload,
  type WebsiteSettingsPayload,
} from "../../../services/websiteApi";
import { useAuthStore } from "../../../store/authStore";
import { getTenantSlugFromPath } from "../../../utils/tenantSlug";

const defaultPages: WebsitePagePayload[] = [
  { page_key: "about", title: "আমাদের সম্পর্কে", content: "", is_published: 1, sort_order: 1 },
  { page_key: "admission", title: "ভর্তি তথ্য", content: "", is_published: 1, sort_order: 2 },
  { page_key: "contact", title: "যোগাযোগ", content: "", is_published: 1, sort_order: 3 },
];

const defaultSettings: WebsiteSettingsPayload = {
  name: "",
  phone: "",
  email: "",
  address: "",
  logo_url: "",
  hero_title: "",
  hero_subtitle: "",
  theme_color: "#2563eb",
  show_notices: 1,
  show_gallery: 1,
  show_teachers: 1,
  show_admission: 1,
  show_about: 1,
  show_contact: 1,
  is_published: 1,
};

const toggleFields: Array<[keyof WebsiteSettingsPayload, string, string]> = [
  ["is_published", "Website published", "বন্ধ করলে public website hidden থাকবে"],
  ["show_about", "About section", "মাদ্রাসার পরিচিতি দেখাবে"],
  ["show_admission", "Admission section", "ভর্তি তথ্য দেখাবে"],
  ["show_notices", "Notice section", "নোটিশ দেখাবে"],
  ["show_gallery", "Gallery section", "ছবি/গ্যালারি দেখাবে"],
  ["show_teachers", "Teachers section", "শিক্ষক section দেখাবে"],
  ["show_contact", "Contact section", "যোগাযোগ তথ্য দেখাবে"],
];

export default function AdminWebsiteSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const slug = getTenantSlugFromPath();
  const [form, setForm] = useState<WebsiteSettingsPayload>(defaultSettings);
  const [pages, setPages] = useState<WebsitePagePayload[]>(defaultPages);
  const [notices, setNotices] = useState<WebsiteNoticePayload[]>([]);
  const [gallery, setGallery] = useState<WebsiteGalleryPayload[]>([]);
  const [noticeDraft, setNoticeDraft] = useState<WebsiteNoticePayload>({
    title: "",
    content: "",
    is_published: 1,
  });
  const [galleryDraft, setGalleryDraft] = useState<WebsiteGalleryPayload>({
    title: "",
    image_url: "",
    is_published: 1,
    sort_order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const publicUrl = useMemo(() => `${window.location.origin}/${slug}`, [slug]);

  useEffect(() => {
    setLoading(true);
    getWebsiteSettings(user?.madrasa_id)
      .then((data) => {
        if (data?.madrasa) {
          setForm((prev) => ({ ...prev, ...data.settings, ...data.madrasa }));
        } else if (data) {
          setForm((prev) => ({ ...prev, ...data }));
        }

        if (Array.isArray(data?.pages) && data.pages.length) {
          const merged = defaultPages.map(
            (page) =>
              data.pages.find((p: WebsitePagePayload) => p.page_key === page.page_key) || page,
          );
          const extras = data.pages.filter(
            (p: WebsitePagePayload) => !defaultPages.some((d) => d.page_key === p.page_key),
          );
          setPages([...merged, ...extras]);
        }

        if (Array.isArray(data?.notices)) setNotices(data.notices);
        if (Array.isArray(data?.gallery)) setGallery(data.gallery);
      })
      .finally(() => setLoading(false));
  }, [user?.madrasa_id]);

  const update = (key: keyof WebsiteSettingsPayload, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePage = (index: number, key: keyof WebsitePagePayload, value: string | number) => {
    setPages((prev) => prev.map((page, i) => (i === index ? { ...page, [key]: value } : page)));
  };

  const submitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await saveWebsiteSettings({ ...form, madrasa_id: user?.madrasa_id });
      for (const page of pages) {
        await saveWebsitePage(page);
      }
      setMessage("Website settings saved successfully.");
    } finally {
      setSaving(false);
    }
  };

  const submitNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeDraft.title?.trim()) return;
    const saved = await saveWebsiteNotice(noticeDraft);
    setNotices((prev) => [saved.data, ...prev.filter((n) => n.id !== saved.data.id)]);
    setNoticeDraft({ title: "", content: "", is_published: 1 });
  };

  const removeNotice = async (id?: number) => {
    if (!id) return;
    await deleteWebsiteNotice(id);
    setNotices((prev) => prev.filter((notice) => notice.id !== id));
  };

  const submitGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryDraft.image_url?.trim()) return;
    const saved = await saveWebsiteGalleryItem(galleryDraft);
    setGallery((prev) => [saved.data, ...prev.filter((item) => item.id !== saved.data.id)]);
    setGalleryDraft({ title: "", image_url: "", is_published: 1, sort_order: 0 });
  };

  const removeGalleryItem = async (id?: number) => {
    if (!id) return;
    await deleteWebsiteGalleryItem(id);
    setGallery((prev) => prev.filter((item) => item.id !== id));
  };

  if (loading)
    return <div className="rounded-2xl bg-white p-6 shadow">Loading website settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            মাদ্রাসার public website-এর নাম, banner, notice, page content এবং section visibility
            এখান থেকে control করুন।
          </p>
        </div>
        <a
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
        >
          View public website
        </a>
      </div>

      {message && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      <form onSubmit={submitSettings} className="space-y-6">
        <section className="rounded-2xl bg-white p-6 shadow space-y-5">
          <h2 className="text-lg font-bold">Basic Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Madrasa name</label>
              <Input
                value={form.name || ""}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Jamia Islamia"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Logo URL</label>
              <Input
                value={form.logo_url || ""}
                onChange={(e) => update("logo_url", e.target.value)}
                placeholder="https://.../logo.png"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={form.email || ""} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Address</label>
              <Input
                value={form.address || ""}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow space-y-5">
          <h2 className="text-lg font-bold">Homepage Banner</h2>
          <div>
            <label className="text-sm font-medium">Hero title</label>
            <Input
              value={form.hero_title || ""}
              onChange={(e) => update("hero_title", e.target.value)}
              placeholder="মাদ্রাসার নাম/স্বাগতম বার্তা"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Hero subtitle</label>
            <textarea
              className="mt-1 w-full rounded border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
              rows={4}
              value={form.hero_subtitle || ""}
              onChange={(e) => update("hero_subtitle", e.target.value)}
            />
          </div>
          <div className="max-w-xs">
            <label className="text-sm font-medium">Theme color</label>
            <Input
              type="color"
              value={form.theme_color || "#2563eb"}
              onChange={(e) => update("theme_color", e.target.value)}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow space-y-4">
          <h2 className="text-lg font-bold">Feature / Section Control</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {toggleFields.map(([key, label, hint]) => (
              <label
                key={String(key)}
                className="flex items-center justify-between gap-4 rounded-xl border p-4 text-sm"
              >
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="text-xs text-gray-500">{hint}</span>
                </span>
                <input
                  type="checkbox"
                  checked={(form[key] as number) !== 0}
                  onChange={(e) => update(key, e.target.checked ? 1 : 0)}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow space-y-5">
          <h2 className="text-lg font-bold">Website Pages</h2>
          <div className="grid gap-4">
            {pages.map((page, index) => (
              <div key={page.page_key} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Input
                    value={page.title}
                    onChange={(e) => updatePage(index, "title", e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={page.is_published !== 0}
                      onChange={(e) => updatePage(index, "is_published", e.target.checked ? 1 : 0)}
                    />
                    Published
                  </label>
                </div>
                <textarea
                  className="w-full rounded border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                  rows={5}
                  value={page.content || ""}
                  onChange={(e) => updatePage(index, "content", e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        <Button disabled={saving}>{saving ? "Saving..." : "Save website settings"}</Button>
      </form>

      <section className="rounded-2xl bg-white p-6 shadow space-y-5">
        <h2 className="text-lg font-bold">Notices</h2>
        <form onSubmit={submitNotice} className="rounded-xl border p-4 space-y-3">
          <Input
            value={noticeDraft.title || ""}
            onChange={(e) => setNoticeDraft((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Notice title"
          />
          <textarea
            className="w-full rounded border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
            value={noticeDraft.content || ""}
            onChange={(e) => setNoticeDraft((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="Notice details"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noticeDraft.is_published !== 0}
              onChange={(e) =>
                setNoticeDraft((prev) => ({ ...prev, is_published: e.target.checked ? 1 : 0 }))
              }
            />
            Publish this notice
          </label>
          <Button type="submit">Add notice</Button>
        </form>

        {notices.length ? (
          <div className="space-y-3">
            {notices.map((notice) => (
              <div
                key={notice.id || notice.title}
                className="flex items-start justify-between gap-4 rounded-xl border p-4"
              >
                <div>
                  <h3 className="font-semibold">{notice.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{notice.content}</p>
                  {notice.is_published === 0 && (
                    <p className="mt-2 text-xs text-amber-600">Draft / hidden</p>
                  )}
                </div>
                <Button type="button" variant="danger" onClick={() => removeNotice(notice.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No notices yet"
            hint="নতুন notice add করলে public website-এ show হবে।"
          />
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow space-y-5">
        <h2 className="text-lg font-bold">Gallery</h2>
        <form onSubmit={submitGallery} className="rounded-xl border p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={galleryDraft.title || ""}
              onChange={(e) => setGalleryDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Image title"
            />
            <Input
              value={galleryDraft.image_url || ""}
              onChange={(e) => setGalleryDraft((prev) => ({ ...prev, image_url: e.target.value }))}
              placeholder="Image URL"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={galleryDraft.is_published !== 0}
              onChange={(e) =>
                setGalleryDraft((prev) => ({ ...prev, is_published: e.target.checked ? 1 : 0 }))
              }
            />
            Publish this image
          </label>
          <Button type="submit">Add gallery image</Button>
        </form>

        {gallery.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {gallery.map((item) => (
              <div key={item.id || item.image_url} className="rounded-xl border p-3">
                <img
                  src={item.image_url}
                  alt={item.title || "Gallery"}
                  className="h-32 w-full rounded-lg object-cover"
                />
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.title || "Gallery image"}</p>
                    {item.is_published === 0 && <p className="text-xs text-amber-600">Hidden</p>}
                  </div>
                  <Button type="button" variant="danger" onClick={() => removeGalleryItem(item.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No gallery images yet"
            hint="Image URL add করলে public website gallery section-এ দেখা যাবে।"
          />
        )}
      </section>
    </div>
  );
}
