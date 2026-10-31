import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Globe2,
  Image,
  Images,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Monitor,
  Palette,
  Plus,
  Quote,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Video,
} from "lucide-react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { useLang } from "@madrasha/shared-ui/src/i18n";
import {
  getDefaultWebsiteTemplate,
  saveDefaultWebsiteTemplate,
  uploadWebsiteDemoImage,
} from "../../../services/websiteApi";
import type {
  TemplateItem,
  TemplateSettings,
  WebsiteTemplate,
} from "./websiteTemplate.types";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
type Tab =
  | "design"
  | "pages"
  | "slides"
  | "notices"
  | "gallery"
  | "leadership"
  | "committee"
  | "videos"
  | "sections";
type ListKey =
  "pages" | "slides" | "notices" | "gallery" | "committee" | "videos";
type Field = {
  key: string;
  bn: string;
  en: string;
  multiline?: boolean;
  image?: boolean;
  required?: boolean;
  max?: number;
  hint?: string;
};
const listFields: Record<ListKey, Field[]> = {
  pages: [
    { key: "title", bn: "শিরোনাম", en: "Title", required: true },
    {
      key: "content",
      bn: "বিস্তারিত",
      en: "Content",
      multiline: true,
      max: 50000,
    },
  ],
  slides: [
    {
      key: "imageUrl",
      bn: "স্লাইডের ছবি",
      en: "Slide image",
      image: true,
      required: true,
      max: 255,
    },
    {
      key: "buttonLink",
      bn: "ক্লিক করলে যে লিংকে যাবে",
      en: "Destination link",
      max: 255,
      hint: "/admission / #about / https://…",
    },
  ],
  notices: [
    { key: "title", bn: "নোটিশের শিরোনাম", en: "Notice title", required: true },
    { key: "content", bn: "বিস্তারিত", en: "Details", multiline: true },
  ],
  gallery: [
    { key: "title", bn: "ছবির শিরোনাম", en: "Caption" },
    {
      key: "imageUrl",
      bn: "ছবি",
      en: "Image",
      image: true,
      required: true,
      max: 255,
    },
  ],
  committee: [
    { key: "name", bn: "নাম", en: "Name", required: true },
    { key: "designation", bn: "পদবি", en: "Designation" },
    { key: "photoUrl", bn: "ছবি", en: "Photo", image: true, max: 255 },
    { key: "phone", bn: "মোবাইল নম্বর", en: "Phone", max: 20 },
  ],
  videos: [
    { key: "title", bn: "ভিডিওর শিরোনাম", en: "Video title" },
    {
      key: "videoUrl",
      bn: "ভিডিও লিংক",
      en: "Video URL",
      required: true,
      max: 255,
      hint: "https://www.youtube.com/watch?v=…",
    },
  ],
};
const sectionFields: [keyof TemplateSettings, string, string][] = [
  ["showSlider", "হোম স্লাইডার", "Home slider"],
  ["showNoticeBar", "চলমান নোটিশ", "Notice ticker"],
  ["showAbout", "প্রতিষ্ঠান পরিচিতি", "About institution"],
  ["showNotices", "নোটিশ বোর্ড", "Notice board"],
  ["showGallery", "ফটো গ্যালারি", "Photo gallery"],
  ["showTeachers", "শিক্ষকমণ্ডলী", "Teachers"],
  ["showMuhtamim", "প্রতিষ্ঠান প্রধানের বাণী", "Head's message"],
  ["showSovapoti", "সভাপতির বাণী", "Chairman's message"],
  ["showCommittee", "পরিচালনা পরিষদ", "Committee"],
  ["showVideoGallery", "ভিডিও গ্যালারি", "Video gallery"],
  ["showAdmission", "ভর্তি তথ্য", "Admission"],
  ["showContact", "যোগাযোগ", "Contact"],
];

