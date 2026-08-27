import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  ExternalLink,
  FileText,
  GalleryHorizontalEnd,
  Globe,
  Images,
  Megaphone,
  Palette,
  Pencil,
  Plus,
  Quote,
  Settings2,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import PageHeader from "../../../components/ui/PageHeader";
import EmptyState from "../../../components/ui/EmptyState";
import { SkeletonCard } from "../../../components/ui/Skeleton";
import BrandImageBox from "../../../components/settings/BrandImageBox";
import SectionCard from "../../../components/settings/SectionCard";
import { ToggleSwitch, PublishToggle } from "../../../components/settings/ToggleSwitch";
import InlineTextField, { textAreaClass } from "../../../components/settings/InlineTextField";
import InlineListField from "../../../components/settings/InlineListField";
import InlineImageField from "../../../components/settings/InlineImageField";
import { CLOUD_NOT_CONFIGURED_MSG, isPendingCloudUpload } from "../../../utils/cloudUpload";
import { useSectionTogglesStore } from "../../../store/sectionTogglesStore";
import { getTenantAdminBase } from "../../../utils/tenantSlug";
import {
  deleteWebsiteCommitteeMember,
  deleteWebsiteGalleryItem,
  deleteWebsiteNotice,
  deleteWebsiteSlide,
  getWebsiteSettings,
  saveWebsiteCommitteeMember,
  saveWebsiteGalleryItem,
  saveWebsiteNotice,
  saveWebsitePage,
  saveWebsiteSettings,
  saveWebsiteSlide,
  type WebsiteCommitteeMemberPayload,
  type WebsiteGalleryPayload,
  type WebsiteNoticePayload,
  type WebsitePagePayload,
  type WebsiteSettingsPayload,
  type WebsiteSlidePayload,
} from "../../../services/websiteApi";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import { useConfirmStore } from "../../../store/confirmStore";
import { getTenantSlugFromPath } from "../../../utils/tenantSlug";
import { logger } from "../../../utils/logger";

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
  show_slider: 1,
  show_muhtamim: 1,
  show_committee: 1,
  show_notice_bar: 1,
  is_published: 1,
  muhtamim_name: "",
  muhtamim_designation: "",
  muhtamim_photo: "",
  muhtamim_message: "",
  notice_bar_text: "",
  notice_bar_speed: 20,
  facebook_url: "",
  youtube_url: "",
  instagram_url: "",
  whatsapp_channel_url: "",
};

/**
 * সিরিয়াল/ক্রম টাইপ করে বসানো যায় না — শুধু ড্রপডাউন থেকে অবস্থান বেছে নিলে
 * মাঝের সব আইটেমের sort_order স্বয়ংক্রিয়ভাবে শিফট হয়ে যায় (1-based position)।
 */
