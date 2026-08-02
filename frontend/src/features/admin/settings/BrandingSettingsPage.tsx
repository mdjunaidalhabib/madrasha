import { useEffect, useState } from "react";
import { Building2, Droplets } from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import PageHeader from "../../../components/ui/PageHeader";
import { SkeletonCard } from "../../../components/ui/Skeleton";
import BrandImageBox from "../../../components/settings/BrandImageBox";
import { deleteBrandingImage, saveBranding } from "../../../services/brandingApi";
import { useBrandingStore } from "../../../store/brandingStore";
import { useToastStore } from "../../../store/toastStore";

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

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
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

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

  const handleSave = async () => {
    setNameError("");

    if (!name.trim()) {
      setNameError("মাদ্রাসার নাম আবশ্যক।");
      return;
    }

    setSaving(true);
    try {
      await saveBranding({
        name: name.trim(),
        address: address.trim(),
        report_logo: logo,
        report_banner: background,
        report_watermark: watermark,
        report_watermark_opacity: opacity,
      });
      setBranding({
        name: name.trim(),
        address: address.trim(),
        report_logo: logo,
        report_banner: background,
        report_watermark: watermark,
        report_watermark_opacity: opacity,
      });
      useToastStore
        .getState()
        .show("সেভ হয়েছে। সব রিপোর্ট পেজে এখন থেকে এটি স্বয়ংক্রিয়ভাবে দেখাবে।", "success");
    } catch {
      useToastStore.getState().show("সেভ করা যায়নি। আবার চেষ্টা করুন।", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeImage = async (field: "report_logo" | "report_banner" | "report_watermark") => {
    await deleteBrandingImage(field);
    if (field === "report_logo") setLogo(null);
    if (field === "report_banner") setBackground(null);
    if (field === "report_watermark") setWatermark(null);
    await fetchBranding(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="রিপোর্ট ব্র্যান্ডিং সেটিংস" />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      <PageHeader
        title="রিপোর্ট ব্র্যান্ডিং সেটিংস"
        subtitle="মাদ্রাসার নাম, ঠিকানা, লোগো ও ওয়াটারমার্ক দিন — এগুলো সব রিপোর্ট পেজে (আইডি কার্ড, মার্কশিট, উপস্থিতি, আয়-ব্যয় ইত্যাদি) স্বয়ংক্রিয়ভাবে দেখাবে।"
      />

      <SectionCard title="মূল তথ্য">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">মাদ্রাসার নাম</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: জামিয়া ইসলামিয়া মাদ্রাসা"
              className={nameError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}
            />
            {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ঠিকানা</label>
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="যেমন: গ্রাম/মহল্লা, উপজেলা, জেলা"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="লোগো ও ব্যাকগ্রাউন্ড">
        <div className="grid gap-4 md:grid-cols-2">
          <BrandImageBox
            label="লোগো"
            hint="বর্গাকার ছবি ভালো দেখায় (স্বচ্ছ পটভূমি সহ PNG সবচেয়ে ভালো)"
            value={logo}
            onChange={setLogo}
            onRemove={() => removeImage("report_logo")}
          />
          <BrandImageBox
            label="ব্যাকগ্রাউন্ড"
            hint="রিপোর্ট পেজের পুরো পটভূমি জুড়ে দেখাবে (PNG, JPG বা JPEG) — ফিল্ডের তথ্য অপরিবর্তিত থাকবে"
            value={background}
            onChange={setBackground}
            onRemove={() => removeImage("report_banner")}
            shape="wide"
          />
        </div>
      </SectionCard>

      <SectionCard title="ওয়াটারমার্ক" hint="রিপোর্টের পেছনে হালকাভাবে ছাপা হয়">
        <BrandImageBox
          label="ওয়াটারমার্ক ছবি"
          hint="রিপোর্টের পেছনে হালকাভাবে দেখাবে (স্বচ্ছ ব্যাকগ্রাউন্ড সহ PNG ব্যবহার করুন)"
          value={watermark}
          onChange={setWatermark}
          onRemove={() => removeImage("report_watermark")}
        />

        <div className="mt-4 max-w-xs rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Droplets size={14} className="text-gray-400" />
              স্বচ্ছতা (Opacity)
            </label>
            <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 shadow-sm">
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
            className="mt-2 w-full accent-blue-600"
          />
        </div>
      </SectionCard>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white/95 p-3 backdrop-blur sm:static sm:inset-auto sm:z-auto sm:border-none sm:bg-transparent sm:p-0">
        <div className="flex items-center justify-end gap-2 sm:mx-0">
          <Button disabled={saving} onClick={handleSave} className="gap-1.5">
            <Building2 size={16} />
            {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </div>
      </div>
    </div>
  );
}