function FieldInput({
  field,
  value,
  onChange,
  bn,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  bn: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fieldId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const latestChange = useRef(onChange);
  latestChange.current = onChange;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => setFailed(false), [value]);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploadError("");
    if (
      !/^image\/(jpeg|png|webp|gif)$/.test(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setUploadError(
        bn
          ? "১০ MB-এর মধ্যে JPG, PNG, WebP অথবা GIF ছবি দিন।"
          : "Choose a JPG, PNG, WebP or GIF image up to 10 MB.",
      );
      return;
    }
    setUploading(true);
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read image"));
        reader.readAsDataURL(file);
      });
      const url = await uploadWebsiteDemoImage(image);
      if (mounted.current) latestChange.current(url);
    } catch (error: unknown) {
      if (mounted.current)
        setUploadError(
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message ||
            (bn
              ? "ছবি আপলোড করা যায়নি। ছবির লিংক দিয়েও যোগ করতে পারেন।"
              : "Upload failed. You can also paste an image URL."),
        );
    } finally {
      if (mounted.current) setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const props = {
    id: fieldId,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    className: inputClass,
    required: field.required,
    maxLength: field.max ?? (field.multiline ? 20000 : 190),
  };
  return (
    <div className="block space-y-2">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        {bn ? field.bn : field.en}
        {field.required && <span className="ml-1 text-teal-600">*</span>}
      </label>
      {field.image && (
        <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
          {value && !failed ? (
            <img
              src={value}
              alt=""
              className="h-full w-full object-contain"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="text-center text-slate-400">
              <Image className="mx-auto mb-2" size={24} />
              <span className="text-xs">
                {bn ? "ছবির লিংক দিন" : "Enter an image URL"}
              </span>
            </div>
          )}
        </div>
      )}
      {field.multiline ? (
        <textarea {...props} rows={5} />
      ) : (
        <input
          {...props}
          placeholder={field.image ? "https://…" : field.hint}
        />
      )}
      {field.image && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            aria-label={bn ? `${field.bn} আপলোড` : `Upload ${field.en}`}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            className="!py-2 !text-xs"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {uploading
              ? bn
                ? "আপলোড হচ্ছে…"
                : "Uploading…"
              : bn
                ? "ছবি আপলোড"
                : "Upload image"}
          </Button>
          <span className="block text-xs text-slate-400">
            {bn
              ? "পাবলিক ছবির URL অথবা /images/… পাথ"
              : "Public image URL or /images/… path"}
          </span>
        </div>
      )}
      {uploadError && (
        <p role="alert" className="text-xs text-rose-600">
          {uploadError}
        </p>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30 ${checked ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-600"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

function TemplatePreview({
  data,
  bn,
  mobile,
}: {
  data: WebsiteTemplate;
  bn: boolean;
  mobile: boolean;
}) {
  const s = data.settings;
  const personalize = (text: string) =>
    text
      .split("{{institution_name}}")
      .join(bn ? "আপনার শিক্ষা প্রতিষ্ঠান" : "Your institution");
  const slide = data.slides.find((row) => row.isPublished === 1);
  const about = data.pages.find(
    (row) => row.pageKey === "about" && row.isPublished === 1,
  );
  return (
    <div
      className={`mx-auto overflow-hidden border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-200/40 transition-all dark:border-slate-700 ${mobile ? "max-w-[265px] rounded-[24px]" : "w-full rounded-xl"}`}
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <i className="h-1.5 w-1.5 rounded-full bg-rose-300" />
        <i className="h-1.5 w-1.5 rounded-full bg-amber-300" />
        <i className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
        <span className="ml-3 flex-1 rounded bg-white px-2 py-0.5 text-[8px] text-slate-400">
          your-institution.edu
        </span>
      </div>
      <div className="flex items-center gap-2 px-4 py-4">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ background: s.themeColor }}
        >
          <Globe2 size={18} />
        </div>
        <div>
          <strong className="text-xs">
            {bn ? "আপনার শিক্ষা প্রতিষ্ঠান" : "Your institution"}
          </strong>
          <p className="text-[8px] text-slate-400">
            {bn
              ? "জ্ঞান • নৈতিকতা • মানবিকতা"
              : "Knowledge • Character • Community"}
          </p>
        </div>
      </div>
      <div
        className="flex gap-3 px-4 py-2 text-[8px] text-white"
        style={{ background: s.themeColor }}
      >
        {(bn
          ? ["হোম", "পরিচিতি", "ভর্তি", "গ্যালারি", "যোগাযোগ"]
          : ["Home", "About", "Admission", "Gallery", "Contact"]
        ).map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {!!s.showNoticeBar && (
        <div className="truncate bg-amber-50 px-4 py-2 text-[8px] text-amber-800">
          {personalize(s.noticeBarText)}
        </div>
      )}
      <div className="relative h-36 overflow-hidden bg-teal-950">
        {!!s.showSlider && slide && (
          <img
            src={String(slide.imageUrl)}
            alt=""
            className="h-full w-full object-cover opacity-65"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-5 text-white">
          <span className="mb-2 text-[7px] uppercase tracking-[0.2em] text-teal-200">
            {bn ? "সুন্দর আগামীর প্রত্যয়" : "A brighter tomorrow"}
          </span>
          <h4 className="max-w-[230px] text-base font-bold leading-snug">
            {personalize(s.heroTitle)}
          </h4>
          <p className="mt-2 line-clamp-2 max-w-[230px] text-[8px] leading-relaxed text-white/75">
            {personalize(s.heroSubtitle)}
          </p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {!!s.showAbout && about && (
          <div>
            <h5
              className="mb-2 border-l-2 pl-2 text-[11px] font-bold"
              style={{ borderColor: s.themeColor }}
            >
              {about.title}
            </h5>
            <p className="line-clamp-4 text-[9px] leading-relaxed text-slate-500">
              {personalize(String(about.content))}
            </p>
          </div>
        )}
        {!!s.showNotices &&
          data.notices
            .filter((n) => n.isPublished)
            .slice(0, 2)
            .map((notice, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-slate-50 p-2"
              >
                <div className="rounded-md bg-teal-50 p-1.5 text-teal-700">
                  <Megaphone size={12} />
                </div>
                <span className="text-[9px]">
                  {personalize(String(notice.title))}
                </span>
              </div>
            ))}
        {!!s.showGallery && (
          <div className="grid grid-cols-2 gap-2">
            {data.gallery
              .filter((r) => r.isPublished)
              .slice(0, 2)
              .map((row, i) => (
                <img
                  key={i}
                  src={String(row.imageUrl)}
                  alt={String(row.title)}
                  className="h-20 w-full rounded-lg bg-slate-100 object-cover"
                />
              ))}
          </div>
        )}
        {!!s.showMuhtamim && s.muhtamimMessage && (
          <div className="rounded-xl border border-slate-100 p-3">
            <Quote size={14} style={{ color: s.themeColor }} />
            <p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-slate-500">
              {s.muhtamimMessage}
            </p>
            <p className="mt-2 text-[9px] font-semibold">{s.muhtamimName}</p>
          </div>
        )}
      </div>
      <div
        className="px-4 py-3 text-center text-[8px] text-white/75"
        style={{ background: s.themeColor }}
      >
        {bn
          ? "আপনার শিক্ষা প্রতিষ্ঠান • সর্বস্বত্ব সংরক্ষিত"
          : "Your institution • All rights reserved"}
      </div>
    </div>
  );
}

export default function WebsiteTemplateEditor() {
  const bn = useLang() === "bn";
  const tx = (b: string, e: string) => (bn ? b : e);
  const [data, setData] = useState<WebsiteTemplate | null>(null);
  const [saved, setSaved] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [tab, setTab] = useState<Tab>("design");
  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState(false);
  const dirty = !!data && JSON.stringify(data) !== saved;
  const load = () => {
    setLoading(true);
    setError("");
    getDefaultWebsiteTemplate()
      .then((result) => {
        setData(result.content);
        setSaved(JSON.stringify(result.content));
        setUpdatedAt(result.updatedAt);
      })
      .catch(() =>
        setError(
          tx(
            "ডেমো টেমপ্লেট লোড করা যায়নি। আবার চেষ্টা করুন।",
            "Could not load the demo template. Please retry.",
          ),
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const patch = (next: Partial<WebsiteTemplate>) => {
    setData((prev) => (prev ? { ...prev, ...next } : prev));
    setSuccess(false);
  };
  const setting = (key: keyof TemplateSettings, value: string | number) =>
    data && patch({ settings: { ...data.settings, [key]: value } });
  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const result = await saveDefaultWebsiteTemplate(data);
      setData(result.content);
      setSaved(JSON.stringify(result.content));
      setUpdatedAt(result.updatedAt);
      setSuccess(true);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setError(
        detail ||
          tx(
            "সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।",
            "Could not save. Please try again.",
          ),
      );
    } finally {
      setSaving(false);
    }
  };
  const tabs = [
    {
      id: "design",
      icon: Palette,
      bn: "ডিজাইন ও পরিচিতি",
      en: "Design & identity",
    },
    { id: "pages", icon: FileText, bn: "ওয়েবসাইটের পেজ", en: "Website pages" },
    { id: "slides", icon: Image, bn: "হোম স্লাইডার", en: "Home slider" },
    { id: "notices", icon: Megaphone, bn: "নোটিশ বোর্ড", en: "Notice board" },
    { id: "gallery", icon: Images, bn: "ফটো গ্যালারি", en: "Photo gallery" },
    {
      id: "leadership",
      icon: Quote,
      bn: "প্রধান ও সভাপতির বাণী",
      en: "Leadership messages",
    },
    { id: "committee", icon: Users, bn: "পরিচালনা পরিষদ", en: "Committee" },
    { id: "videos", icon: Video, bn: "ভিডিও গ্যালারি", en: "Video gallery" },
    {
      id: "sections",
      icon: Settings2,
      bn: "সেকশন ও প্রকাশনা",
      en: "Sections & publishing",
    },
  ] as const;

  if (loading)
    return (
      <div className="flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="mr-3 animate-spin text-teal-600" size={22} />
        <span className="text-sm text-slate-500">
          {tx("ডেমো টেমপ্লেট লোড হচ্ছে…", "Loading demo template…")}
        </span>
      </div>
    );
  if (!data)
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
      >
        {error}
        <Button
          type="button"
          variant="secondary"
          onClick={load}
          className="ml-4"
        >
          <RefreshCw size={14} />
          {tx("আবার চেষ্টা করুন", "Retry")}
        </Button>
      </div>
    );
  const activeTab = tabs.find((item) => item.id === tab)!;
  const renderSetting = (field: Field) => (
    <FieldInput
      key={field.key}
      field={field}
      bn={bn}
      value={String(data.settings[field.key as keyof TemplateSettings])}
      onChange={(value) => setting(field.key as keyof TemplateSettings, value)}
    />
  );
  const listEditor = (key: ListKey) => {
    const rows = data[key];
    const update = (index: number, value: Partial<TemplateItem>) =>
      patch({
        [key]: rows.map((row, i) => (i === index ? { ...row, ...value } : row)),
      });
    const move = (index: number, offset: number) => {
      const next = [...rows];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      patch({
        [key]: next.map((row, i) => ({
          ...row,
          ...(key === "notices" ? {} : { sortOrder: i + 1 }),
        })),
      });
    };
    const max =
      key === "pages" ? 3 : key === "slides" || key === "videos" ? 20 : 30;
    const add = () => {
      const row: TemplateItem = {
        isPublished: 1,
        ...(key === "notices" ? {} : { sortOrder: rows.length + 1 }),
      };
      listFields[key].forEach((field) => (row[field.key] = ""));
      if (key === "pages")
        row.pageKey = ["about", "admission", "contact"].find(
          (page) => !rows.some((r) => r.pageKey === page),
        )!;
      patch({ [key]: [...rows, row] });
    };
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {rows.length} {tx("টি আইটেম", "items")}
          </p>
          <Button
            type="button"
            onClick={add}
            disabled={rows.length >= max}
            variant="secondary"
          >
            <Plus size={16} />
            {tx("নতুন যোগ করুন", "Add item")}
          </Button>
        </div>
        {!rows.length && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center dark:border-slate-700">
            <activeTab.icon className="mx-auto mb-3 text-teal-500" size={32} />
            <h4 className="font-medium text-slate-700 dark:text-slate-200">
              {tx("এখনো কোনো আইটেম নেই", "No items yet")}
            </h4>
            <p className="mt-2 text-xs text-slate-500">
              {tx(
                "নতুন আইটেম যোগ করে ডেমোটি সাজিয়ে নিন।",
                "Add your first item to complete the demo.",
              )}
            </p>
          </div>
        )}
        {rows.map((row, index) => (
          <Panel
            key={`${key}-${index}`}
            title={`${String(index + 1).padStart(2, "0")} · ${String(row.title || row.name || (key === "pages" ? row.pageKey : "")) || tx(activeTab.bn, activeTab.en)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <Toggle
                  checked={row.isPublished === 1}
                  label={tx("প্রকাশ করুন", "Publish item")}
                  onChange={() =>
                    update(index, { isPublished: row.isPublished ? 0 : 1 })
                  }
                />
                {tx("প্রকাশিত", "Published")}
              </label>
              <div className="flex items-center gap-1">
                {key !== "notices" && (
                  <>
                    <button
                      type="button"
                      title={tx("উপরে নিন", "Move up")}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-25 dark:hover:bg-slate-800"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      title={tx("নিচে নিন", "Move down")}
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-25 dark:hover:bg-slate-800"
                    >
                      <ArrowDown size={15} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  title={tx("মুছে ফেলুন", "Remove item")}
                  onClick={() =>
                    patch({ [key]: rows.filter((_, i) => i !== index) })
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {key === "pages" && (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {tx("পেজ", "Page")}
                </span>
                <select
                  className={inputClass}
                  value={row.pageKey}
                  onChange={(e) => update(index, { pageKey: e.target.value })}
                >
                  {[
                    ["about", "পরিচিতি", "About"],
                    ["admission", "ভর্তি", "Admission"],
                    ["contact", "যোগাযোগ", "Contact"],
                  ].map(([value, b, e]) => (
                    <option
                      key={value}
                      value={value}
                      disabled={rows.some(
                        (r, i) => i !== index && r.pageKey === value,
                      )}
                    >
                      {tx(b, e)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div
              className={`grid gap-5 ${key === "committee" ? "sm:grid-cols-2" : ""}`}
            >
              {listFields[key].map((field) => (
                <FieldInput
                  key={field.key}
                  bn={bn}
                  field={field}
                  value={String(row[field.key] || "")}
                  onChange={(value) => update(index, { [field.key]: value })}
                />
              ))}
            </div>
          </Panel>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[24px] bg-slate-950 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border-[40px] border-teal-500/10" />
        <div className="pointer-events-none absolute bottom-0 right-32 h-40 w-40 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-teal-200">
              <Sparkles size={12} />
              {tx("ওয়েবসাইট স্টুডিও", "WEBSITE STUDIO")}
            </span>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {tx(
                "প্রতিটি নতুন শুরু হোক সুন্দর",
                "A beautiful start for every institution",
              )}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
              {tx(
                "একবার ডেমো সাজান। নতুন মাদ্রাসার ওয়েবসাইট হবে প্রস্তুত—নিজস্ব নাম, সাজানো পেজ ও আপনার বাছাই করা কনটেন্ট নিয়ে।",
                "Design your starter website once. Every new institution begins with its own name, complete pages, and your carefully chosen content.",
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <LayoutTemplate
              size={35}
              className="text-teal-300"
              strokeWidth={1.25}
            />
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-teal-300" />
            {tx("স্বয়ংক্রিয় সেটআপ", "Automatic setup")}
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-teal-300" />
            {tx(
              "প্রতিষ্ঠানের নিজস্ব সম্পাদনা অক্ষত",
              "Existing edits preserved",
            )}
          </span>
          <span className="flex items-center gap-2">
            <Palette size={14} className="text-teal-300" />
            {tx("সম্পূর্ণ কাস্টমাইজযোগ্য", "Fully customizable")}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            Globe2,
            tx("স্বয়ংক্রিয় ডেমো", "Automatic demo"),
            data.enabled
              ? tx("চালু আছে", "Enabled")
              : tx("বন্ধ আছে", "Disabled"),
          ],
          [
            FileText,
            tx("পেজ ও মিডিয়া", "Pages & media"),
            String(
              data.pages.length +
                data.slides.length +
                data.gallery.length +
                data.videos.length,
            ),
          ],
          [
            CheckCircle2,
            tx("সর্বশেষ সংরক্ষণ", "Last saved"),
            updatedAt
              ? new Date(updatedAt).toLocaleDateString(bn ? "bn-BD" : "en-GB", {
                  timeZone: "Asia/Dhaka",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : tx("প্রাথমিক ডেমো", "Starter demo"),
          ],
        ].map(([Icon, label, value], i) => {
          const StatIcon = Icon as typeof Globe2;
          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                <StatIcon size={19} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500">{label as string}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">
                  {value as string}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-500"}`}
            />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {tx("ডিফল্ট ডেমো টেমপ্লেট", "Default demo template")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {dirty
                  ? tx("পরিবর্তন সংরক্ষণ করা হয়নি", "You have unsaved changes")
                  : tx(
                      "নতুন প্রতিষ্ঠানের জন্য প্রস্তুত",
                      "Ready for new institutions",
                    )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPreview(!preview)}
              className="xl:hidden"
            >
              <Eye size={16} />
              {tx("প্রিভিউ", "Preview")}
            </Button>
            <Button
              type="submit"
              disabled={saving || !dirty}
              className="!bg-teal-700 hover:!bg-teal-800"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : success ? (
                <Check size={16} />
              ) : (
                <Save size={16} />
              )}
              {saving
                ? tx("সংরক্ষণ হচ্ছে…", "Saving…")
                : tx("পরিবর্তন সংরক্ষণ", "Save changes")}
            </Button>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="mb-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800"
          >
            <CheckCircle2 size={17} />
            {tx(
              "ডেমো সংরক্ষিত হয়েছে। পরবর্তী নতুন মাদ্রাসায় এটি স্বয়ংক্রিয়ভাবে যুক্ত হবে।",
              "Demo saved. New institutions will automatically receive this template.",
            )}
          </p>
        )}
        <div className="grid items-start gap-5 xl:grid-cols-[190px_minmax(0,1fr)_320px] 2xl:grid-cols-[210px_minmax(0,1fr)_360px]">
          <nav
            aria-label={tx("টেমপ্লেট সেকশন", "Template sections")}
            className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-5 xl:flex-col"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-3 text-left text-xs font-medium transition ${tab === item.id ? "bg-teal-50 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"}`}
              >
                <item.icon size={16} className="shrink-0" />
                <span className="flex-1 whitespace-nowrap">
                  {tx(item.bn, item.en)}
                </span>
                {tab === item.id && (
                  <ChevronRight size={13} className="hidden xl:block" />
                )}
              </button>
            ))}
          </nav>
          <fieldset disabled={saving} className="min-w-0 space-y-5">
            <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3 text-xs leading-6 text-teal-800 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-200">
              {tx("লেখার মধ্যে", "Use")}{" "}
              <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                {"{{institution_name}}"}
              </code>{" "}
              {tx(
                "লিখলে স্বয়ংক্রিয়ভাবে নতুন প্রতিষ্ঠানের নাম বসবে।",
                "in your copy to automatically insert the institution's name.",
              )}
            </div>
            {tab === "design" && (
              <>
                <Panel
                  title={tx(
                    "প্রথম দেখায় সুন্দর",
                    "Make a great first impression",
                  )}
                  description={tx(
                    "হোমপেজের শিরোনাম, পরিচিতি ও ব্র্যান্ডের রঙ নির্ধারণ করুন।",
                    "Set the homepage headline, introduction, and brand color.",
                  )}
                >
                  {renderSetting({
                    key: "heroTitle",
                    bn: "মূল শিরোনাম",
                    en: "Hero headline",
                  })}
                  {renderSetting({
                    key: "heroSubtitle",
                    bn: "সংক্ষিপ্ত পরিচিতি",
                    en: "Introduction",
                    multiline: true,
                    max: 10000,
                  })}
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {tx("ব্র্যান্ডের রঙ", "Brand color")}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        "#0f766e",
                        "#2563eb",
                        "#4f46e5",
                        "#7c3aed",
                        "#be123c",
                        "#b45309",
                        "#1e293b",
                      ].map((color) => (
                        <button
                          key={color}
                          type="button"
                          title={color}
                          aria-pressed={data.settings.themeColor === color}
                          onClick={() => setting("themeColor", color)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200"
                          style={{ background: color }}
                        >
                          {data.settings.themeColor === color && (
                            <Check size={15} className="text-white" />
                          )}
                        </button>
                      ))}
                      <input
                        type="color"
                        aria-label={tx("নিজস্ব রঙ", "Custom color")}
                        value={data.settings.themeColor}
                        onChange={(e) => setting("themeColor", e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent"
                      />
                      <span className="ml-1 font-mono text-xs text-slate-400">
                        {data.settings.themeColor}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {tx("ওয়েবসাইটের থিম", "Website theme")}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["classic", "modern", "minimal"] as const).map(
                        (theme, i) => (
                          <button
                            key={theme}
                            type="button"
                            aria-pressed={data.settings.themeKey === theme}
                            onClick={() => setting("themeKey", theme)}
                            className={`rounded-xl border-2 p-2.5 text-left transition ${data.settings.themeKey === theme ? "border-teal-600 bg-teal-50/50 dark:bg-teal-950/30" : "border-slate-100 dark:border-slate-700"}`}
                          >
                            <div className="mb-2 space-y-1 rounded-md bg-slate-100 p-2 dark:bg-slate-800">
                              <div className="h-1.5 w-1/2 rounded bg-slate-300" />
                              <div
                                className={`h-6 ${i === 1 ? "rounded-lg" : i === 2 ? "border border-slate-300" : "rounded-sm"}`}
                                style={{
                                  background:
                                    i === 2
                                      ? "transparent"
                                      : data.settings.themeColor,
                                  opacity: 0.7,
                                }}
                              />
                              <div className="flex gap-1">
                                <i className="h-3 flex-1 rounded-sm bg-slate-200" />
                                <i className="h-3 flex-1 rounded-sm bg-slate-200" />
                              </div>
                            </div>
                            <span className="flex items-center justify-between text-[11px] font-medium capitalize text-slate-700 dark:text-slate-200">
                              {tx(["ক্ল্যাসিক", "মডার্ন", "মিনিমাল"][i], theme)}
                              {data.settings.themeKey === theme && (
                                <CheckCircle2
                                  size={12}
                                  className="text-teal-600"
                                />
                              )}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </Panel>
                <Panel title={tx("চলমান নোটিশ বার", "Notice ticker")}>
                  {renderSetting({
                    key: "noticeBarText",
                    bn: "নোটিশের লেখা",
                    en: "Ticker text",
                    multiline: true,
                    max: 10000,
                  })}
                  <label className="block text-sm text-slate-600 dark:text-slate-300">
                    {tx("স্ক্রল সময়", "Scroll duration")}:{" "}
                    {data.settings.noticeBarSpeed} {tx("সেকেন্ড", "seconds")}
                    <input
                      type="range"
                      min={5}
                      max={60}
                      value={data.settings.noticeBarSpeed}
                      onChange={(e) =>
                        setting("noticeBarSpeed", Number(e.target.value))
                      }
                      className="mt-3 w-full accent-teal-600"
                    />
                  </label>
                </Panel>
                <Panel
                  title={tx("সোশ্যাল লিংক ও মানচিত্র", "Social links & map")}
                  description={tx(
                    "প্রয়োজন হলে ডিফল্ট লিংক দিন; খালি রাখলে কোনো লিংক দেখাবে না।",
                    "Optional starter links. Leave empty to hide them.",
                  )}
                >
                  {[
                    { key: "facebookUrl", bn: "ফেসবুক", en: "Facebook" },
                    { key: "youtubeUrl", bn: "ইউটিউব", en: "YouTube" },
                    { key: "instagramUrl", bn: "ইনস্টাগ্রাম", en: "Instagram" },
                    {
                      key: "whatsappChannelUrl",
                      bn: "হোয়াটসঅ্যাপ চ্যানেল",
                      en: "WhatsApp channel",
                    },
                    {
                      key: "mapUrl",
                      bn: "মানচিত্রের লিংক",
                      en: "Map URL",
                      max: 500,
                    },
                  ].map((f) => renderSetting({ ...f, max: f.max ?? 255 }))}
                </Panel>
              </>
            )}
            {(
              [
                "pages",
                "slides",
                "notices",
                "gallery",
                "committee",
                "videos",
              ] as string[]
            ).includes(tab) && listEditor(tab as ListKey)}
            {tab === "leadership" &&
              (["muhtamim", "sovapoti"] as const).map((prefix) => (
                <Panel
                  key={prefix}
                  title={
                    prefix === "muhtamim"
                      ? tx("প্রতিষ্ঠান প্রধানের বাণী", "Head's message")
                      : tx("সভাপতির বাণী", "Chairman's message")
                  }
                >
                  {renderSetting({
                    key: `${prefix}Photo`,
                    bn: "ছবি",
                    en: "Photo",
                    image: true,
                    max: 255,
                  })}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {renderSetting({
                      key: `${prefix}Name`,
                      bn: "নাম",
                      en: "Name",
                    })}
                    {renderSetting({
                      key: `${prefix}Designation`,
                      bn: "পদবি",
                      en: "Designation",
                    })}
                  </div>
                  {renderSetting({
                    key: `${prefix}Message`,
                    bn: "বাণী",
                    en: "Message",
                    multiline: true,
                  })}
                </Panel>
              ))}
            {tab === "sections" && (
              <>
                <Panel
                  title={tx(
                    "নতুন মাদ্রাসার জন্য অটো সেটআপ",
                    "Automatic setup for new institutions",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">
                        {tx(
                          "ডেমো স্বয়ংক্রিয়ভাবে যুক্ত করুন",
                          "Automatically add this demo",
                        )}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        {tx(
                          "নতুন প্রতিষ্ঠান তৈরি হলেই এই টেমপ্লেটের নিজস্ব কপি পাবে।",
                          "Each newly created institution receives its own copy of this template.",
                        )}
                      </p>
                    </div>
                    <Toggle
                      checked={data.enabled}
                      onChange={() => patch({ enabled: !data.enabled })}
                      label={tx("অটো সেটআপ", "Automatic setup")}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">
                        {tx(
                          "ওয়েবসাইট প্রকাশিত রাখুন",
                          "Publish starter websites",
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {tx(
                          "বন্ধ রাখলে কর্তৃপক্ষ প্রকাশ না করা পর্যন্ত ওয়েবসাইট দেখা যাবে না।",
                          "When off, the institution must publish its website before visitors can view it.",
                        )}
                      </p>
                    </div>
                    <Toggle
                      checked={!!data.settings.isPublished}
                      onChange={() =>
                        setting(
                          "isPublished",
                          data.settings.isPublished ? 0 : 1,
                        )
                      }
                      label={tx("ওয়েবসাইট প্রকাশ", "Publish website")}
                    />
                  </div>
                </Panel>
                <Panel
                  title={tx("যে সেকশনগুলো দেখাবে", "Visible sections")}
                  description={tx(
                    "নতুন ওয়েবসাইটে কোন সেকশন থাকবে তা বেছে নিন।",
                    "Choose the sections available on starter websites.",
                  )}
                >
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sectionFields.map(([key, b, e]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <span className="text-sm text-slate-700 dark:text-slate-200">
                          {tx(b, e)}
                        </span>
                        <Toggle
                          checked={!!data.settings[key]}
                          onChange={() =>
                            setting(key, data.settings[key] ? 0 : 1)
                          }
                          label={tx(b, e)}
                        />
                      </div>
                    ))}
                  </div>
                </Panel>
              </>
            )}
          </fieldset>
          <aside
            className={`${preview ? "block" : "hidden"} space-y-4 xl:sticky xl:top-5 xl:block`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                {tx("লাইভ প্রিভিউ", "LIVE PREVIEW")}
              </div>
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  aria-label="Desktop preview"
                  aria-pressed={!mobile}
                  onClick={() => setMobile(false)}
                  className={`rounded-md p-1.5 ${!mobile ? "bg-slate-100 text-teal-700 dark:bg-slate-800" : "text-slate-400"}`}
                >
                  <Monitor size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Mobile preview"
                  aria-pressed={mobile}
                  onClick={() => setMobile(true)}
                  className={`rounded-md p-1.5 ${mobile ? "bg-slate-100 text-teal-700 dark:bg-slate-800" : "text-slate-400"}`}
                >
                  <Smartphone size={14} />
                </button>
              </div>
            </div>
            <TemplatePreview data={data} bn={bn} mobile={mobile} />
            <p className="px-3 text-center text-[11px] leading-6 text-slate-400">
              {tx(
                "কনটেন্টের সংক্ষিপ্ত প্রিভিউ। প্রকৃত ওয়েবসাইট নির্বাচিত থিম অনুযায়ী দেখাবে।",
                "A compact content preview. The actual website uses the selected theme.",
              )}
            </p>
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <ShieldCheck
                size={19}
                className="mt-0.5 shrink-0 text-teal-600"
              />
              <p className="text-xs leading-6 text-slate-500">
                {tx(
                  "এখানে পরিবর্তন করলে বিদ্যমান প্রতিষ্ঠানের ওয়েবসাইট বদলাবে না। প্রতিটি প্রতিষ্ঠান নিজস্ব সেটিংস থেকে কনটেন্ট সম্পাদনা করতে পারবে।",
                  "Template changes apply to future institutions. Existing institutions keep their content and can edit it in their own settings.",
                )}
              </p>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
