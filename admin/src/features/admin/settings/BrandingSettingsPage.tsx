import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Droplets,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  MapPin,
  Move,
  RotateCcw,
  Type,
} from "lucide-react";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import SectionCard from "../../../components/settings/SectionCard";
import InlineTextField from "../../../components/settings/InlineTextField";
import InlineListField from "../../../components/settings/InlineListField";
import InlineImageField from "../../../components/settings/InlineImageField";
import { ToggleSwitch } from "../../../components/settings/ToggleSwitch";
import {
  deleteBrandingImage,
  saveBranding,
  BRAND_LAYOUT_DEFAULTS,
  type BrandingPayload,
  type BrandLayout,
  type BrandLayoutPatch,
  type BrandLogoPosition,
  type ReportPrintMode,
} from "../../../services/brandingApi";
import { useBrandingStore } from "../../../store/brandingStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";

// Small shared row: label + live value chip + range slider. Used for every
// font-size/logo-size/height knob below - only fires onCommit (a save) on
// release, but calls onDraft on every tick so the number chip stays live.
function LayoutSliderRow({
  icon,
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onDraft,
  onCommit,
}: {
  icon?: ReactNode;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onDraft: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-100 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
          {icon}
          {label}
        </label>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-300">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onDraft(Number(e.target.value))}
        onMouseUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        className="mt-2 w-full accent-blue-600"
      />
    </div>
  );
}

// Pixels nudged per arrow-button click on the logo's fine-position pad -
// matches backend/src/modules/settings/settings.constants.ts's
// BRAND_LAYOUT_LIMITS.logo_offset_x/y clamp range.
const LOGO_NUDGE_STEP = 4;
const LOGO_OFFSET_X_LIMIT = 80;
const LOGO_OFFSET_Y_LIMIT = 40;

// Small shared row: label + native color swatch input, saved immediately on
// change (color pickers don't have the "drag spam" problem sliders do).
function ColorPickerRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800">
      <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-slate-400">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-gray-200 dark:border-slate-700"
        />
      </div>
    </div>
  );
}

