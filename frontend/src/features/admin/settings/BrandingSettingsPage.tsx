import { useEffect, useState } from "react";
import { Droplets, FileText } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { SkeletonCard } from "../../../components/ui/Skeleton";
import SectionCard from "../../../components/settings/SectionCard";
import InlineTextField from "../../../components/settings/InlineTextField";
import InlineListField from "../../../components/settings/InlineListField";
import InlineImageField from "../../../components/settings/InlineImageField";
import { ToggleSwitch } from "../../../components/settings/ToggleSwitch";
import {
  deleteBrandingImage,
  saveBranding,
  type BrandingPayload,
  type ReportPrintMode,
} from "../../../services/brandingApi";
import { useBrandingStore } from "../../../store/brandingStore";
import { useToastStore } from "../../../store/toastStore";

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