function reorderBySortOrder<T extends { id?: number; sort_order?: number }>(
  list: T[],
  movedId: number,
  newPosition: number,
): T[] {
  const ordered = [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const fromIndex = ordered.findIndex((item) => item.id === movedId);
  if (fromIndex === -1) return list;

  const [moved] = ordered.splice(fromIndex, 1);
  const toIndex = Math.min(Math.max(newPosition - 1, 0), ordered.length);
  ordered.splice(toIndex, 0, moved);

  return ordered.map((item, index) => ({ ...item, sort_order: index + 1 }));
}

const emptyNotice: WebsiteNoticePayload = { title: "", content: "", is_published: 1 };
const emptyGallery: WebsiteGalleryPayload = { title: "", image_url: "", is_published: 1, sort_order: 0 };
const emptySlide: WebsiteSlidePayload = {
  title: "",
  subtitle: "",
  image_url: "",
  is_published: 1,
  sort_order: 0,
};
const emptyCommittee: WebsiteCommitteeMemberPayload = {
  name: "",
  designation: "",
  photo_url: "",
  phone: "",
  is_published: 1,
  sort_order: 0,
};

const toggleFields: Array<[keyof WebsiteSettingsPayload, string, string]> = [
  ["show_notice_bar", "চলমান নোটিশ বার", "নেভবারের নিচে স্ক্রলিং নোটিশ বার দেখাবে"],
  ["show_slider", "হোম স্লাইডার", "হোমপেজে ছবির স্লাইডার দেখাবে"],
  ["show_about", "আমাদের সম্পর্কে", "মাদ্রাসার পরিচিতি সেকশন দেখাবে"],
  ["show_muhtamim", "মুহতামিমের বাণী", "মুহতামিম সাহেবের বাণী সেকশন দেখাবে"],
  ["show_admission", "ভর্তি তথ্য", "ভর্তি সংক্রান্ত সেকশন দেখাবে"],
  ["show_notices", "নোটিশ বোর্ড", "নোটিশ বোর্ড সেকশন দেখাবে"],
  ["show_gallery", "গ্যালারি", "ছবি গ্যালারি সেকশন দেখাবে"],
  ["show_teachers", "শিক্ষকমণ্ডলী", "শিক্ষকদের তালিকা সেকশন দেখাবে"],
  ["show_committee", "মাদ্রাসা কমিটি", "কমিটির সদস্যদের তালিকা দেখাবে"],
  ["show_contact", "যোগাযোগ", "যোগাযোগ তথ্য সেকশন দেখাবে"],
];

type TabKey =
  | "general"
  | "appearance"
  | "notice-bar"
  | "notices"
  | "gallery"
  | "slider"
  | "muhtamim"
  | "committee"
  | "social"
  | "pages";

const fieldLabelClass = "mb-1 block text-sm font-medium text-gray-700 dark:text-slate-400";

const selectFieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

/** "প্রকাশ করুন" টগল + বাতিল/সংরক্ষণ বাটন - এডিট-ড্রাফট ব্লকগুলোতে (পেজ,
 * নোটিশ, গ্যালারি, স্লাইড, কমিটি) হুবহু একই স্টাইল/অ্যালাইনমেন্ট নিশ্চিত করতে
 * একটাই কম্পোনেন্ট থেকে রেন্ডার হয়, আলাদা আলাদা কপি-পেস্ট না করে। */
function PublishAndSaveActions({
  published,
  onPublishedChange,
  saving,
  onCancel,
  onSave,
}: {
  published: boolean;
  onPublishedChange: (v: boolean) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <PublishToggle checked={published} onChange={onPublishedChange} />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          বাতিল
        </Button>
        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
        </Button>
      </div>
    </div>
  );
}

/** "প্রকাশ করুন" টগল + "যোগ করুন" সাবমিট বাটন - নতুন-আইটেম-যোগ ফর্মগুলোতে
 * (নোটিশ, গ্যালারি, স্লাইড, কমিটি) একই স্টাইলে ব্যবহারের জন্য। */
function PublishAndSubmitAction({
  published,
  onPublishedChange,
  saving,
}: {
  published: boolean;
  onPublishedChange: (v: boolean) => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <PublishToggle checked={published} onChange={onPublishedChange} />
      <Button disabled={saving} type="submit" className="gap-1.5">
        {!saving && <Plus size={15} />}
        {saving ? "সংরক্ষণ হচ্ছে..." : "যোগ করুন"}
      </Button>
    </div>
  );
}

export default function AdminWebsiteSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const slug = getTenantSlugFromPath();
  const toast = useToastStore((s) => s.show);
  const isSectionEnabled = useSectionTogglesStore((s) => s.isEnabled);
  const setSectionToggle = useSectionTogglesStore((s) => s.setToggle);
  const fetchSectionToggles = useSectionTogglesStore((s) => s.fetchToggles);

  const [tab, setTab] = useState<TabKey>("general");

  const [form, setForm] = useState<WebsiteSettingsPayload>(defaultSettings);
  // Mirrors `form` synchronously so queued saves always read the latest
  // committed values instead of a stale render-time closure.
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    fetchSectionToggles();
  }, [fetchSectionToggles]);
  // Every field/toggle save PUTs the *entire* settings object (the backend
  // has no partial-update endpoint), so concurrent saves must be serialized
  // — otherwise a slower request can overwrite a faster one's change with
  // stale data for the fields it doesn't own.
  const settingsSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [pages, setPages] = useState<WebsitePagePayload[]>(defaultPages);
  const [notices, setNotices] = useState<WebsiteNoticePayload[]>([]);
  const [gallery, setGallery] = useState<WebsiteGalleryPayload[]>([]);
  const [slides, setSlides] = useState<WebsiteSlidePayload[]>([]);
  const [committee, setCommittee] = useState<WebsiteCommitteeMemberPayload[]>([]);

  const [noticeDraft, setNoticeDraft] = useState<WebsiteNoticePayload>(emptyNotice);
  const [galleryDraft, setGalleryDraft] = useState<WebsiteGalleryPayload>(emptyGallery);
  const [slideDraft, setSlideDraft] = useState<WebsiteSlidePayload>(emptySlide);
  const [committeeDraft, setCommitteeDraft] = useState<WebsiteCommitteeMemberPayload>(emptyCommittee);

  const [savingNotice, setSavingNotice] = useState(false);
  const [savingGallery, setSavingGallery] = useState(false);
  const [savingSlide, setSavingSlide] = useState(false);
  const [savingCommittee, setSavingCommittee] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);

  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);
  const [pageDraft, setPageDraft] = useState<WebsitePagePayload | null>(null);
  const [savingPage, setSavingPage] = useState(false);

  // Existing items in Notices/Gallery/Slider/Committee are edited in place
  // (pencil icon on the item itself), the same pattern as "পেজ কন্টেন্ট"
  // above — the top form is only ever for creating a *new* item.
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [noticeEditDraft, setNoticeEditDraft] = useState<WebsiteNoticePayload | null>(null);
  const [savingNoticeEdit, setSavingNoticeEdit] = useState(false);

  const [editingGalleryId, setEditingGalleryId] = useState<number | null>(null);
  const [galleryEditDraft, setGalleryEditDraft] = useState<WebsiteGalleryPayload | null>(null);
  const [savingGalleryEdit, setSavingGalleryEdit] = useState(false);

  const [editingSlideId, setEditingSlideId] = useState<number | null>(null);
  const [slideEditDraft, setSlideEditDraft] = useState<WebsiteSlidePayload | null>(null);
  const [savingSlideEdit, setSavingSlideEdit] = useState(false);

  const [editingCommitteeId, setEditingCommitteeId] = useState<number | null>(null);
  const [committeeEditDraft, setCommitteeEditDraft] = useState<WebsiteCommitteeMemberPayload | null>(
    null,
  );
  const [savingCommitteeEdit, setSavingCommitteeEdit] = useState(false);

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
        if (Array.isArray(data?.slides)) setSlides(data.slides);
        if (Array.isArray(data?.committee)) setCommittee(data.committee);
      })
      .catch((err) => {
        logger.error("LOAD WEBSITE SETTINGS ERROR:", err);
        toast("সেটিংস লোড করতে সমস্যা হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।", "error");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.madrasa_id]);

  /**
   * Queues a settings PUT so saves never overlap. Each task re-reads
   * `formRef` at execution time (not call time), so a save that was queued
   * behind another always builds its full-object payload on top of
   * whatever the previous save just committed.
   */
  const queueSettingsSave = (patch: Partial<WebsiteSettingsPayload>) => {
    const task = async () => {
      const payload: WebsiteSettingsPayload = {
        ...formRef.current,
        ...patch,
        madrasa_id: user?.madrasa_id,
      };
      await saveWebsiteSettings(payload);
      formRef.current = { ...formRef.current, ...patch };
      setForm(formRef.current);
    };
    const result = settingsSaveQueueRef.current.then(task, task);
    settingsSaveQueueRef.current = result.catch(() => {});
    return result;
  };

  const saveSettingsField = async (key: keyof WebsiteSettingsPayload, value: string | number) => {
    try {
      await queueSettingsSave({ [key]: value } as Partial<WebsiteSettingsPayload>);
      toast("সংরক্ষণ হয়েছে।", "success");
    } catch (err) {
      logger.error("SAVE WEBSITE SETTINGS FIELD ERROR:", err);
      toast("সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।", "error");
      throw err;
    }
  };

  const handleToggle = async (key: keyof WebsiteSettingsPayload, checked: boolean) => {
    const nextValue = checked ? 1 : 0;
    setForm((prev) => ({ ...prev, [key]: nextValue })); // optimistic UI only
    setSavingToggle(String(key));
    try {
      await queueSettingsSave({ [key]: nextValue } as Partial<WebsiteSettingsPayload>);
      toast("আপডেট হয়েছে।", "success");
    } catch (err) {
      logger.error("SAVE WEBSITE TOGGLE ERROR:", err);
      setForm(formRef.current); // revert to the last known-good server state
      toast("আপডেট করা যায়নি। আবার চেষ্টা করুন।", "error");
    } finally {
      setSavingToggle(null);
    }
  };

  const startEditPage = (index: number) => {
    setEditingPageIndex(index);
    setPageDraft(pages[index]);
  };

  const cancelEditPage = () => {
    setEditingPageIndex(null);
    setPageDraft(null);
  };

  const savePage = async () => {
    if (!pageDraft) return;
    setSavingPage(true);
    try {
      await saveWebsitePage(pageDraft);
      setPages((prev) => prev.map((p, i) => (i === editingPageIndex ? pageDraft : p)));
      toast("পেজ সংরক্ষণ হয়েছে।", "success");
      setEditingPageIndex(null);
      setPageDraft(null);
    } catch (err) {
      logger.error("SAVE WEBSITE PAGE ERROR:", err);
      toast("পেজ সংরক্ষণ করা যায়নি।", "error");
    } finally {
      setSavingPage(false);
    }
  };

  // ---------- Notices ----------
  const submitNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeDraft.title?.trim()) {
      toast("নোটিশের শিরোনাম দিন।", "error");
      return;
    }
    setSavingNotice(true);
    try {
      const saved = await saveWebsiteNotice(noticeDraft);
      setNotices((prev) => [saved.data, ...prev]);
      setNoticeDraft(emptyNotice);
      toast("নোটিশ যোগ করা হয়েছে।", "success");
    } catch (err) {
      logger.error("SAVE NOTICE ERROR:", err);
      toast("নোটিশ সংরক্ষণ করা যায়নি।", "error");
    } finally {
      setSavingNotice(false);
    }
  };

  const startEditNotice = (notice: WebsiteNoticePayload) => {
    setEditingNoticeId(notice.id!);
    setNoticeEditDraft(notice);
  };

  const cancelEditNotice = () => {
    setEditingNoticeId(null);
    setNoticeEditDraft(null);
  };

  const saveNoticeEdit = async () => {
    if (!noticeEditDraft) return;
    if (!noticeEditDraft.title?.trim()) {
      toast("নোটিশের শিরোনাম দিন।", "error");
      return;
    }
    setSavingNoticeEdit(true);
    try {
      const saved = await saveWebsiteNotice(noticeEditDraft);
      setNotices((prev) => prev.map((n) => (n.id === saved.data.id ? saved.data : n)));
      toast("নোটিশ আপডেট হয়েছে।", "success");
      cancelEditNotice();
    } catch (err) {
      logger.error("SAVE NOTICE ERROR:", err);
      toast("নোটিশ সংরক্ষণ করা যায়নি।", "error");
    } finally {
      setSavingNoticeEdit(false);
    }
  };

  const removeNotice = (notice: WebsiteNoticePayload) => {
    if (!notice.id) return;
    useConfirmStore.getState().show({
      title: "নোটিশ মুছুন",
      message: `"${notice.title}" নোটিশটি স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmText: "মুছুন",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteWebsiteNotice(notice.id!);
          setNotices((prev) => prev.filter((n) => n.id !== notice.id));
          if (editingNoticeId === notice.id) cancelEditNotice();
          toast("নোটিশ মুছে ফেলা হয়েছে।", "success");
        } catch (err) {
          logger.error("DELETE NOTICE ERROR:", err);
          toast("নোটিশ মুছতে সমস্যা হয়েছে।", "error");
        }
      },
    });
  };

  // ---------- Gallery ----------
  const submitGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryDraft.image_url?.trim()) {
      toast("ছবি আপলোড করুন।", "error");
      return;
    }
    if (isPendingCloudUpload(galleryDraft.image_url)) {
      toast(CLOUD_NOT_CONFIGURED_MSG, "error");
      return;
    }
    const chosenPosition = galleryDraft.sort_order || gallery.length + 1;
    setSavingGallery(true);
    try {
      const saved = await saveWebsiteGalleryItem({ ...galleryDraft, sort_order: gallery.length + 1 });
      let nextGallery = [saved.data, ...gallery];
      if (chosenPosition <= gallery.length) {
        nextGallery = reorderBySortOrder(nextGallery, saved.data.id!, chosenPosition);
        await Promise.all(
          nextGallery
            .filter((item) => item.id !== saved.data.id)
            .map((item) => saveWebsiteGalleryItem(item)),
        );
      }
      setGallery(nextGallery.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setGalleryDraft(emptyGallery);
      toast("গ্যালারিতে ছবি যোগ করা হয়েছে।", "success");
    } catch (err) {
      logger.error("SAVE GALLERY ERROR:", err);
      toast("ছবি সংরক্ষণ করা যায়নি।", "error");
    } finally {
      setSavingGallery(false);
    }
  };

  const startEditGalleryItem = (item: WebsiteGalleryPayload) => {
    setEditingGalleryId(item.id!);
    const position = gallery.findIndex((g) => g.id === item.id) + 1;
    setGalleryEditDraft({ ...item, sort_order: position || gallery.length });
  };

  const cancelEditGalleryItem = () => {
    setEditingGalleryId(null);
    setGalleryEditDraft(null);
  };

  const saveGalleryEdit = async () => {
    if (!galleryEditDraft) return;
    if (!galleryEditDraft.image_url?.trim()) {
      toast("ছবি আপলোড করুন।", "error");
      return;
    }
    if (isPendingCloudUpload(galleryEditDraft.image_url)) {
      toast(CLOUD_NOT_CONFIGURED_MSG, "error");
      return;
    }
    const desiredPosition = galleryEditDraft.sort_order || gallery.length;
    const originalItem = gallery.find((g) => g.id === galleryEditDraft.id);
    setSavingGalleryEdit(true);
    try {
      // নিজের ফিল্ড আগে সেভ করা হয় পুরনো sort_order অক্ষুণ্ণ রেখে - তারপর দরকার
      // হলে অবস্থান বদলে অন্য আইটেমগুলো শিফট করা হয়, একসাথে দুটো না করে।
      const saved = await saveWebsiteGalleryItem({ ...galleryEditDraft, sort_order: originalItem?.sort_order });
      let nextGallery = gallery.map((item) => (item.id === saved.data.id ? saved.data : item));
      const currentPosition = nextGallery.findIndex((item) => item.id === saved.data.id) + 1;

      if (desiredPosition !== currentPosition) {
        nextGallery = reorderBySortOrder(nextGallery, saved.data.id, desiredPosition);
        await Promise.all(
          nextGallery.filter((item) => item.id !== saved.data.id).map((item) => saveWebsiteGalleryItem(item)),
        );
      }

      setGallery(nextGallery.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      toast("গ্যালারি ছবি আপডেট হয়েছে।", "success");
      cancelEditGalleryItem();
    } catch (err) {
      logger.error("SAVE GALLERY ERROR:", err);
      toast("ছবি সংরক্ষণ করা যায়নি।", "error");
    } finally {
      setSavingGalleryEdit(false);
    }
  };

  const removeGalleryItem = (item: WebsiteGalleryPayload) => {
    if (!item.id) return;
    useConfirmStore.getState().show({
      title: "গ্যালারি ছবি মুছুন",
      message: `"${item.title || "এই ছবিটি"}" স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmText: "মুছুন",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteWebsiteGalleryItem(item.id!);
          setGallery((prev) => prev.filter((g) => g.id !== item.id));
          if (editingGalleryId === item.id) cancelEditGalleryItem();
          toast("ছবি মুছে ফেলা হয়েছে।", "success");
        } catch (err) {
          logger.error("DELETE GALLERY ERROR:", err);
          toast("ছবি মুছতে সমস্যা হয়েছে।", "error");
        }
      },
    });
  };

  // ---------- Hero slides ----------
  const submitSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideDraft.image_url?.trim()) {
      toast("স্লাইডের ছবি আপলোড করুন।", "error");
      return;
    }
    if (isPendingCloudUpload(slideDraft.image_url)) {
      toast(CLOUD_NOT_CONFIGURED_MSG, "error");
      return;
    }
    const chosenPosition = slideDraft.sort_order || slides.length + 1;
    setSavingSlide(true);
    try {
      const saved = await saveWebsiteSlide({ ...slideDraft, sort_order: slides.length + 1 });
      let nextSlides = [saved.data, ...slides];
      if (chosenPosition <= slides.length) {
        nextSlides = reorderBySortOrder(nextSlides, saved.data.id!, chosenPosition);
        await Promise.all(
          nextSlides.filter((item) => item.id !== saved.data.id).map((item) => saveWebsiteSlide(item)),
        );
      }
      setSlides(nextSlides.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setSlideDraft(emptySlide);
      toast("স্লাইড যোগ করা হয়েছে।", "success");
    } catch (err) {
      logger.error("SAVE SLIDE ERROR:", err);
      toast("স্লাইড সংরক্ষণ করা যায়নি।", "error");
    } finally {
      setSavingSlide(false);
    }
  };

  const startEditSlide = (item: WebsiteSlidePayload) => {
    setEditingSlideId(item.id!);
    const position = slides.findIndex((s) => s.id === item.id) + 1;
    setSlideEditDraft({ ...item, sort_order: position || slides.length });
  };

  const cancelEditSlide = () => {
    setEditingSlideId(null);
    setSlideEditDraft(null);
  };

  const saveSlideEdit = async () => {
    if (!slideEditDraft) return;
    if (!slideEditDraft.image_url?.trim()) {
      toast("স্লাইডের ছবি আপলোড করুন।", "error");
      return;
    }
    if (isPendingCloudUpload(slideEditDraft.image_url)) {
      toast(CLOUD_NOT_CONFIGURED_MSG, "error");
      return;
    }
    const desiredPosition = slideEditDraft.sort_order || slides.length;
    const originalItem = slides.find((s) => s.id === slideEditDraft.id);
    setSavingSlideEdit(true);
    try {
      const saved = await saveWebsiteSlide({ ...slideEditDraft, sort_order: originalItem?.sort_order });
      let nextSlides = slides.map((item) => (item.id === saved.data.id ? saved.data : item));
      const currentPosition = nextSlides.findIndex((item) => item.id === saved.data.id) + 1;

      if (desiredPosition !== currentPosition) {
        nextSlides = reorderBySortOrder(nextSlides, saved.data.id, desiredPosition);
        await Promise.all(
          nextSlides.filter((item) => item.id !== saved.data.id).map((item) => saveWebsiteSlide(item)),
        );
      }

      setSlides(nextSlides.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      toast("স্লাইড আপডেট হয়েছে।", "success");
      cancelEditSlide();
    } catch (err) {
      logger.error("SAVE SLIDE ERROR:", err);
      toast("স্লাইড সংরক্ষণ করা যায়নি।", "error");
    } finally {
      setSavingSlideEdit(false);
    }
  };

  const removeSlide = (item: WebsiteSlidePayload) => {
    if (!item.id) return;
    useConfirmStore.getState().show({
      title: "স্লাইড মুছুন",
      message: `"${item.title || "এই স্লাইডটি"}" স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmText: "মুছুন",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteWebsiteSlide(item.id!);
          setSlides((prev) => prev.filter((s) => s.id !== item.id));
          if (editingSlideId === item.id) cancelEditSlide();
          toast("স্লাইড মুছে ফেলা হয়েছে।", "success");
        } catch (err) {
          logger.error("DELETE SLIDE ERROR:", err);
          toast("স্লাইড মুছতে সমস্যা হয়েছে।", "error");
        }
      },
    });
  };

  // ---------- Committee ----------
  const submitCommitteeMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeDraft.name?.trim()) {
      toast("সদস্যের নাম দিন।", "error");
      return;
    }
    if (isPendingCloudUpload(committeeDraft.photo_url)) {
      toast(CLOUD_NOT_CONFIGURED_MSG, "error");
      return;
    }
    setSavingCommittee(true);
    try {
      const saved = await saveWebsiteCommitteeMember(committeeDraft);
      setCommittee((prev) => [saved.data, ...prev]);
      setCommitteeDraft(emptyCommittee);
      toast("কমিটির সদস্য যোগ করা হয়েছে।", "success");
    } catch (err) {
      logger.error("SAVE COMMITTEE ERROR:", err);
      toast("সংরক্ষণ করা যায়নি।", "error");
    } finally {
      setSavingCommittee(false);
    }
  };

  const startEditCommitteeMember = (item: WebsiteCommitteeMemberPayload) => {
    setEditingCommitteeId(item.id!);
    setCommitteeEditDraft(item);
  };

  const cancelEditCommitteeMember = () => {
    setEditingCommitteeId(null);
    setCommitteeEditDraft(null);
  };

  const saveCommitteeEdit = async () => {
    if (!committeeEditDraft) return;
    if (!committeeEditDraft.name?.trim()) {
      toast("সদস্যের নাম দিন।", "error");
      return;
    }
    if (isPendingCloudUpload(committeeEditDraft.photo_url)) {
      toast(CLOUD_NOT_CONFIGURED_MSG, "error");
      return;
    }
    setSavingCommitteeEdit(true);
    try {
      const saved = await saveWebsiteCommitteeMember(committeeEditDraft);
      setCommittee((prev) => prev.map((item) => (item.id === saved.data.id ? saved.data : item)));
      toast("কমিটির সদস্য আপডেট হয়েছে।", "success");
      cancelEditCommitteeMember();
    } catch (err) {
      logger.error("SAVE COMMITTEE ERROR:", err);
      toast("সংরক্ষণ করা যায়নি।", "error");
    } finally {
      setSavingCommitteeEdit(false);
    }
  };

  const removeCommitteeMember = (item: WebsiteCommitteeMemberPayload) => {
    if (!item.id) return;
    useConfirmStore.getState().show({
      title: "কমিটির সদস্য মুছুন",
      message: `"${item.name}" কে স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmText: "মুছুন",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteWebsiteCommitteeMember(item.id!);
          setCommittee((prev) => prev.filter((m) => m.id !== item.id));
          if (editingCommitteeId === item.id) cancelEditCommitteeMember();
          toast("সদস্য মুছে ফেলা হয়েছে।", "success");
        } catch (err) {
          logger.error("DELETE COMMITTEE ERROR:", err);
          toast("মুছতে সমস্যা হয়েছে।", "error");
        }
      },
    });
  };

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Settings2; badge?: number }> = [
    { key: "general", label: "সাধারণ সেটিংস", icon: Settings2 },
    { key: "appearance", label: "থিম ও হিরো ব্যানার", icon: Palette },
    { key: "notice-bar", label: "নোটিশ বার", icon: Megaphone },
    { key: "notices", label: "নোটিশ", icon: Bell, badge: notices.length },
    { key: "gallery", label: "গ্যালারি", icon: Images, badge: gallery.length },
    { key: "slider", label: "হিরো স্লাইডার", icon: GalleryHorizontalEnd, badge: slides.length },
    { key: "muhtamim", label: "মুহতামিমের বাণী", icon: Quote },
    { key: "committee", label: "মাদ্রাসা কমিটি", icon: Users, badge: committee.length },
    { key: "social", label: "সোশ্যাল মিডিয়া", icon: Share2 },
    { key: "pages", label: "পেজ কন্টেন্ট", icon: FileText },
  ];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader title="ওয়েবসাইট সেটিংস" />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-24">
        <aside className="settings-sidebar no-print self-start rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-4">
          <div className="mb-2 rounded-lg bg-blue-800 px-3 py-2 text-white">
            <h2 className="text-base font-bold">সেটিংস মেনু</h2>
          </div>
          <div className="space-y-1">
            {tabs.map(({ key, label, icon: Icon, badge }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition ${
                    active
                      ? "border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                    <Icon size={15} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {typeof badge === "number" && badge > 0 && (
                      <span
                        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                          active
                            ? "bg-blue-600/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                    <span className={active ? "text-blue-700 dark:text-blue-400" : "text-slate-300 dark:text-slate-600"}>
                      ›
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 max-w-4xl space-y-6">
      <PageHeader
        title="ওয়েবসাইট সেটিংস"
        subtitle="মাদ্রাসার পাবলিক ওয়েবসাইটের নাম, লোগো, ব্যানার, নোটিশ, গ্যালারি ও পেজ কন্টেন্ট এখান থেকে পরিচালনা করুন।"
        actions={
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-600/30 active:translate-y-0"
          >
            ওয়েবসাইট দেখুন
            <ExternalLink
              size={15}
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        }
      />

      <div
        className={`flex items-center justify-between gap-4 rounded-2xl border-2 p-5 shadow-sm transition ${
          (form.is_published as number) !== 0
            ? "border-green-200 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20"
            : "border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              (form.is_published as number) !== 0
                ? "bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400"
                : "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            }`}
          >
            <Globe size={20} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-slate-100">ওয়েবসাইট প্রকাশিত</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  (form.is_published as number) !== 0
                    ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                }`}
              >
                {(form.is_published as number) !== 0 ? "লাইভ আছে" : "বন্ধ আছে"}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
              এটি মাস্টার সুইচ — বন্ধ করলে পুরো পাবলিক ওয়েবসাইট (সব ট্যাবের সব সেকশনসহ) সবার কাছে অদৃশ্য হয়ে যাবে।
            </p>
          </div>
        </div>
        {savingToggle === "is_published" ? (
          <span className="shrink-0 text-xs text-gray-400 dark:text-slate-500">সংরক্ষণ হচ্ছে...</span>
        ) : (
          <ToggleSwitch
            checked={(form.is_published as number) !== 0}
            onChange={(v) => handleToggle("is_published", v)}
          />
        )}
      </div>

      {tab === "general" && (
        <div className="space-y-6">
          <SectionCard
            title="সেকশন দৃশ্যমানতা"
            hint="ক্লিক করলেই সাথে সাথে আপডেট হয়ে যাবে — কোন সেকশনগুলো পাবলিক ওয়েবসাইটে দেখাবে তা নিয়ন্ত্রণ করুন"
            toggle={{
              checked: isSectionEnabled("website_section_visibility"),
              onChange: (v) => setSectionToggle("website_section_visibility", v),
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {toggleFields.map(([key, label, hint]) => (
                <div
                  key={String(key)}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-slate-700"
                >
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-slate-100">{label}</span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{hint}</span>
                  </span>
                  {savingToggle === String(key) ? (
                    <span className="text-xs text-gray-400 dark:text-slate-500">সংরক্ষণ হচ্ছে...</span>
                  ) : (
                    <ToggleSwitch
                      checked={(form[key] as number) !== 0}
                      onChange={(v) => handleToggle(key, v)}
                    />
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "appearance" && (
        <div className="space-y-6">
          <SectionCard
            title="প্রতিষ্ঠান পরিচিতি ও লোগো"
            toggle={{
              checked: isSectionEnabled("website_institution_info"),
              onChange: (v) => setSectionToggle("website_institution_info", v),
            }}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400">
              মাদ্রাসার নাম, ঠিকানা, যোগাযোগ ও লোগো এখন{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">প্রতিষ্ঠান ব্র্যান্ডিং সেটিংস</span>{" "}
              থেকে স্বয়ংক্রিয়ভাবে নেওয়া হয়, যাতে একই তথ্য ওয়েবসাইট ও আইডি কার্ড/মার্কশিটের মতো সব রিপোর্টে
              একইরকম দেখায়।
            </p>
            <Link
              to={`${getTenantAdminBase()}/settings/branding`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              প্রতিষ্ঠান ব্র্যান্ডিং সেটিংসে সম্পাদনা করুন
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </SectionCard>

          <SectionCard
            title="থিম কালার"
            toggle={{
              checked: isSectionEnabled("website_theme_color"),
              onChange: (v) => setSectionToggle("website_theme_color", v),
            }}
          >
            <InlineTextField
              label="থিম কালার"
              value={form.theme_color || "#2563eb"}
              type="color"
              onSave={(v) => saveSettingsField("theme_color", v)}
            />
          </SectionCard>

          <SectionCard
            title="হোমপেজ ব্যানার"
            toggle={{
              checked: isSectionEnabled("website_hero_banner"),
              onChange: (v) => setSectionToggle("website_hero_banner", v),
            }}
          >
            <div className="space-y-2">
              <InlineTextField
                label="হিরো শিরোনাম"
                value={form.hero_title || ""}
                placeholder="মাদ্রাসার নাম/স্বাগতম বার্তা"
                onSave={(v) => saveSettingsField("hero_title", v)}
              />
              <InlineTextField
                label="হিরো সাব-টাইটেল"
                value={form.hero_subtitle || ""}
                multiline
                onSave={(v) => saveSettingsField("hero_subtitle", v)}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "notice-bar" && (
        <div className="space-y-6">
          <SectionCard
            title="চলমান নোটিশ বার"
            hint="হোমপেজের একদম উপরে এই লেখাগুলো স্ক্রল হয়ে চলবে। খালি রাখলে বার দেখাবে না।"
            toggle={{
              checked: isSectionEnabled("website_notice_bar"),
              onChange: (v) => setSectionToggle("website_notice_bar", v),
            }}
          >
            <InlineListField
              label="নোটিশ লেখা"
              values={(form.notice_bar_text || "").split("\n").map((v) => v.trim()).filter(Boolean)}
              maxItems={20}
              placeholder="যেমনঃ আগামী ১৫ই রমজান থেকে ভর্তি কার্যক্রম শুরু হবে।"
              onSave={(list) => saveSettingsField("notice_bar_text", list.join("\n"))}
            />

            <div className="mt-3 max-w-xs rounded-xl border border-gray-100 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">গতি (স্পিড)</label>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                  {form.notice_bar_speed ?? 20}s
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={form.notice_bar_speed ?? 20}
                onChange={(e) => setForm((prev) => ({ ...prev, notice_bar_speed: Number(e.target.value) }))}
                onMouseUp={(e) => saveSettingsField("notice_bar_speed", Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => saveSettingsField("notice_bar_speed", Number((e.target as HTMLInputElement).value))}
                className="mt-2 w-full accent-blue-600"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">কম মান = দ্রুত স্ক্রল, বেশি মান = ধীর স্ক্রল</p>
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "muhtamim" && (
        <div className="space-y-6">
          <SectionCard
            title="মুহতামিম সাহেবের বাণী"
            toggle={{
              checked: isSectionEnabled("website_muhtamim_message"),
              onChange: (v) => setSectionToggle("website_muhtamim_message", v),
            }}
          >
            <div className="space-y-2">
              <InlineTextField
                label="নাম"
                value={form.muhtamim_name || ""}
                placeholder="মাওলানা মুহাম্মদ ..."
                onSave={(v) => saveSettingsField("muhtamim_name", v)}
              />
              <InlineTextField
                label="পদবি"
                value={form.muhtamim_designation || ""}
                placeholder="মুহতামিম ও শায়খুল হাদীস"
                onSave={(v) => saveSettingsField("muhtamim_designation", v)}
              />
              <InlineImageField
                label="মুহতামিম সাহেবের ছবি"
                value={form.muhtamim_photo}
                folder="branding"
                onSave={(v) => saveSettingsField("muhtamim_photo", v)}
              />
              <InlineTextField
                label="বাণী"
                value={form.muhtamim_message || ""}
                multiline
                rows={6}
                placeholder="মুহতামিম সাহেবের বাণী লিখুন..."
                onSave={(v) => saveSettingsField("muhtamim_message", v)}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "social" && (
        <div className="space-y-6">
          <SectionCard
            title="সোশ্যাল মিডিয়া লিংক"
            hint="খালি রাখলে সেই আইকনটি পাবলিক ওয়েবসাইটের ফুটার ও WhatsApp বাটনে দেখাবে না।"
            toggle={{
              checked: isSectionEnabled("website_social_links"),
              onChange: (v) => setSectionToggle("website_social_links", v),
            }}
          >
            <div className="space-y-2">
              <InlineTextField
                label="ফেসবুক পেজ URL"
                value={form.facebook_url || ""}
                placeholder="https://facebook.com/yourpage"
                onSave={(v) => saveSettingsField("facebook_url", v)}
              />
              <InlineTextField
                label="ইউটিউব চ্যানেল URL"
                value={form.youtube_url || ""}
                placeholder="https://youtube.com/@yourchannel"
                onSave={(v) => saveSettingsField("youtube_url", v)}
              />
              <InlineTextField
                label="ইনস্টাগ্রাম প্রোফাইল URL"
                value={form.instagram_url || ""}
                placeholder="https://instagram.com/yourprofile"
                onSave={(v) => saveSettingsField("instagram_url", v)}
              />
              <InlineTextField
                label="WhatsApp চ্যানেল URL"
                value={form.whatsapp_channel_url || ""}
                placeholder="https://whatsapp.com/channel/..."
                onSave={(v) => saveSettingsField("whatsapp_channel_url", v)}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "pages" && (
        <div className="space-y-6">
          <SectionCard
            title="পেজ কন্টেন্ট"
            hint="আমাদের সম্পর্কে, ভর্তি তথ্য ও যোগাযোগ পেজের লেখা এখান থেকে সম্পাদনা করুন"
            toggle={{
              checked: isSectionEnabled("website_page_content"),
              onChange: (v) => setSectionToggle("website_page_content", v),
            }}
          >
            <div className="space-y-3">
              {pages.map((page, index) =>
                editingPageIndex === index && pageDraft ? (
                  <div key={page.page_key} className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <Input
                      value={pageDraft.title}
                      onChange={(e) =>
                        setPageDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                      }
                      className="max-w-sm"
                    />
                    <textarea
                      className={`${textAreaClass} mt-3`}
                      rows={5}
                      value={pageDraft.content || ""}
                      onChange={(e) =>
                        setPageDraft((prev) => (prev ? { ...prev, content: e.target.value } : prev))
                      }
                    />
                    <PublishAndSaveActions
                      published={pageDraft.is_published !== 0}
                      onPublishedChange={(v) =>
                        setPageDraft((prev) => (prev ? { ...prev, is_published: v ? 1 : 0 } : prev))
                      }
                      saving={savingPage}
                      onCancel={cancelEditPage}
                      onSave={savePage}
                    />
                  </div>
                ) : (
                  <div
                    key={page.page_key}
                    className="group rounded-xl border border-gray-100 p-4 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100">{page.title}</h3>
                          {page.is_published === 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              অপ্রকাশিত
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-gray-600 dark:text-slate-400">
                          {page.content?.trim() ? (
                            page.content
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500">কোনো কন্টেন্ট যোগ করা হয়নি</span>
                          )}
                        </p>
                      </div>
                      {editingPageIndex === null && (
                        <button
                          type="button"
                          onClick={() => startEditPage(index)}
                          className="shrink-0 rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                          title="সম্পাদনা"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "notices" && (
        <div className="space-y-6">
          <SectionCard
            title="নতুন নোটিশ যোগ করুন"
            toggle={{
              checked: isSectionEnabled("website_notice_add"),
              onChange: (v) => setSectionToggle("website_notice_add", v),
            }}
          >
            <form onSubmit={submitNotice} className="space-y-3">
              <Input
                value={noticeDraft.title || ""}
                onChange={(e) => setNoticeDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="নোটিশের শিরোনাম"
              />
              <textarea
                className={textAreaClass}
                rows={3}
                value={noticeDraft.content || ""}
                onChange={(e) => setNoticeDraft((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="নোটিশের বিস্তারিত"
              />
              <PublishAndSubmitAction
                published={noticeDraft.is_published !== 0}
                onPublishedChange={(v) => setNoticeDraft((prev) => ({ ...prev, is_published: v ? 1 : 0 }))}
                saving={savingNotice}
              />
            </form>
          </SectionCard>

          <SectionCard
            title="সব নোটিশ"
            hint="যেকোনো তথ্যের পাশের পেন্সিল আইকনে ক্লিক করলে সেটি এডিট করা যাবে"
            toggle={{
              checked: isSectionEnabled("website_notice_list"),
              onChange: (v) => setSectionToggle("website_notice_list", v),
            }}
          >
            {notices.length ? (
              <div className="space-y-3">
                {notices.map((notice) =>
                  editingNoticeId === notice.id && noticeEditDraft ? (
                    <div key={notice.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                      <Input
                        value={noticeEditDraft.title || ""}
                        onChange={(e) =>
                          setNoticeEditDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                        }
                        placeholder="নোটিশের শিরোনাম"
                      />
                      <textarea
                        className={`${textAreaClass} mt-3`}
                        rows={3}
                        value={noticeEditDraft.content || ""}
                        onChange={(e) =>
                          setNoticeEditDraft((prev) => (prev ? { ...prev, content: e.target.value } : prev))
                        }
                        placeholder="নোটিশের বিস্তারিত"
                      />
                      <PublishAndSaveActions
                        published={noticeEditDraft.is_published !== 0}
                        onPublishedChange={(v) =>
                          setNoticeEditDraft((prev) => (prev ? { ...prev, is_published: v ? 1 : 0 } : prev))
                        }
                        saving={savingNoticeEdit}
                        onCancel={cancelEditNotice}
                        onSave={saveNoticeEdit}
                      />
                    </div>
                  ) : (
                    <div
                      key={notice.id}
                      className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100">{notice.title}</h3>
                          {notice.is_published === 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              খসড়া / অপ্রকাশিত
                            </span>
                          )}
                        </div>
                        {notice.content && (
                          <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-slate-400">{notice.content}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditNotice(notice)}
                          className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                          title="সম্পাদনা"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeNotice(notice)}
                          className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="মুছুন"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <EmptyState title="এখনো কোনো নোটিশ যোগ করা হয়নি" hint="উপরের ফর্ম থেকে প্রথম নোটিশটি যোগ করুন।" />
            )}
          </SectionCard>
        </div>
      )}

      {tab === "gallery" && (
        <div className="space-y-6">
          <SectionCard
            title="নতুন ছবি যোগ করুন"
            toggle={{
              checked: isSectionEnabled("website_gallery_add"),
              onChange: (v) => setSectionToggle("website_gallery_add", v),
            }}
          >
            <form onSubmit={submitGallery} className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="max-w-xs">
                  <BrandImageBox
                    label="ছবি"
                    folder="gallery"
                    value={galleryDraft.image_url}
                    onChange={(url) => setGalleryDraft((prev) => ({ ...prev, image_url: url }))}
                    onRemove={() => setGalleryDraft((prev) => ({ ...prev, image_url: "" }))}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={fieldLabelClass}>ছবির শিরোনাম</label>
                    <Input
                      value={galleryDraft.title || ""}
                      onChange={(e) => setGalleryDraft((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="যেমন: বার্ষিক সমাবর্তন ২০২৬"
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>ক্রম (অবস্থান)</label>
                    <select
                      value={galleryDraft.sort_order || gallery.length + 1}
                      onChange={(e) =>
                        setGalleryDraft((prev) => ({ ...prev, sort_order: Number(e.target.value) }))
                      }
                      className={selectFieldClass}
                    >
                      {Array.from({ length: gallery.length + 1 }, (_, i) => i + 1).map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                          {pos === gallery.length + 1 ? " (সবার শেষে)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <PublishAndSubmitAction
                published={galleryDraft.is_published !== 0}
                onPublishedChange={(v) => setGalleryDraft((prev) => ({ ...prev, is_published: v ? 1 : 0 }))}
                saving={savingGallery}
              />
            </form>
          </SectionCard>

          <SectionCard
            title="সব ছবি"
            hint="যেকোনো ছবির পেন্সিল আইকনে ক্লিক করলে সেটি এডিট করা যাবে"
            toggle={{
              checked: isSectionEnabled("website_gallery_list"),
              onChange: (v) => setSectionToggle("website_gallery_list", v),
            }}
          >
            {gallery.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {gallery.map((item) =>
                  editingGalleryId === item.id && galleryEditDraft ? (
                    <div key={item.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                      <div className="max-w-xs">
                        <BrandImageBox
                          label="ছবি"
                          folder="gallery"
                          value={galleryEditDraft.image_url}
                          onChange={(url) =>
                            setGalleryEditDraft((prev) => (prev ? { ...prev, image_url: url } : prev))
                          }
                          onRemove={() =>
                            setGalleryEditDraft((prev) => (prev ? { ...prev, image_url: "" } : prev))
                          }
                        />
                      </div>
                      <div className="mt-3">
                        <label className={fieldLabelClass}>ছবির শিরোনাম</label>
                        <Input
                          value={galleryEditDraft.title || ""}
                          onChange={(e) =>
                            setGalleryEditDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                          }
                        />
                      </div>
                      <div className="mt-3">
                        <label className={fieldLabelClass}>ক্রম (অবস্থান)</label>
                        <select
                          value={galleryEditDraft.sort_order || gallery.length}
                          onChange={(e) =>
                            setGalleryEditDraft((prev) =>
                              prev ? { ...prev, sort_order: Number(e.target.value) } : prev,
                            )
                          }
                          className={selectFieldClass}
                        >
                          {gallery.map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                      <PublishAndSaveActions
                        published={galleryEditDraft.is_published !== 0}
                        onPublishedChange={(v) =>
                          setGalleryEditDraft((prev) => (prev ? { ...prev, is_published: v ? 1 : 0 } : prev))
                        }
                        saving={savingGalleryEdit}
                        onCancel={cancelEditGalleryItem}
                        onSave={saveGalleryEdit}
                      />
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className="group rounded-xl border border-gray-100 p-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                      <img
                        src={item.image_url}
                        alt={item.title || "Gallery"}
                        className="h-32 w-full rounded-lg object-cover"
                      />
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-slate-100">{item.title || "গ্যালারি ছবি"}</p>
                          {item.is_published === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">অপ্রকাশিত</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditGalleryItem(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                            title="সম্পাদনা"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGalleryItem(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title="মুছুন"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <EmptyState title="এখনো কোনো গ্যালারি ছবি যোগ করা হয়নি" hint="উপরের ফর্ম থেকে প্রথম ছবিটি যোগ করুন।" />
            )}
          </SectionCard>
        </div>
      )}

      {tab === "slider" && (
        <div className="space-y-6">
          <SectionCard
            title="নতুন স্লাইড যোগ করুন"
            toggle={{
              checked: isSectionEnabled("website_slider_add"),
              onChange: (v) => setSectionToggle("website_slider_add", v),
            }}
          >
            <p className="-mt-2 mb-3 text-xs text-gray-500 dark:text-slate-400">
              প্রস্তাবিত ছবির সাইজ: 1600 x 900px (16:9, landscape) — সব ডিভাইসে ঠিকভাবে ফিট হবে।
            </p>
            <form onSubmit={submitSlide} className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="max-w-xs">
                  <BrandImageBox
                    label="স্লাইড ছবি"
                    folder="gallery"
                    shape="wide"
                    value={slideDraft.image_url}
                    onChange={(url) => setSlideDraft((prev) => ({ ...prev, image_url: url }))}
                    onRemove={() => setSlideDraft((prev) => ({ ...prev, image_url: "" }))}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={fieldLabelClass}>শিরোনাম</label>
                    <Input
                      value={slideDraft.title || ""}
                      onChange={(e) => setSlideDraft((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>সাব-টাইটেল</label>
                    <Input
                      value={slideDraft.subtitle || ""}
                      onChange={(e) => setSlideDraft((prev) => ({ ...prev, subtitle: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>ক্রম (অবস্থান)</label>
                    <select
                      value={slideDraft.sort_order || slides.length + 1}
                      onChange={(e) =>
                        setSlideDraft((prev) => ({ ...prev, sort_order: Number(e.target.value) }))
                      }
                      className={selectFieldClass}
                    >
                      {Array.from({ length: slides.length + 1 }, (_, i) => i + 1).map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                          {pos === slides.length + 1 ? " (সবার শেষে)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <PublishAndSubmitAction
                published={slideDraft.is_published !== 0}
                onPublishedChange={(v) => setSlideDraft((prev) => ({ ...prev, is_published: v ? 1 : 0 }))}
                saving={savingSlide}
              />
            </form>
          </SectionCard>

          <SectionCard
            title="সব স্লাইড"
            hint="যেকোনো স্লাইডের পেন্সিল আইকনে ক্লিক করলে সেটি এডিট করা যাবে"
            toggle={{
              checked: isSectionEnabled("website_slider_list"),
              onChange: (v) => setSectionToggle("website_slider_list", v),
            }}
          >
            {slides.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {slides.map((item) =>
                  editingSlideId === item.id && slideEditDraft ? (
                    <div key={item.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                      <div className="max-w-xs">
                        <BrandImageBox
                          label="স্লাইড ছবি"
                          folder="gallery"
                          shape="wide"
                          value={slideEditDraft.image_url}
                          onChange={(url) =>
                            setSlideEditDraft((prev) => (prev ? { ...prev, image_url: url } : prev))
                          }
                          onRemove={() =>
                            setSlideEditDraft((prev) => (prev ? { ...prev, image_url: "" } : prev))
                          }
                        />
                      </div>
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className={fieldLabelClass}>শিরোনাম</label>
                          <Input
                            value={slideEditDraft.title || ""}
                            onChange={(e) =>
                              setSlideEditDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                            }
                          />
                        </div>
                        <div>
                          <label className={fieldLabelClass}>সাব-টাইটেল</label>
                          <Input
                            value={slideEditDraft.subtitle || ""}
                            onChange={(e) =>
                              setSlideEditDraft((prev) => (prev ? { ...prev, subtitle: e.target.value } : prev))
                            }
                          />
                        </div>
                        <div>
                          <label className={fieldLabelClass}>ক্রম (অবস্থান)</label>
                          <select
                            value={slideEditDraft.sort_order || slides.length}
                            onChange={(e) =>
                              setSlideEditDraft((prev) =>
                                prev ? { ...prev, sort_order: Number(e.target.value) } : prev,
                              )
                            }
                            className={selectFieldClass}
                          >
                            {slides.map((_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <PublishAndSaveActions
                        published={slideEditDraft.is_published !== 0}
                        onPublishedChange={(v) =>
                          setSlideEditDraft((prev) => (prev ? { ...prev, is_published: v ? 1 : 0 } : prev))
                        }
                        saving={savingSlideEdit}
                        onCancel={cancelEditSlide}
                        onSave={saveSlideEdit}
                      />
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className="group rounded-xl border border-gray-100 p-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                      <img
                        src={item.image_url}
                        alt={item.title || "Slide"}
                        className="h-32 w-full rounded-lg object-cover"
                      />
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-slate-100">
                            {item.title || "শিরোনামহীন স্লাইড"}
                          </p>
                          {item.subtitle && <p className="truncate text-xs text-gray-500 dark:text-slate-400">{item.subtitle}</p>}
                          {item.is_published === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">অপ্রকাশিত</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditSlide(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                            title="সম্পাদনা"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSlide(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title="মুছুন"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <EmptyState title="এখনো কোনো স্লাইড যোগ করা হয়নি" hint="স্লাইড যোগ করলে হোমপেজে স্লাইডার হিসেবে দেখা যাবে।" />
            )}
          </SectionCard>
        </div>
      )}

      {tab === "committee" && (
        <div className="space-y-6">
          <SectionCard
            title="নতুন সদস্য যোগ করুন"
            toggle={{
              checked: isSectionEnabled("website_committee_add"),
              onChange: (v) => setSectionToggle("website_committee_add", v),
            }}
          >
            <form onSubmit={submitCommitteeMember} className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="max-w-[9rem]">
                  <BrandImageBox
                    label="ছবি"
                    folder="gallery"
                    value={committeeDraft.photo_url}
                    onChange={(url) => setCommitteeDraft((prev) => ({ ...prev, photo_url: url }))}
                    onRemove={() => setCommitteeDraft((prev) => ({ ...prev, photo_url: "" }))}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={fieldLabelClass}>নাম</label>
                    <Input
                      value={committeeDraft.name || ""}
                      onChange={(e) => setCommitteeDraft((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>পদবি</label>
                    <Input
                      value={committeeDraft.designation || ""}
                      onChange={(e) =>
                        setCommitteeDraft((prev) => ({ ...prev, designation: e.target.value }))
                      }
                      placeholder="যেমন: সভাপতি"
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>ফোন (ঐচ্ছিক)</label>
                    <Input
                      value={committeeDraft.phone || ""}
                      onChange={(e) => setCommitteeDraft((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <PublishAndSubmitAction
                published={committeeDraft.is_published !== 0}
                onPublishedChange={(v) => setCommitteeDraft((prev) => ({ ...prev, is_published: v ? 1 : 0 }))}
                saving={savingCommittee}
              />
            </form>
          </SectionCard>

          <SectionCard
            title="কমিটির সদস্যরা"
            hint="যেকোনো সদস্যের পেন্সিল আইকনে ক্লিক করলে সেটি এডিট করা যাবে"
            toggle={{
              checked: isSectionEnabled("website_committee_list"),
              onChange: (v) => setSectionToggle("website_committee_list", v),
            }}
          >
            {committee.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {committee.map((item) =>
                  editingCommitteeId === item.id && committeeEditDraft ? (
                    <div
                      key={item.id}
                      className="sm:col-span-2 lg:col-span-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20"
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="max-w-[9rem]">
                          <BrandImageBox
                            label="ছবি"
                            folder="gallery"
                            value={committeeEditDraft.photo_url}
                            onChange={(url) =>
                              setCommitteeEditDraft((prev) => (prev ? { ...prev, photo_url: url } : prev))
                            }
                            onRemove={() =>
                              setCommitteeEditDraft((prev) => (prev ? { ...prev, photo_url: "" } : prev))
                            }
                          />
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className={fieldLabelClass}>নাম</label>
                            <Input
                              value={committeeEditDraft.name || ""}
                              onChange={(e) =>
                                setCommitteeEditDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                              }
                            />
                          </div>
                          <div>
                            <label className={fieldLabelClass}>পদবি</label>
                            <Input
                              value={committeeEditDraft.designation || ""}
                              onChange={(e) =>
                                setCommitteeEditDraft((prev) =>
                                  prev ? { ...prev, designation: e.target.value } : prev,
                                )
                              }
                              placeholder="যেমন: সভাপতি"
                            />
                          </div>
                          <div>
                            <label className={fieldLabelClass}>ফোন (ঐচ্ছিক)</label>
                            <Input
                              value={committeeEditDraft.phone || ""}
                              onChange={(e) =>
                                setCommitteeEditDraft((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <PublishAndSaveActions
                        published={committeeEditDraft.is_published !== 0}
                        onPublishedChange={(v) =>
                          setCommitteeEditDraft((prev) => (prev ? { ...prev, is_published: v ? 1 : 0 } : prev))
                        }
                        saving={savingCommitteeEdit}
                        onCancel={cancelEditCommitteeMember}
                        onSave={saveCommitteeEdit}
                      />
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                      {item.photo_url ? (
                        <img
                          src={item.photo_url}
                          alt={item.name}
                          className="h-14 w-14 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                          {item.name?.[0] || "?"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900 dark:text-slate-100">{item.name}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-slate-400">{item.designation}</p>
                        {item.is_published === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">অপ্রকাশিত</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditCommitteeMember(item)}
                          className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                          title="সম্পাদনা"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCommitteeMember(item)}
                          className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="মুছুন"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <EmptyState title="এখনো কোনো কমিটির সদস্য যোগ করা হয়নি" hint="কমিটির সদস্য যোগ করলে পাবলিক ওয়েবসাইটে দেখা যাবে।" />
            )}
          </SectionCard>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
