import ResponsiveSettingsMenu from "../../../components/settings/ResponsiveSettingsMenu";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { commonText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { confirmWebsiteReset } from "@madrasha/shared-ui/src/website/confirmWebsiteReset";
import { websiteText } from "./website.text";
import { Link, useSearchParams } from "react-router-dom";
import DonationSettings from "./DonationSettings";
import WebsiteSettingsSkeleton, { websiteSettingsContentClass, websiteSettingsGridClass } from "./WebsiteSettingsSkeleton";
import {
  Award,
  Bell,
  ExternalLink,
  FileText,
  GalleryHorizontalEnd,
  Heart,
  Globe,
  Images,
  Link2,
  Megaphone,
  Palette,
  Pencil,
  Plus,
  Quote,
  RotateCcw,
  Settings2,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import GalleryImageDialog from "./GalleryImageDialog";
import WebsiteItemDialog, { WebsiteAddCard } from "./WebsiteItemDialog";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import SectionCard from "../../../components/settings/SectionCard";
import { ToggleSwitch } from "../../../components/settings/ToggleSwitch";
import InlineTextField from "../../../components/settings/InlineTextField";
import InlineListField from "../../../components/settings/InlineListField";
import InlineImageField from "../../../components/settings/InlineImageField";
import { CLOUD_NOT_CONFIGURED_MSG, isPendingCloudUpload } from "../../../utils/cloudUpload";
import {
  deleteWebsiteCommitteeMember,
  deleteWebsiteGalleryItem,
  deleteWebsiteNotice,
  deleteWebsiteSlide,
  deleteWebsiteVideo,
  getWebsiteSettings,
  getDonationSettings,
  resetOwnWebsite,
  saveWebsiteCommitteeMember,
  saveWebsiteGalleryItem,
  saveWebsiteNotice,
  saveWebsitePage,
  saveWebsiteSettings,
  saveWebsiteSlide,
  saveWebsiteVideo,
  type WebsiteCommitteeMemberPayload,
  type WebsiteGalleryPayload,
  type WebsiteNoticePayload,
  type WebsitePagePayload,
  type WebsiteSettingsPayload,
  type WebsiteSlidePayload,
  type WebsiteVideoPayload,
} from "../../../services/websiteApi";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { getPublicSiteUrl } from "../../../utils/publicSiteUrl";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

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
  theme_key: "modern",
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
  show_sovapoti: 1,
  sovapoti_name: "",
  sovapoti_designation: "",
  sovapoti_photo: "",
  sovapoti_message: "",
  show_video_gallery: 1,
  notice_bar_text: "",
  notice_bar_speed: 20,
  facebook_url: "",
  youtube_url: "",
  instagram_url: "",
  whatsapp_channel_url: "",
  map_url: "",
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
const emptyVideo: WebsiteVideoPayload = { title: "", video_url: "", is_published: 1, sort_order: 0 };

/** YouTube লিংক থেকে thumbnail URL বের করে - admin এ ভিডিও লিস্টে ছবির মতো প্রিভিউ
 * দেখাতে (আপলোড করা কোনো থাম্বনেইল ফাইল নেই, শুধু ভিডিও লিংক সংরক্ষণ করা হয়)। */
function youtubeThumbnail(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

const toggleFields: Array<[keyof WebsiteSettingsPayload, string, string]> = [
  ["show_notice_bar", "চলমান নোটিশ বার", "নেভবারের নিচে স্ক্রলিং নোটিশ বার দেখাবে"],
  ["show_slider", "হোম স্লাইডার", "হোমপেজে ছবির স্লাইডার দেখাবে"],
  ["show_about", "আমাদের সম্পর্কে", "মাদ্রাসার পরিচিতি সেকশন দেখাবে"],
  ["show_muhtamim", "মুহতামিমের বাণী", "মুহতামিম সাহেবের বাণী সেকশন দেখাবে"],
  ["show_sovapoti", "সভাপতির বাণী", "সভাপতি সাহেবের বাণী সেকশন দেখাবে"],
  ["show_admission", "ভর্তি তথ্য", "ভর্তি সংক্রান্ত সেকশন দেখাবে"],
  ["show_notices", "নোটিশ বোর্ড", "নোটিশ বোর্ড সেকশন দেখাবে"],
  ["show_gallery", "গ্যালারি", "ছবি গ্যালারি সেকশন দেখাবে"],
  ["show_video_gallery", "ভিডিও গ্যালারি", "ভিডিও গ্যালারি সেকশন দেখাবে"],
  ["show_teachers", "শিক্ষকমণ্ডলী", "শিক্ষকদের তালিকা সেকশন দেখাবে"],
  ["show_committee", "মাদ্রাসা কমিটি", "কমিটির সদস্যদের তালিকা দেখাবে"],
  ["show_contact", "যোগাযোগ", "যোগাযোগ তথ্য সেকশন দেখাবে"],
];

type TabKey =
  | "donations"
  | "general"
  | "appearance"
  | "notice-bar"
  | "notices"
  | "gallery"
  | "video"
  | "slider"
  | "muhtamim"
  | "sovapoti"
  | "committee"
  | "pages";

type WebsiteThemeKey = import("@madrasha/shared-ui/src/website/themes").WebsiteThemeKey;

import { WEBSITE_THEMES } from "@madrasha/shared-ui/src/website/themes";
import WebsiteThemePreview from "@madrasha/shared-ui/src/website/WebsiteThemePreview";

const websiteThemes = WEBSITE_THEMES.map((theme) => ({ key: theme.key, name: theme.bn, description: theme.descriptionBn }));

const ThemeMiniPreview = WebsiteThemePreview;

/** থিম বাছাইয়ের রেডিও-গ্রুপ - নেটিভ radio ইনপুট (sr-only) ব্যবহার করায় কিবোর্ডের
 * তীর-চিহ্ন/ট্যাব ও স্ক্রিন-রিডার এমনিতেই কাজ করে। সংরক্ষণ শেষ হওয়ার আগেই নির্বাচন দেখানো হয়,
 * ব্যর্থ হলে আগের মানে ফিরে যায়। */
function WebsiteThemePicker({
  value,
  accent,
  onSave,
}: {
  value: WebsiteThemeKey;
  accent: string;
  onSave: (v: WebsiteThemeKey) => Promise<void>;
}) {
  const t = useText(websiteText);
  const [pending, setPending] = useState<WebsiteThemeKey | null>(null);
  const selected = pending ?? value;

  const choose = async (next: WebsiteThemeKey) => {
    if (pending || next === selected) return;
    setPending(next);
    try {
      await onSave(next);
    } catch {
      // saveSettingsField ইতিমধ্যে টোস্ট দেখিয়েছে
    } finally {
      setPending(null);
    }
  };

  return (
    <div role="radiogroup" aria-label={t.websiteTheme} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {websiteThemes.map((theme) => {
        const active = selected === theme.key;
        return (
          <label
            key={theme.key}
            className={`relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-blue-500/40 ${
              active
                ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-950/30"
                : "border-gray-200 hover:border-gray-300 dark:border-slate-700 dark:hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              name="website_theme_key"
              value={theme.key}
              checked={active}
              disabled={pending !== null}
              onChange={() => choose(theme.key)}
              className="sr-only"
            />
            <div className="h-20 overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
              <ThemeMiniPreview themeKey={theme.key} accent={accent} />
            </div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  active ? "border-blue-500 bg-blue-500" : "border-gray-300 dark:border-slate-600"
                }`}
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t.themes[theme.key]?.[0] ?? theme.name}</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-500 dark:text-slate-400">{t.themes[theme.key]?.[1] ?? theme.description}</p>
          </label>
        );
      })}
    </div>
  );
}

export default function AdminWebsiteSettingsPage() {
  const t = useText(websiteText);
  const lang = useLang();
  const c = useText(commonText);
  const user = useAuthStore((s) => s.user);
  const slug = useAuthStore((s) => s.madrasaSlug) || "";
  const toast = useToastStore((s) => s.show);

  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TabKey>(searchParams.get("tab") === "donations" ? "donations" : "general");
  const [donationAllowed, setDonationAllowed] = useState(false);
  useEffect(() => {
    let current = true;
    getDonationSettings().then((data) => { if (current) setDonationAllowed(data.allowed === true); }).catch(() => {});
    return () => { current = false; };
  }, []);

  const [form, setForm] = useState<WebsiteSettingsPayload>(defaultSettings);
  // Mirrors `form` synchronously so queued saves always read the latest
  // committed values instead of a stale render-time closure.
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  // Every field/toggle save PUTs the *entire* settings object (the backend
  // has no partial-update endpoint), so concurrent saves must be serialized
  // — otherwise a slower request can overwrite a faster one's change with
  // stale data for the fields it doesn't own.
  const settingsSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [pages, setPages] = useState<WebsitePagePayload[]>(defaultPages);
  const [notices, setNotices] = useState<WebsiteNoticePayload[]>([]);
  const [gallery, setGallery] = useState<WebsiteGalleryPayload[]>([]);
  const [videos, setVideos] = useState<WebsiteVideoPayload[]>([]);
  const [slides, setSlides] = useState<WebsiteSlidePayload[]>([]);
  const [committee, setCommittee] = useState<WebsiteCommitteeMemberPayload[]>([]);

  const [noticeDraft, setNoticeDraft] = useState<WebsiteNoticePayload>(emptyNotice);
  const [galleryDraft, setGalleryDraft] = useState<WebsiteGalleryPayload>(emptyGallery);
  const [galleryAddOpen, setGalleryAddOpen] = useState(false);
  const [itemAddOpen, setItemAddOpen] = useState<TabKey | null>(null);
  const [videoDraft, setVideoDraft] = useState<WebsiteVideoPayload>(emptyVideo);
  const [slideDraft, setSlideDraft] = useState<WebsiteSlidePayload>(emptySlide);
  const [committeeDraft, setCommitteeDraft] = useState<WebsiteCommitteeMemberPayload>(emptyCommittee);

  const [savingNotice, setSavingNotice] = useState(false);
  const [savingGallery, setSavingGallery] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);
  const [savingSlide, setSavingSlide] = useState(false);
  const [savingCommittee, setSavingCommittee] = useState(false);

  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const resettingRef = useRef(false);
  const resetSuccessKey = `website-reset-success:${user?.madrasa_id}`;
  useEffect(() => {
    if (loading || !user?.madrasa_id) return;
    if (sessionStorage.getItem(resetSuccessKey) === "1") {
      sessionStorage.removeItem(resetSuccessKey);
      toast(t.resetSuccess, "success", { duration: 7000 });
    }
  }, [loading, user?.madrasa_id, resetSuccessKey, toast, t.resetSuccess]);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);

  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);
  const [pageDraft, setPageDraft] = useState<WebsitePagePayload | null>(null);
  const [savingPage, setSavingPage] = useState(false);

  // Add and edit actions share a dialog for each content type.
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [noticeEditDraft, setNoticeEditDraft] = useState<WebsiteNoticePayload | null>(null);
  const [savingNoticeEdit, setSavingNoticeEdit] = useState(false);

  const [editingGalleryId, setEditingGalleryId] = useState<number | null>(null);
  const [galleryEditDraft, setGalleryEditDraft] = useState<WebsiteGalleryPayload | null>(null);
  const [savingGalleryEdit, setSavingGalleryEdit] = useState(false);

  const [editingVideoId, setEditingVideoId] = useState<number | null>(null);
  const [videoEditDraft, setVideoEditDraft] = useState<WebsiteVideoPayload | null>(null);
  const [savingVideoEdit, setSavingVideoEdit] = useState(false);

  const [editingSlideId, setEditingSlideId] = useState<number | null>(null);
  const [slideEditDraft, setSlideEditDraft] = useState<WebsiteSlidePayload | null>(null);
  const [savingSlideEdit, setSavingSlideEdit] = useState(false);

  const [editingCommitteeId, setEditingCommitteeId] = useState<number | null>(null);
  const [committeeEditDraft, setCommitteeEditDraft] = useState<WebsiteCommitteeMemberPayload | null>(
    null,
  );
  const [savingCommitteeEdit, setSavingCommitteeEdit] = useState(false);

  const publicUrl = useMemo(
    () => getPublicSiteUrl(slug, (form as any).custom_domain),
    [slug, (form as any).custom_domain],
  );

  useEffect(() => {
    setLoading(true);
    getWebsiteSettings(user?.madrasa_id)
      .then((data) => {
        if (data?.madrasa) {
          setForm((prev) => ({ ...prev, ...data.settings, ...data.madrasa, social_links: data.settings?.social_links }));
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
        if (Array.isArray(data?.videos)) setVideos(data.videos);
        if (Array.isArray(data?.slides)) setSlides(data.slides);
        if (Array.isArray(data?.committee)) setCommittee(data.committee);
      })
      .catch((err) => {
        logger.error("LOAD WEBSITE SETTINGS ERROR:", err);
        toast(t.loadFailed, "error");
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
    if (resettingRef.current) return Promise.reject(new Error(t.resetInProgress));
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

  const websiteSaving = Boolean(savingNotice || savingGallery || savingVideo || savingSlide || savingCommittee || savingToggle || savingPage || savingNoticeEdit || savingGalleryEdit || savingVideoEdit || savingSlideEdit || savingCommitteeEdit);

  const resetWebsite = () => {
    if (resettingRef.current || loading || websiteSaving) return;
    confirmWebsiteReset({
      institutionName: form.name || t.resetInstitutionFallback,
      lang,
      onConfirm: async (password) => {
        if (resettingRef.current) return;
        resettingRef.current = true;
        setResetting(true);
        try {
          // Finish queued field saves before replacing the site's content.
          await settingsSaveQueueRef.current;
          await resetOwnWebsite(password);
          // Carry the success notification through the full settings reload.
          sessionStorage.setItem(resetSuccessKey, "1");
          // Reload all settings, lists and drafts from the saved demo.
          window.location.reload();
        } catch (err: any) {
          resettingRef.current = false;
          setResetting(false);
          toast(err?.response?.data?.message || t.resetFailed, "error");
          throw err;
        }
      },
    });
  };

  const saveSettingsField = async (key: keyof WebsiteSettingsPayload, value: string | number) => {
    try {
      await queueSettingsSave({ [key]: value } as Partial<WebsiteSettingsPayload>);
      toast(t.saved, "success");
    } catch (err) {
      logger.error("SAVE WEBSITE SETTINGS FIELD ERROR:", err);
      toast(t.saveFailed, "error");
      throw err;
    }
  };

  const handleToggle = async (key: keyof WebsiteSettingsPayload, checked: boolean) => {
    const nextValue = checked ? 1 : 0;
    setForm((prev) => ({ ...prev, [key]: nextValue })); // optimistic UI only
    setSavingToggle(String(key));
    try {
      await queueSettingsSave({ [key]: nextValue } as Partial<WebsiteSettingsPayload>);
      toast(t.updated, "success");
    } catch (err) {
      logger.error("SAVE WEBSITE TOGGLE ERROR:", err);
      setForm(formRef.current); // revert to the last known-good server state
      toast(t.updateFailed, "error");
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
      toast(t.pageSaved, "success");
      setEditingPageIndex(null);
      setPageDraft(null);
    } catch (err) {
      logger.error("SAVE WEBSITE PAGE ERROR:", err);
      toast(t.pageSaveFailed, "error");
    } finally {
      setSavingPage(false);
    }
  };

  // ---------- Notices ----------
  const submitNotice = async () => {
    if (!noticeDraft.title?.trim()) {
      toast(t.enterNoticeTitle, "error");
      return;
    }
    setSavingNotice(true);
    try {
      const saved = await saveWebsiteNotice(noticeDraft);
      setNotices((prev) => [saved.data, ...prev]);
      setNoticeDraft(emptyNotice);
      setItemAddOpen(null);
      toast(t.noticeAdded, "success");
    } catch (err) {
      logger.error("SAVE NOTICE ERROR:", err);
      toast(t.noticeSaveFailed, "error");
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
      toast(t.enterNoticeTitle, "error");
      return;
    }
    setSavingNoticeEdit(true);
    try {
      const saved = await saveWebsiteNotice(noticeEditDraft);
      setNotices((prev) => prev.map((n) => (n.id === saved.data.id ? saved.data : n)));
      toast(t.noticeUpdated, "success");
      cancelEditNotice();
    } catch (err) {
      logger.error("SAVE NOTICE ERROR:", err);
      toast(t.noticeSaveFailed, "error");
    } finally {
      setSavingNoticeEdit(false);
    }
  };

  const removeNotice = (notice: WebsiteNoticePayload) => {
    if (!notice.id) return;
    useConfirmStore.getState().show({
      title: t.deleteNoticeTitle,
      message: t.deleteNoticeMessage(notice.title),
      confirmText: c.delete,
      danger: true,
      onConfirm: async () => {
        try {
          await deleteWebsiteNotice(notice.id!);
          setNotices((prev) => prev.filter((n) => n.id !== notice.id));
          if (editingNoticeId === notice.id) cancelEditNotice();
          toast(t.noticeDeleted, "success");
        } catch (err) {
          logger.error("DELETE NOTICE ERROR:", err);
          toast(t.noticeDeleteFailed, "error");
        }
      },
    });
  };

  // ---------- Video Gallery ----------
  const submitVideo = async () => {
    if (!videoDraft.video_url?.trim()) {
      toast(t.enterVideoLink, "error");
      return;
    }
    const chosenPosition = videoDraft.sort_order || videos.length + 1;
    setSavingVideo(true);
    try {
      const appendOrder = Math.max(0, ...videos.map((item) => item.sort_order ?? 0)) + 1;
      const saved = await saveWebsiteVideo({ ...videoDraft, sort_order: appendOrder });
      const previousItems = [...videos, saved.data];
      const nextVideos = reorderBySortOrder(previousItems, saved.data.id!, chosenPosition);
      await Promise.all(nextVideos
        .filter((item) => item.sort_order !== previousItems.find((previous) => previous.id === item.id)?.sort_order)
        .map((item) => saveWebsiteVideo(item)));
      setVideos(nextVideos.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setVideoDraft(emptyVideo);
      setItemAddOpen(null);
      toast(t.videoAdded, "success");
    } catch (err) {
      logger.error("SAVE VIDEO ERROR:", err);
      toast(t.videoSaveFailed, "error");
    } finally {
      setSavingVideo(false);
    }
  };

  const startEditVideo = (item: WebsiteVideoPayload) => {
    setEditingVideoId(item.id!);
    const position = videos.findIndex((v) => v.id === item.id) + 1;
    setVideoEditDraft({ ...item, sort_order: position || videos.length });
  };

  const cancelEditVideo = () => {
    setEditingVideoId(null);
    setVideoEditDraft(null);
  };

  const saveVideoEdit = async () => {
    if (!videoEditDraft) return;
    if (!videoEditDraft.video_url?.trim()) {
      toast(t.enterVideoLink, "error");
      return;
    }
    const desiredPosition = videoEditDraft.sort_order || videos.length;
    const originalItem = videos.find((v) => v.id === videoEditDraft.id);
    setSavingVideoEdit(true);
    try {
      const saved = await saveWebsiteVideo({ ...videoEditDraft, sort_order: originalItem?.sort_order });
      let nextVideos = videos.map((item) => (item.id === saved.data.id ? saved.data : item));
      const currentPosition = nextVideos.findIndex((item) => item.id === saved.data.id) + 1;

      if (desiredPosition !== currentPosition) {
        nextVideos = reorderBySortOrder(nextVideos, saved.data.id, desiredPosition);
        await Promise.all(
          nextVideos.map((item) => saveWebsiteVideo(item)),
        );
      }

      setVideos(nextVideos.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      toast(t.videoUpdated, "success");
      cancelEditVideo();
    } catch (err) {
      logger.error("SAVE VIDEO ERROR:", err);
      toast(t.videoSaveFailed, "error");
    } finally {
      setSavingVideoEdit(false);
    }
  };

  const removeVideo = (item: WebsiteVideoPayload) => {
    if (!item.id) return;
    useConfirmStore.getState().show({
      title: t.deleteVideoTitle,
      message: t.deleteItemMessage(item.title || t.thisVideo),
      confirmText: c.delete,
      danger: true,
      onConfirm: async () => {
        try {
          await deleteWebsiteVideo(item.id!);
          setVideos((prev) => prev.filter((v) => v.id !== item.id));
          if (editingVideoId === item.id) cancelEditVideo();
          toast(t.videoDeleted, "success");
        } catch (err) {
          logger.error("DELETE VIDEO ERROR:", err);
          toast(t.videoDeleteFailed, "error");
        }
      },
    });
  };

  // ---------- Gallery ----------
  const submitGallery = async () => {
    if (!galleryDraft.image_url?.trim()) {
      toast(t.uploadImage, "error");
      return;
    }
    if (isPendingCloudUpload(galleryDraft.image_url)) {
      toast(CLOUD_NOT_CONFIGURED_MSG, "error");
      return;
    }
    const chosenPosition = galleryDraft.sort_order || gallery.length + 1;
    setSavingGallery(true);
    try {
      const appendOrder = Math.max(0, ...gallery.map((item) => item.sort_order ?? 0)) + 1;
      const saved = await saveWebsiteGalleryItem({ ...galleryDraft, sort_order: appendOrder });
      const previousGallery = [...gallery, saved.data];
      const nextGallery = reorderBySortOrder(previousGallery, saved.data.id!, chosenPosition);
      await Promise.all(
        nextGallery
          .filter((item) => item.sort_order !== previousGallery.find((previous) => previous.id === item.id)?.sort_order)
          .map((item) => saveWebsiteGalleryItem(item)),
      );
      setGallery(nextGallery.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setGalleryDraft(emptyGallery);
      setGalleryAddOpen(false);
      toast(t.galleryAdded, "success");
    } catch (err) {
      logger.error("SAVE GALLERY ERROR:", err);
      toast(t.imageSaveFailed, "error");
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
      toast(t.uploadImage, "error");
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
          nextGallery.map((item) => saveWebsiteGalleryItem(item)),
        );
      }

      setGallery(nextGallery.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      toast(t.galleryUpdated, "success");
      cancelEditGalleryItem();
    } catch (err) {
      logger.error("SAVE GALLERY ERROR:", err);
      toast(t.imageSaveFailed, "error");
    } finally {
      setSavingGalleryEdit(false);
    }
  };

  const removeGalleryItem = (item: WebsiteGalleryPayload) => {
    if (!item.id) return;
    useConfirmStore.getState().show({
      title: t.deleteGalleryTitle,
      message: t.deleteItemMessage(item.title || t.thisImage),
      confirmText: c.delete,
      danger: true,
      onConfirm: async () => {
        try {
          await deleteWebsiteGalleryItem(item.id!);
          setGallery((prev) => prev.filter((g) => g.id !== item.id));
          if (editingGalleryId === item.id) cancelEditGalleryItem();
          toast(t.imageDeleted, "success");
        } catch (err) {
          logger.error("DELETE GALLERY ERROR:", err);
          toast(t.imageDeleteFailed, "error");
        }
      },
    });
  };

  // ---------- Hero slides ----------
  const submitSlide = async () => {
    if (!slideDraft.image_url?.trim()) {
      toast(t.uploadSlideImage, "error");
      return;
    }
    if (isPendingCloudUpload(slideDraft.image_url)) {
      toast(CLOUD_NOT_CONFIGURED_MSG, "error");
      return;
    }
    const chosenPosition = slideDraft.sort_order || slides.length + 1;
    setSavingSlide(true);
    try {
      const appendOrder = Math.max(0, ...slides.map((item) => item.sort_order ?? 0)) + 1;
      const saved = await saveWebsiteSlide({ ...slideDraft, sort_order: appendOrder });
      const previousItems = [...slides, saved.data];
      const nextSlides = reorderBySortOrder(previousItems, saved.data.id!, chosenPosition);
      await Promise.all(nextSlides
        .filter((item) => item.sort_order !== previousItems.find((previous) => previous.id === item.id)?.sort_order)
        .map((item) => saveWebsiteSlide(item)));
      setSlides(nextSlides.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setSlideDraft(emptySlide);
      setItemAddOpen(null);
      toast(t.slideAdded, "success");
    } catch (err) {
      logger.error("SAVE SLIDE ERROR:", err);
      toast(t.slideSaveFailed, "error");
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
      toast(t.uploadSlideImage, "error");
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
          nextSlides.map((item) => saveWebsiteSlide(item)),
        );
      }

      setSlides(nextSlides.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      toast(t.slideUpdated, "success");
      cancelEditSlide();
    } catch (err) {
      logger.error("SAVE SLIDE ERROR:", err);
      toast(t.slideSaveFailed, "error");
    } finally {
      setSavingSlideEdit(false);
    }
  };

  const removeSlide = (item: WebsiteSlidePayload) => {
    if (!item.id) return;
    useConfirmStore.getState().show({
      title: t.deleteSlideTitle,
      message: t.deleteSlideMessage,
      confirmText: c.delete,
      danger: true,
      onConfirm: async () => {
        try {
          await deleteWebsiteSlide(item.id!);
          setSlides((prev) => prev.filter((s) => s.id !== item.id));
          if (editingSlideId === item.id) cancelEditSlide();
          toast(t.slideDeleted, "success");
        } catch (err) {
          logger.error("DELETE SLIDE ERROR:", err);
          toast(t.slideDeleteFailed, "error");
        }
      },
    });
  };

  // ---------- Committee ----------
  const submitCommitteeMember = async () => {
    if (!committeeDraft.name?.trim()) {
      toast(t.enterMemberName, "error");
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
      setItemAddOpen(null);
      toast(t.memberAdded, "success");
    } catch (err) {
      logger.error("SAVE COMMITTEE ERROR:", err);
      toast(t.saveFailed, "error");
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
      toast(t.enterMemberName, "error");
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
      toast(t.memberUpdated, "success");
      cancelEditCommitteeMember();
    } catch (err) {
      logger.error("SAVE COMMITTEE ERROR:", err);
      toast(t.saveFailed, "error");
    } finally {
      setSavingCommitteeEdit(false);
    }
  };

  const removeCommitteeMember = (item: WebsiteCommitteeMemberPayload) => {
    if (!item.id) return;
    useConfirmStore.getState().show({
      title: t.deleteMemberTitle,
      message: t.deleteMemberMessage(item.name),
      confirmText: c.delete,
      danger: true,
      onConfirm: async () => {
        try {
          await deleteWebsiteCommitteeMember(item.id!);
          setCommittee((prev) => prev.filter((m) => m.id !== item.id));
          if (editingCommitteeId === item.id) cancelEditCommitteeMember();
          toast(t.memberDeleted, "success");
        } catch (err) {
          logger.error("DELETE COMMITTEE ERROR:", err);
          toast(t.deleteFailed, "error");
        }
      },
    });
  };

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Settings2; badge?: number }> = [
    { key: "general", label: t.tabs["general"], icon: Settings2 },
    { key: "appearance", label: t.tabs["appearance"], icon: Palette },
    { key: "notice-bar", label: t.tabs["notice-bar"], icon: Megaphone },
    { key: "notices", label: t.tabs["notices"], icon: Bell, badge: notices.length },
    { key: "gallery", label: t.tabs["gallery"], icon: Images, badge: gallery.length },
    { key: "video", label: t.tabs["video"], icon: Video, badge: videos.length },
    { key: "slider", label: t.tabs["slider"], icon: GalleryHorizontalEnd, badge: slides.length },
    { key: "muhtamim", label: t.tabs["muhtamim"], icon: Quote },
    { key: "sovapoti", label: t.tabs["sovapoti"], icon: Award },
    { key: "committee", label: t.tabs["committee"], icon: Users, badge: committee.length },
    { key: "pages", label: t.pageContent, icon: FileText },
    ...(donationAllowed ? [{ key: "donations" as const, label: lang === "bn" ? "অনুদান" : "Donations", icon: Heart }] : []),
  ];

  if (loading) {
    return <WebsiteSettingsSkeleton tab={tab} menuCount={tabs.length} />;
  }

  return (
    <fieldset disabled={resetting} className="min-w-0 space-y-6 pb-8 md:pb-12">
      <div className={websiteSettingsGridClass}>
        <ResponsiveSettingsMenu
          title={t.settingsMenu}
          activeLabel={tabs.find((item) => item.key === tab)?.label ?? t.settingsMenu}
          activeIcon={tabs.find((item) => item.key === tab)?.icon}
        >
            {tabs.map(({ key, label, icon: Icon, badge }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setTab(key)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-start text-sm transition ${
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
        </ResponsiveSettingsMenu>

        <div className={websiteSettingsContentClass}>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-600/30 active:translate-y-0"
          >
            {t.viewWebsite}
            <ExternalLink
              size={15}
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        }
      />

      {tab === "general" && <div
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
              <span className="text-sm font-bold text-gray-900 dark:text-slate-100">{t.websitePublished}</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  (form.is_published as number) !== 0
                    ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                }`}
              >
                {(form.is_published as number) !== 0 ? t.live : t.offline}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
              {t.masterSwitchHint}
            </p>
          </div>
        </div>
        {savingToggle === "is_published" ? (
          <span className="shrink-0 text-xs text-gray-400 dark:text-slate-500">{c.saving}</span>
        ) : (
          <ToggleSwitch
            checked={(form.is_published as number) !== 0}
            onChange={(v) => handleToggle("is_published", v)}
          />
        )}
      </div>}

      {tab === "donations" && <DonationSettings />}
      {tab === "general" && (
        <div className="space-y-6">
          <SectionCard
            title={t.sectionVisibility}
            hint={t.sectionVisibilityHint}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {toggleFields.map(([key]) => [key, ...(t.sections[String(key)] ?? ["", ""])] as const).map(([key, label, hint]) => (
                <div
                  key={String(key)}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-slate-700"
                >
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-slate-100">{label}</span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{hint}</span>
                  </span>
                  {savingToggle === String(key) ? (
                    <span className="text-xs text-gray-400 dark:text-slate-500">{c.saving}</span>
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
            title={t.institutionInfoLogo}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t.brandingNoteBefore}{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">{t.brandingSettings}</span>{" "}
              {t.brandingNoteAfter}
            </p>
            <Link
              to={`/settings/branding`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              {t.editInBranding}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </SectionCard>

          <SectionCard
            title={t.websiteTheme}
            hint={t.themeHint}
          >
            <WebsiteThemePicker
              value={websiteThemes.find((t) => t.key === form.theme_key)?.key ?? "modern"}
              accent={form.theme_color || "#2563eb"}
              onSave={(v) => saveSettingsField("theme_key", v)}
            />
          </SectionCard>

          <SectionCard
            title={t.themeColor}
          >
            <InlineTextField
              label={t.themeColor}
              value={form.theme_color || "#2563eb"}
              type="color"
              onSave={(v) => saveSettingsField("theme_color", v)}
            />
          </SectionCard>

          <SectionCard
            title={t.homeBanner}
          >
            <div className="space-y-2">
              <InlineTextField
                label={t.heroTitle}
                value={form.hero_title || ""}
                placeholder={t.heroTitlePlaceholder}
                onSave={(v) => saveSettingsField("hero_title", v)}
              />
              <InlineTextField
                label={t.heroSubtitle}
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
            title={t.noticeBar}
            hint={t.noticeBarHint}
          >
            <InlineListField
              label={t.noticeText}
              values={(form.notice_bar_text || "").split("\n").map((v) => v.trim()).filter(Boolean)}
              maxItems={20}
              placeholder={t.noticeTextPlaceholder}
              onSave={(list) => saveSettingsField("notice_bar_text", list.join("\n"))}
            />

            <div className="mt-3 max-w-xs rounded-xl border border-gray-100 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">{t.speed}</label>
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
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t.speedHint}</p>
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "muhtamim" && (
        <div className="space-y-6">
          <SectionCard
            title={t.headMessage}
          >
            <div className="space-y-2">
              <InlineTextField
                label={c.name}
                value={form.muhtamim_name || ""}
                placeholder={t.headNamePlaceholder}
                onSave={(v) => saveSettingsField("muhtamim_name", v)}
              />
              <InlineTextField
                label={t.designation}
                value={form.muhtamim_designation || ""}
                placeholder={t.headDesignationPlaceholder}
                onSave={(v) => saveSettingsField("muhtamim_designation", v)}
              />
              <InlineImageField
                label={t.headPhoto}
                value={form.muhtamim_photo}
                folder="branding"
                onSave={(v) => saveSettingsField("muhtamim_photo", v)}
              />
              <InlineTextField
                label={t.message}
                value={form.muhtamim_message || ""}
                multiline
                rows={6}
                placeholder={t.headMessagePlaceholder}
                onSave={(v) => saveSettingsField("muhtamim_message", v)}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "sovapoti" && (
        <div className="space-y-6">
          <SectionCard
            title={t.presidentMessage}
          >
            <div className="space-y-2">
              <InlineTextField
                label={c.name}
                value={form.sovapoti_name || ""}
                placeholder={t.presidentNamePlaceholder}
                onSave={(v) => saveSettingsField("sovapoti_name", v)}
              />
              <InlineTextField
                label={t.designation}
                value={form.sovapoti_designation || ""}
                placeholder={t.presidentDesignationPlaceholder}
                onSave={(v) => saveSettingsField("sovapoti_designation", v)}
              />
              <InlineImageField
                label={t.presidentPhoto}
                value={form.sovapoti_photo}
                folder="branding"
                onSave={(v) => saveSettingsField("sovapoti_photo", v)}
              />
              <InlineTextField
                label={t.message}
                value={form.sovapoti_message || ""}
                multiline
                rows={6}
                placeholder={t.presidentMessagePlaceholder}
                onSave={(v) => saveSettingsField("sovapoti_message", v)}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "pages" && (
        <div className="space-y-6">
          {pageDraft && createPortal(<WebsiteItemDialog open={editingPageIndex !== null && !!pageDraft} title={c.edit + " · " + t.pageContent} editing draft={pageDraft} original={editingPageIndex === null ? undefined : pages[editingPageIndex]} fields={[{ key: "title", label: t.contentTitle, required: true }, { key: "content", label: t.pageContent, type: "textarea" }]} saving={savingPage} icon={FileText} onChange={(patch) => setPageDraft(previous => previous ? { ...previous, ...patch } : previous)} onClose={cancelEditPage} onSubmit={savePage} />, document.body)}
          <SectionCard
            title={t.pageContent}
            hint={t.pageContentHint}
          >
            <div className="space-y-3">
              {pages.map((page, index) =>
(
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
                              {t.unpublished}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-gray-600 dark:text-slate-400">
                          {page.content?.trim() ? (
                            page.content
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500">{t.noContent}</span>
                          )}
                        </p>
                      </div>
                      {editingPageIndex === null && (
                        <button
                          type="button"
                          onClick={() => startEditPage(index)}
                          className="shrink-0 rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                          title={c.edit}
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
          {createPortal(<WebsiteItemDialog
            open={itemAddOpen === "notices" || editingNoticeId !== null}
            title={editingNoticeId !== null ? c.edit + " · " + t.tabs["notices"] : t.addNotice}
            editing={editingNoticeId !== null} icon={Bell}
            draft={noticeEditDraft ?? noticeDraft}
            original={editingNoticeId === null ? undefined : notices.find(item => item.id === editingNoticeId)}
            fields={[{ key: "title", label: t.noticeTitlePlaceholder, required: true, placeholder: t.noticeTitlePlaceholder }, { key: "content", label: t.noticeDetailsPlaceholder, type: "textarea" }]}
            positions={notices.length + (editingNoticeId === null ? 1 : 0)}
            saving={savingNotice || savingNoticeEdit}

            onChange={(patch) => { if (editingNoticeId !== null) setNoticeEditDraft(previous => previous ? { ...previous, ...patch } : previous); else setNoticeDraft(previous => ({ ...previous, ...patch })); }}
            onClose={() => { setItemAddOpen(null); cancelEditNotice(); }}
            onSubmit={async () => { if (editingNoticeId !== null) await saveNoticeEdit(); else await submitNotice(); }}
          />, document.body)}

          <SectionCard
            title={t.allNotices}
            hint={t.allNoticesHint}
          >
              <div className="space-y-3">
                <WebsiteAddCard label={t.addNotice} onClick={() => setItemAddOpen("notices")} />
                {notices.map((notice) =>
(
                    <div
                      key={notice.id}
                      className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100">{notice.title}</h3>
                          {notice.is_published === 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              {t.draftUnpublished}
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
                          title={c.edit}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeNotice(notice)}
                          className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title={c.delete}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            {!notices.length && (
              <EmptyState title={t.noNotices} hint={t.noNoticesHint} />
            )}
          </SectionCard>
        </div>
      )}

      {tab === "gallery" && (
        <div className="space-y-6">
          {createPortal(<GalleryImageDialog
            open={galleryAddOpen || editingGalleryId !== null}
            editing={editingGalleryId !== null}
            draft={galleryEditDraft ?? galleryDraft}
            original={editingGalleryId === null ? undefined : {
              ...gallery.find((item) => item.id === editingGalleryId)!,
              sort_order: gallery.findIndex((item) => item.id === editingGalleryId) + 1,
            }}
            count={gallery.length}
            saving={savingGallery || savingGalleryEdit}
            onChange={(patch) => {
              if (editingGalleryId !== null) setGalleryEditDraft((previous) => previous ? { ...previous, ...patch } : previous);
              else setGalleryDraft((previous) => ({ ...previous, ...patch }));
            }}
            onClose={() => { setGalleryAddOpen(false); cancelEditGalleryItem(); }}
            onSubmit={async () => {
              if (editingGalleryId !== null) await saveGalleryEdit();
              else await submitGallery();
            }}
          />, document.body)}

          <SectionCard
            title={t.allImages}
            hint={t.allImagesHint}
            badge={gallery.length}
          >
              <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-3 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setGalleryAddOpen(true)}
                  aria-haspopup="dialog"
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-3 text-center transition hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-blue-900 dark:bg-blue-950/20 dark:hover:border-blue-500 dark:hover:bg-blue-950/40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300"><Plus size={18} /></span>
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{t.addImage}</span>
                </button>
                {gallery.map((item) => (
                    <div
                      key={item.id}
                      className="group min-w-0 rounded-xl border border-gray-100 p-2 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                      <img
                        src={item.image_url}
                        alt={item.title || "Gallery"}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-slate-100">{item.title || t.galleryImage}</p>
                          {item.is_published === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">{t.unpublished}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditGalleryItem(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                            title={c.edit}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGalleryItem(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title={c.delete}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            {!gallery.length && (
              <EmptyState title={t.noGallery} hint={t.noGalleryHint} />
            )}
          </SectionCard>
        </div>
      )}

      {tab === "video" && (
        <div className="space-y-6">
          {createPortal(<WebsiteItemDialog
            open={itemAddOpen === "video" || editingVideoId !== null}
            title={editingVideoId !== null ? c.edit + " · " + t.tabs["video"] : t.addVideo}
            editing={editingVideoId !== null} icon={Video}
            draft={videoEditDraft ?? videoDraft}
            original={editingVideoId === null ? undefined : { ...videos.find(item => item.id === editingVideoId)!, sort_order: videos.findIndex(item => item.id === editingVideoId) + 1 }}
            fields={[{ key: "video_url", label: t.videoLink, required: true, placeholder: "https://youtube.com/watch?v=..." }, { key: "title", label: t.videoTitle, placeholder: t.videoTitlePlaceholder }, { key: "sort_order", label: t.position, type: "position" }]}
            positions={videos.length + (editingVideoId === null ? 1 : 0)}
            saving={savingVideo || savingVideoEdit}
            previewUrl={youtubeThumbnail((videoEditDraft ?? videoDraft).video_url)}
            onChange={(patch) => { if (editingVideoId !== null) setVideoEditDraft(previous => previous ? { ...previous, ...patch } : previous); else setVideoDraft(previous => ({ ...previous, ...patch })); }}
            onClose={() => { setItemAddOpen(null); cancelEditVideo(); }}
            onSubmit={async () => { if (editingVideoId !== null) await saveVideoEdit(); else await submitVideo(); }}
          />, document.body)}

          <SectionCard
            title={t.allVideos}
            hint={t.allVideosHint}
          >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <WebsiteAddCard label={t.addVideo} onClick={() => setItemAddOpen("video")} />
                {videos.map((item) =>
(
                    <div
                      key={item.id}
                      className="group rounded-xl border border-gray-100 p-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                      {youtubeThumbnail(item.video_url) ? (
                        <img
                          src={youtubeThumbnail(item.video_url)!}
                          alt={item.title || "Video"}
                          className="h-32 w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-32 w-full items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                          <Video size={28} />
                        </div>
                      )}
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-slate-100">{item.title || t.video}</p>
                          {item.is_published === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">{t.unpublished}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditVideo(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                            title={c.edit}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeVideo(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title={c.delete}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            {!videos.length && (
              <EmptyState title={t.noVideos} hint={t.noVideosHint} />
            )}
          </SectionCard>
        </div>
      )}

      {tab === "slider" && (
        <div className="space-y-6">
          {createPortal(<WebsiteItemDialog
            open={itemAddOpen === "slider" || editingSlideId !== null}
            title={editingSlideId !== null ? c.edit + " · " + t.tabs["slider"] : t.addSlide}
            editing={editingSlideId !== null} icon={GalleryHorizontalEnd}
            draft={slideEditDraft ?? slideDraft}
            original={editingSlideId === null ? undefined : { ...slides.find(item => item.id === editingSlideId)!, sort_order: slides.findIndex(item => item.id === editingSlideId) + 1 }}
            fields={[{ key: "button_link", label: t.linkOptional, placeholder: t.linkPlaceholder, hint: t.slideLinkHint }, { key: "sort_order", label: t.position, type: "position" }]}
            positions={slides.length + (editingSlideId === null ? 1 : 0)}
            saving={savingSlide || savingSlideEdit}
            image={{ key: "image_url", label: t.slideImage, hint: t.slideImageHint + " " + t.slideImageUploadLimit, ratio: t.ratio219, resizeTo: { width: 2100, height: 900 } }}
            onChange={(patch) => { if (editingSlideId !== null) setSlideEditDraft(previous => previous ? { ...previous, ...patch } : previous); else setSlideDraft(previous => ({ ...previous, ...patch })); }}
            onClose={() => { setItemAddOpen(null); cancelEditSlide(); }}
            onSubmit={async () => { if (editingSlideId !== null) await saveSlideEdit(); else await submitSlide(); }}
          />, document.body)}

          <SectionCard
            title={t.allSlides}
            hint={t.allSlidesHint}
          >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <WebsiteAddCard label={t.addSlide} onClick={() => setItemAddOpen("slider")} />
                {slides.map((item) =>
(
                    <div
                      key={item.id}
                      className="group rounded-xl border border-gray-100 p-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                      <img
                        src={item.image_url}
                        alt="Slide"
                        className="aspect-[21/9] w-full rounded-lg object-cover"
                      />
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 truncate text-sm font-medium text-gray-700 dark:text-slate-300">
                            <Link2 size={13} className="shrink-0 text-gray-400 dark:text-slate-500" />
                            <span className="truncate">{item.button_link || t.noLink}</span>
                          </p>
                          {item.is_published === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">{t.unpublished}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditSlide(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                            title={c.edit}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSlide(item)}
                            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title={c.delete}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            {!slides.length && (
              <EmptyState title={t.noSlides} hint={t.noSlidesHint} />
            )}
          </SectionCard>
        </div>
      )}

      {tab === "committee" && (
        <div className="space-y-6">
          {createPortal(<WebsiteItemDialog
            open={itemAddOpen === "committee" || editingCommitteeId !== null}
            title={editingCommitteeId !== null ? c.edit + " · " + t.tabs["committee"] : t.addMember}
            editing={editingCommitteeId !== null} icon={Users}
            draft={committeeEditDraft ?? committeeDraft}
            original={editingCommitteeId === null ? undefined : committee.find(item => item.id === editingCommitteeId)}
            fields={[{ key: "name", label: c.name, required: true }, { key: "designation", label: t.designation, placeholder: t.designationPlaceholder }, { key: "phone", label: t.phoneOptional }]}
            positions={committee.length + (editingCommitteeId === null ? 1 : 0)}
            saving={savingCommittee || savingCommitteeEdit}
            image={{ key: "photo_url", label: c.photo, hint: t.memberImageHint }}
            onChange={(patch) => { if (editingCommitteeId !== null) setCommitteeEditDraft(previous => previous ? { ...previous, ...patch } : previous); else setCommitteeDraft(previous => ({ ...previous, ...patch })); }}
            onClose={() => { setItemAddOpen(null); cancelEditCommitteeMember(); }}
            onSubmit={async () => { if (editingCommitteeId !== null) await saveCommitteeEdit(); else await submitCommitteeMember(); }}
          />, document.body)}

          <SectionCard
            title={t.members}
            hint={t.membersHint}
          >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <WebsiteAddCard label={t.addMember} onClick={() => setItemAddOpen("committee")} />
                {committee.map((item) =>
(
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
                        {item.is_published === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">{t.unpublished}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditCommitteeMember(item)}
                          className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                          title={c.edit}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCommitteeMember(item)}
                          className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title={c.delete}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            {!committee.length && (
              <EmptyState title={t.noMembers} hint={t.noMembersHint} />
            )}
          </SectionCard>
        </div>
      )}

      {tab === "general" && <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900/50 dark:bg-red-950/10">
        <div className="max-w-xl">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.resetTitle}</h2>
          <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-400">{t.resetDescription}</p>
        </div>
        <Button type="button" variant="danger" disabled={loading || resetting || websiteSaving} onClick={resetWebsite}>
          <RotateCcw size={14} />{resetting ? t.resetInProgress : t.resetWebsite}
        </Button>
      </div>}
        </div>
      </div>
    </fieldset>
  );
}
