import { useEffect, useState } from "react";
import { Droplets } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { SkeletonCard } from "../../../components/ui/Skeleton";
import SectionCard from "../../../components/settings/SectionCard";
import InlineTextField from "../../../components/settings/InlineTextField";
import InlineImageField from "../../../components/settings/InlineImageField";
import { deleteBrandingImage, saveBranding, type BrandingPayload } from "../../../services/brandingApi";
import { useBrandingStore } from "../../../store/brandingStore";
import { useToastStore } from "../../../store/toastStore";

export default function BrandingSettingsPage() {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  const setBranding = useBrandingStore((s) => s.setBranding);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.08);

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
    setLogo(branding.report_logo ?? null);
    setBackground(branding.report_banner ?? null);
    setWatermark(branding.report_watermark ?? null);
    setOpacity(
      branding.report_watermark_opacity !== undefined && branding.report_watermark_opacity !== null
        ? Number(branding.report_watermark_opacity)
        : 0.08,
    );
  }, [branding]);

  // The backend only touches fields actually present in the PUT body (real
  // partial update), so each inline field can save independently without
  // clobbering the others.
  const patchBranding = async (patch: BrandingPayload) => {
    try {
      await saveBranding(patch);
      if (patch.name !== undefined) setName(patch.name || "");
      if (patch.address !== undefined) setAddress(patch.address || "");
      if (patch.report_logo !== undefined) setLogo(patch.report_logo);
      if (patch.report_banner !== undefined) setBackground(patch.report_banner);
      if (patch.report_watermark !== undefined) setWatermark(patch.report_watermark);
      if (patch.report_watermark_opacity !== undefined) setOpacity(patch.report_watermark_opacity);
      setBranding({
        name,
        address,
        report_logo: logo,
        report_banner: background,
        report_watermark: watermark,
        report_watermark_opacity: opacity,
        ...patch,
      });
      useToastStore.getState().show("সংরক্ষণ হয়েছে।", "success");
    } catch {
      useToastStore.getState().show("সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।", "error");
      throw new Error("save failed");
    }
  };

  const saveImageField = async (
    field: "report_logo" | "report_banner" | "report_watermark",
    value: string,
  ) => {
    if (!value) {
      await deleteBrandingImage(field);
      if (field === "report_logo") setLogo(null);
      if (field === "report_banner") setBackground(null);
      if (field === "report_watermark") setWatermark(null);
      await fetchBranding(true);
      useToastStore.getState().show("ছবি মুছে ফেলা হয়েছে।", "success");
      return;
    }
    await patchBranding({ [field]: value });
  };

  const saveOpacity = () => {
    patchBranding({ report_watermark_opacity: opacity }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="রিপোর্ট ব্র্যান্ডিং সেটিংস" />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="রিপোর্ট ব্র্যান্ডিং সেটিংস"
        subtitle="মাদ্রাসার নাম, ঠিকানা, লোগো ও ওয়াটারমার্ক দিন — এগুলো সব রিপোর্ট পেজে (আইডি কার্ড, মার্কশিট, উপস্থিতি, আয়-ব্যয় ইত্যাদি) স্বয়ংক্রিয়ভাবে দেখাবে।"
      />

      <SectionCard title="মূল তথ্য" hint="যেকোনো তথ্যের পাশের পেন্সিল আইকনে ক্লিক করলে শুধু সেই ফিল্ডটি এডিট করা যাবে">
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
    </div>
  );
}