export default function BrandingSettingsPage() {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  const setBranding = useBrandingStore((s) => s.setBranding);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.08);
  const [headerFooterEnabled, setHeaderFooterEnabled] = useState(false);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [footerImage, setFooterImage] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<ReportPrintMode>("normal");
  const [brandLayout, setBrandLayout] = useState<BrandLayout>(BRAND_LAYOUT_DEFAULTS);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchBranding(true);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!branding) return;
    setName(branding.name ?? "");
    setAddress(branding.address ?? "");
    setPhones(branding.phones ?? []);
    setEmails(branding.emails ?? []);
    setLogo(branding.report_logo ?? null);
    setBackground(branding.report_banner ?? null);
    setWatermark(branding.report_watermark ?? null);
    setOpacity(
      branding.report_watermark_opacity !== undefined && branding.report_watermark_opacity !== null
        ? Number(branding.report_watermark_opacity)
        : 0.08,
    );
    setHeaderFooterEnabled(!!branding.report_header_footer_enabled);
    setHeaderImage(branding.report_header_image ?? null);
    setFooterImage(branding.report_footer_image ?? null);
    setPrintMode(branding.report_print_mode ?? "normal");
    setBrandLayout({ ...BRAND_LAYOUT_DEFAULTS, ...(branding.report_brand_layout ?? {}) });
  }, [branding]);

  // The backend only touches fields actually present in the PUT body (real
  // partial update), so each inline field can save independently without
  // clobbering the others.
  const patchBranding = async (patch: BrandingPayload) => {
    try {
      await saveBranding(patch);
      if (patch.name !== undefined) setName(patch.name || "");
      if (patch.address !== undefined) setAddress(patch.address || "");
      if (patch.phones !== undefined) setPhones(patch.phones);
      if (patch.emails !== undefined) setEmails(patch.emails);
      if (patch.report_logo !== undefined) setLogo(patch.report_logo);
      if (patch.report_banner !== undefined) setBackground(patch.report_banner);
      if (patch.report_watermark !== undefined) setWatermark(patch.report_watermark);
      if (patch.report_watermark_opacity !== undefined) setOpacity(patch.report_watermark_opacity);
      if (patch.report_header_footer_enabled !== undefined) setHeaderFooterEnabled(patch.report_header_footer_enabled);
      if (patch.report_header_image !== undefined) setHeaderImage(patch.report_header_image);
      if (patch.report_footer_image !== undefined) setFooterImage(patch.report_footer_image);
      if (patch.report_print_mode !== undefined) setPrintMode(patch.report_print_mode);
      let nextBrandLayout = brandLayout;
      if (patch.report_brand_layout !== undefined) {
        nextBrandLayout = { ...brandLayout, ...patch.report_brand_layout };
        setBrandLayout(nextBrandLayout);
      }
      setBranding({
        name,
        address,
        phones,
        emails,
        report_logo: logo,
        report_banner: background,
        report_watermark: watermark,
        report_watermark_opacity: opacity,
        report_header_footer_enabled: headerFooterEnabled,
        report_header_image: headerImage,
        report_footer_image: footerImage,
        report_print_mode: printMode,
        ...patch,
        report_brand_layout: nextBrandLayout,
      });
      useToastStore.getState().show("সংরক্ষণ হয়েছে।", "success");
    } catch {
      useToastStore.getState().show("সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।", "error");
      throw new Error("save failed");
    }
  };

  const saveImageField = async (
    field: "report_logo" | "report_banner" | "report_watermark" | "report_header_image" | "report_footer_image",
    value: string,
  ) => {
    if (!value) {
      await deleteBrandingImage(field);
      if (field === "report_logo") setLogo(null);
      if (field === "report_banner") setBackground(null);
      if (field === "report_watermark") setWatermark(null);
      if (field === "report_header_image") setHeaderImage(null);
      if (field === "report_footer_image") setFooterImage(null);
      await fetchBranding(true);
      useToastStore.getState().show("ছবি মুছে ফেলা হয়েছে।", "success");
      return;
    }
    await patchBranding({ [field]: value });
  };

  const saveOpacity = () => {
    patchBranding({ report_watermark_opacity: opacity }).catch(() => {});
  };

  const toggleHeaderFooterEnabled = (checked: boolean) => {
    patchBranding({ report_header_footer_enabled: checked }).catch(() => {});
  };

  const changePrintMode = (mode: ReportPrintMode) => {
    patchBranding({ report_print_mode: mode }).catch(() => {});
  };

  // Every default-header/footer control below saves through this one
  // helper — each slider/color-picker/button sends just the single key it
  // owns as a BrandLayoutPatch, same partial-update pattern as the rest of
  // the page (patchBranding merges it onto the existing layout server-side).
  const patchBrandLayout = (patch: BrandLayoutPatch) => {
    patchBranding({ report_brand_layout: patch }).catch(() => {});
  };

  // Local-only draft values for the range sliders: update the number shown
  // next to the slider on every drag tick, but only PUT to the server on
  // release (onMouseUp/onTouchEnd), matching the watermark opacity slider's
  // existing pattern - avoids one network request per pixel of drag.
  const setLayoutDraft = <K extends keyof BrandLayout>(key: K, value: BrandLayout[K]) => {
    setBrandLayout((prev) => ({ ...prev, [key]: value }));
  };

  // Fine logo nudge: each arrow click adds a few px on top of whatever
  // left/center/right base position is already picked, clamped to the same
  // range the backend enforces. Saves immediately (no drag-in-progress
  // state to debounce here, unlike the sliders).
  const nudgeLogo = (dx: number, dy: number) => {
    const nextX = Math.max(-LOGO_OFFSET_X_LIMIT, Math.min(LOGO_OFFSET_X_LIMIT, brandLayout.logo_offset_x + dx));
    const nextY = Math.max(-LOGO_OFFSET_Y_LIMIT, Math.min(LOGO_OFFSET_Y_LIMIT, brandLayout.logo_offset_y + dy));
    setLayoutDraft("logo_offset_x", nextX);
    setLayoutDraft("logo_offset_y", nextY);
    patchBrandLayout({ logo_offset_x: nextX, logo_offset_y: nextY });
  };

  const resetLogoOffset = () => {
    setLayoutDraft("logo_offset_x", 0);
    setLayoutDraft("logo_offset_y", 0);
    patchBrandLayout({ logo_offset_x: 0, logo_offset_y: 0 });
  };

  // Resets every knob in "ডিফল্ট হেডার-ফুটার ডিজাইন" (name/address size &
  // color, logo size/position/offset, header height, footer text/size/
  // color/height) back to BRAND_LAYOUT_DEFAULTS in one shot, after an
  // explicit confirmation since it overwrites everything at once.
  const resetBrandLayoutToDefault = () => {
    useConfirmStore.getState().show({
      title: "ডিফল্টে ফিরিয়ে আনুন",
      message:
        "নাম-ঠিকানার সাইজ/রঙ, লোগোর সাইজ-অবস্থান, হেডারের জায়গা এবং ফুটার — এই সেকশনের সব সেটিং ডিফল্ট মানে ফিরে যাবে। এগিয়ে যেতে চান?",
      confirmText: "ডিফল্টে ফিরিয়ে আনুন",
      danger: true,
      onConfirm: async () => {
        await patchBranding({ report_brand_layout: BRAND_LAYOUT_DEFAULTS });
      },
    });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="প্রতিষ্ঠান ব্র্যান্ডিং সেটিংস" />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="প্রতিষ্ঠান ব্র্যান্ডিং সেটিংস"
        subtitle="মাদ্রাসার নাম, ঠিকানা, মোবাইল নম্বর, ইমেইল, লোগো ও ওয়াটারমার্ক দিন — এগুলো সব রিপোর্ট পেজে (আইডি কার্ড, মার্কশিট, উপস্থিতি, আয়-ব্যয় ইত্যাদি) স্বয়ংক্রিয়ভাবে দেখাবে।"
      />

      <SectionCard
        title="মূল তথ্য"
        hint="যেকোনো তথ্যের পাশের পেন্সিল আইকনে ক্লিক করলে শুধু সেই ফিল্ডটি এডিট করা যাবে"
      >
        <div className="space-y-2">
          <InlineTextField
            label="মাদ্রাসার নাম"
            value={name}
            placeholder="যেমন: জামিয়া ইসলামিয়া মাদ্রাসা"
            required
            onSave={(v) => patchBranding({ name: v })}
          />
          <InlineTextField
            label="ঠিকানা"
            value={address}
            placeholder="যেমন: গ্রাম/মহল্লা, উপজেলা, জেলা"
            onSave={(v) => patchBranding({ address: v })}
          />
          <InlineListField
            label="মোবাইল নম্বর"
            values={phones}
            type="tel"
            placeholder="যেমন: ০১৭xxxxxxxx"
            onSave={(v) => patchBranding({ phones: v })}
          />
          <InlineListField
            label="ইমেইল"
            values={emails}
            type="email"
            placeholder="যেমন: info@example.com"
            onSave={(v) => patchBranding({ emails: v })}
          />
        </div>
      </SectionCard>

      <SectionCard title="লোগো ও ব্যাকগ্রাউন্ড">
        <div className="space-y-2">
          <InlineImageField
            label="লোগো"
            hint="বর্গাকার ছবি ভালো দেখায় (স্বচ্ছ পটভূমি সহ PNG সবচেয়ে ভালো)"
            value={logo}
            folder="branding"
            onSave={(v) => saveImageField("report_logo", v)}
          />
          <InlineImageField
            label="ব্যাকগ্রাউন্ড"
            hint="রিপোর্ট পেজের পুরো পটভূমি জুড়ে দেখাবে (PNG, JPG বা JPEG) — ফিল্ডের তথ্য অপরিবর্তিত থাকবে"
            value={background}
            folder="branding"
            shape="wide"
            onSave={(v) => saveImageField("report_banner", v)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="ডিফল্ট হেডার-ফুটার ডিজাইন"
        hint="উপরের 'কাস্টম হেডার-ফুটার' বন্ধ থাকলে এই সেটিং অনুযায়ী লোগো-নাম-ঠিকানা হেডার এবং (ঐচ্ছিক) ফুটার দেখাবে — চালু থাকলে এই সেটিং প্রযোজ্য হবে না"
        actions={
          <button
            type="button"
            onClick={resetBrandLayoutToDefault}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <RotateCcw size={13} />
            ডিফল্টে ফিরিয়ে আনুন
          </button>
        }
      >
        <div className="space-y-4">
          {/* নাম */}
          <div className="rounded-xl border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-slate-800">
              <Type size={14} className="text-gray-400 dark:text-slate-500" />
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">মাদ্রাসার নাম</p>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <LayoutSliderRow
                label="নামের সাইজ"
                value={brandLayout.name_font_size}
                unit="px"
                min={12}
                max={48}
                onDraft={(v) => setLayoutDraft("name_font_size", v)}
                onCommit={(v) => patchBrandLayout({ name_font_size: v })}
              />
              <ColorPickerRow
                label="নামের রঙ"
                value={brandLayout.name_color}
                onChange={(v) => {
                  setLayoutDraft("name_color", v);
                  patchBrandLayout({ name_color: v });
                }}
              />
            </div>
          </div>

          {/* ঠিকানা */}
          <div className="rounded-xl border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-slate-800">
              <MapPin size={14} className="text-gray-400 dark:text-slate-500" />
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">ঠিকানা</p>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <LayoutSliderRow
                label="ঠিকানার সাইজ"
                value={brandLayout.address_font_size}
                unit="px"
                min={10}
                max={28}
                onDraft={(v) => setLayoutDraft("address_font_size", v)}
                onCommit={(v) => patchBrandLayout({ address_font_size: v })}
              />
              <ColorPickerRow
                label="ঠিকানার রঙ"
                value={brandLayout.address_color}
                onChange={(v) => {
                  setLayoutDraft("address_color", v);
                  patchBrandLayout({ address_color: v });
                }}
              />
            </div>
          </div>

          {/* লোগো */}
          <div className="rounded-xl border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-slate-800">
              <ImageIcon size={14} className="text-gray-400 dark:text-slate-500" />
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">লোগো</p>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LayoutSliderRow
                  label="লোগোর সাইজ"
                  value={brandLayout.logo_size}
                  unit="px"
                  min={40}
                  max={160}
                  onDraft={(v) => setLayoutDraft("logo_size", v)}
                  onCommit={(v) => patchBrandLayout({ logo_size: v })}
                />
                <div className="rounded-xl border border-gray-100 p-4 dark:border-slate-800">
                  <p className="mb-2 text-sm font-medium text-gray-700 dark:text-slate-300">মূল অবস্থান</p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: "left", label: "বামে" },
                        { key: "center", label: "মাঝে" },
                        { key: "right", label: "ডানে" },
                      ] as { key: BrandLogoPosition; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setLayoutDraft("logo_position", opt.key);
                          patchBrandLayout({ logo_position: opt.key });
                        }}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          brandLayout.logo_position === opt.key
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-400"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4 dark:border-slate-800">
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
                    <Move size={14} className="text-gray-400 dark:text-slate-500" />
                    সূক্ষ্মভাবে সরান
                  </p>
                  {(brandLayout.logo_offset_x !== 0 || brandLayout.logo_offset_y !== 0) && (
                    <button
                      type="button"
                      onClick={resetLogoOffset}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <RotateCcw size={12} />
                      মূল জায়গায় ফিরুন
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="grid grid-cols-3 grid-rows-3 gap-1">
                    <span />
                    <button
                      type="button"
                      onClick={() => nudgeLogo(0, -LOGO_NUDGE_STEP)}
                      aria-label="লোগো উপরে সরান"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <span />
                    <button
                      type="button"
                      onClick={() => nudgeLogo(-LOGO_NUDGE_STEP, 0)}
                      aria-label="লোগো বামে সরান"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60"
                    >
                      <ArrowLeft size={15} />
                    </button>
                    <span className="flex items-center justify-center rounded-lg bg-gray-50 dark:bg-slate-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-slate-600" />
                    </span>
                    <button
                      type="button"
                      onClick={() => nudgeLogo(LOGO_NUDGE_STEP, 0)}
                      aria-label="লোগো ডানে সরান"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60"
                    >
                      <ArrowRight size={15} />
                    </button>
                    <span />
                    <button
                      type="button"
                      onClick={() => nudgeLogo(0, LOGO_NUDGE_STEP)}
                      aria-label="লোগো নিচে সরান"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <span />
                  </div>
                  <p className="text-xs leading-5 text-gray-500 dark:text-slate-400">
                    বামে/ডানে: {brandLayout.logo_offset_x}px
                    <br />
                    উপরে/নিচে: {brandLayout.logo_offset_y}px
                  </p>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                  উপরে বেছে নেওয়া মূল অবস্থান থেকে সামান্য সরিয়ে (চাপ দিলেই কয়েক পিক্সেল করে) ঠিক জায়গায় বসাতে
                  ব্যবহার করুন।
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-100 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
              <LayoutTemplate size={14} className="text-gray-400 dark:text-slate-500" />
              হেডারের মোট জায়গা
            </label>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-300">
              {brandLayout.header_height === null ? "স্বয়ংক্রিয়" : `${brandLayout.header_height}mm`}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                brandLayout.header_height === null
                  ? patchBrandLayout({ header_height: 40 })
                  : patchBrandLayout({ header_height: null })
              }
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                brandLayout.header_height === null
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-400"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
              }`}
            >
              {brandLayout.header_height === null ? "স্বয়ংক্রিয় (কনটেন্ট অনুযায়ী)" : "স্বয়ংক্রিয়তে ফিরুন"}
            </button>
            {brandLayout.header_height !== null && (
              <input
                type="range"
                min={20}
                max={80}
                step={1}
                value={brandLayout.header_height}
                onChange={(e) => setLayoutDraft("header_height", Number(e.target.value))}
                onMouseUp={(e) => patchBrandLayout({ header_height: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => patchBrandLayout({ header_height: Number((e.target as HTMLInputElement).value) })}
                className="w-full accent-blue-600"
              />
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
            স্বয়ংক্রিয় থাকলে হেডার যতটুকু লাগে ততটুকু জায়গা নেবে। নির্দিষ্ট মান দিলে হেডার কমপক্ষে ওই জায়গা নেবে (নিচের
            কনটেন্ট প্রয়োজনে নিচে নেমে যাবে)।
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-gray-100 p-4 dark:border-slate-800">
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-slate-300">ডিফল্ট ফুটার (ঐচ্ছিক)</p>
          <textarea
            rows={2}
            value={brandLayout.footer_text ?? ""}
            placeholder="যেমন: মাদ্রাসার নাম, ঠিকানা, ফোন — প্রতিটি পেজের নিচে ছোট করে দেখাবে"
            onChange={(e) => setLayoutDraft("footer_text", e.target.value)}
            onBlur={(e) => patchBrandLayout({ footer_text: e.target.value || null })}
            className="w-full rounded-lg border border-gray-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            ফাঁকা রাখলে ফুটারে কিছু দেখাবে না (শুধু পৃষ্ঠা নম্বর থাকবে)।
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LayoutSliderRow
              label="ফুটার টেক্সটের সাইজ"
              value={brandLayout.footer_font_size}
              unit="px"
              min={8}
              max={20}
              onDraft={(v) => setLayoutDraft("footer_font_size", v)}
              onCommit={(v) => patchBrandLayout({ footer_font_size: v })}
            />
            <LayoutSliderRow
              label="ফুটারের জায়গা"
              value={brandLayout.footer_height}
              unit="mm"
              min={8}
              max={40}
              onDraft={(v) => setLayoutDraft("footer_height", v)}
              onCommit={(v) => patchBrandLayout({ footer_height: v })}
            />
            <ColorPickerRow
              label="ফুটার টেক্সটের রঙ"
              value={brandLayout.footer_color}
              onChange={(v) => {
                setLayoutDraft("footer_color", v);
                patchBrandLayout({ footer_color: v });
              }}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="ওয়াটারমার্ক" hint="রিপোর্টের পেছনে হালকাভাবে ছাপা হয়">
        <InlineImageField
          label="ওয়াটারমার্ক ছবি"
          hint="রিপোর্টের পেছনে হালকাভাবে দেখাবে (স্বচ্ছ ব্যাকগ্রাউন্ড সহ PNG ব্যবহার করুন)"
          value={watermark}
          folder="branding"
          onSave={(v) => saveImageField("report_watermark", v)}
        />

        <div className="mt-3 max-w-xs rounded-xl border border-gray-100 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
              <Droplets size={14} className="text-gray-400 dark:text-slate-500" />
              স্বচ্ছতা (Opacity)
            </label>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-300">
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.02}
            max={0.4}
            step={0.01}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            onMouseUp={saveOpacity}
            onTouchEnd={saveOpacity}
            className="mt-2 w-full accent-blue-600"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="রিপোর্ট হেডার-ফুটার"
        hint="চালু না থাকলে রিপোর্টে আগের মতোই মাদ্রাসার নাম-ঠিকানা দিয়ে ডিফল্ট হেডার দেখাবে"
      >
        <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-gray-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
              কাস্টম হেডার-ফুটার চালু করুন
            </span>
          </div>
          <ToggleSwitch checked={headerFooterEnabled} onChange={toggleHeaderFooterEnabled} />
        </div>

        {headerFooterEnabled && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
            চালু থাকায় ডিফল্ট লোগো-নাম-ঠিকানা হেডার আর দেখাবে না — নিচে ছবি না দিলে ওই জায়গা ফাঁকা থাকবে।
          </p>
        )}

        <div
          className={
            headerFooterEnabled ? "space-y-3" : "space-y-3 pointer-events-none opacity-40"
          }
        >
          <div className="rounded-xl border border-gray-100 p-4 dark:border-slate-800">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-slate-400">প্রিন্ট মোড</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => changePrintMode("normal")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  printMode === "normal"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-400"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                }`}
              >
                সাধারণ পেজ
              </button>
              <button
                type="button"
                onClick={() => changePrintMode("letterhead")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  printMode === "letterhead"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-400"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                }`}
              >
                প্রেস পেপার (লেটারহেড)
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              প্রেস পেপার মোডে লোগো, ব্যাকগ্রাউন্ড, ওয়াটারমার্ক ও হেডার-ফুটার ছবি — কিছুই প্রিন্ট হবে না, শুধু মূল
              লেখাগুলো প্রিন্ট হবে (আগে থেকে ছাপানো লেটারহেড কাগজে প্রিন্টের জন্য)। উপরে-নিচে হেডার-ফুটার ছবির
              সমান জায়গা তবুও ফাঁকা রাখা হবে, যাতে লেখা গিয়ে ছাপানো লেটারহেডের উপর না পড়ে।
            </p>
          </div>

          {printMode === "normal" ? (
            <>
              <InlineImageField
                label="হেডার ছবি"
                hint="প্রস্তাবিত সাইজ: ১৬০০×৩২০ পিক্সেল (৫:১ অনুপাত) — এই সাইজে দিলে A4 ও A5, দুই পেজেই ঠিকভাবে বসবে। অন্য অনুপাতেও দেওয়া যাবে (ছবি কখনো বিকৃত/কাটা হবে না), শুধু আশেপাশে কিছুটা ফাঁকা জায়গা থাকতে পারে।"
                value={headerImage}
                folder="branding"
                shape="wide"
                ratioLabel="৫:১ (১৬০০×৩২০px)"
                onSave={(v) => saveImageField("report_header_image", v)}
              />
              <InlineImageField
                label="ফুটার ছবি"
                hint="প্রস্তাবিত সাইজ: ১৬০০×১৬০ পিক্সেল (১০:১ অনুপাত) — এই সাইজে দিলে A4 ও A5, দুই পেজেই ঠিকভাবে বসবে।"
                value={footerImage}
                folder="branding"
                shape="wide"
                ratioLabel="১০:১ (১৬০০×১৬০px)"
                onSave={(v) => saveImageField("report_footer_image", v)}
              />
            </>
          ) : (
            <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              প্রেস পেপার মোডে হেডার/ফুটার ছবি আপলোডের দরকার নেই — যেহেতু এটা প্রিন্ট হবেই না। আগে আপলোড করা ছবি
              থাকলেও সেটা মুছে যাবে না, শুধু এই মোডে থাকা অবস্থায় প্রিন্ট হবে না।
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
