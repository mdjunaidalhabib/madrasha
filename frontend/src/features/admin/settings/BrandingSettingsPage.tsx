import { useEffect, useState } from "react";
import Button from "../../../components/ui/Button";
import BrandImageBox from "../../../components/settings/BrandImageBox";
import { deleteBrandingImage, saveBranding } from "../../../services/brandingApi";
import { useBrandingStore } from "../../../store/brandingStore";

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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    setMessage("");
    setError("");

    if (!name.trim()) {
      setError("মাদ্রাসার নাম আবশ্যক।");
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
      setMessage("সেভ হয়েছে। সব রিপোর্ট পেজে এখন থেকে এটি স্বয়ংক্রিয়ভাবে দেখাবে।");
    } catch {
      setError("সেভ করা যায়নি। আবার চেষ্টা করুন।");
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
    return <div className="rounded-2xl bg-white p-6 shadow">লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">রিপোর্ট ব্র্যান্ডিং সেটিংস</h1>
        <p className="mt-1 text-sm text-gray-600">
          মাদ্রাসার নাম, ঠিকানা, লোগো ও ওয়াটারমার্ক দিন — এগুলো সব রিপোর্ট পেজে (আইডি কার্ড,
          মার্কশিট, উপস্থিতি, আয়-ব্যয় ইত্যাদি) স্বয়ংক্রিয়ভাবে দেখাবে।
        </p>
      </div>

      {message && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border p-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">মাদ্রাসার নাম</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="যেমন: জামিয়া ইসলামিয়া মাদ্রাসা"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">ঠিকানা</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="যেমন: গ্রাম/মহল্লা, উপজেলা, জেলা"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

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

      <div className="rounded-xl border p-4">
        <BrandImageBox
          label="ওয়াটারমার্ক"
          hint="রিপোর্টের পেছনে হালকাভাবে দেখাবে (স্বচ্ছ ব্যাকগ্রাউন্ড সহ PNG ব্যবহার করুন)"
          value={watermark}
          onChange={setWatermark}
          onRemove={() => removeImage("report_watermark")}
        />

        <div className="mt-4 max-w-xs">
          <label className="text-sm font-medium">স্বচ্ছতা (Opacity): {Math.round(opacity * 100)}%</label>
          <input
            type="range"
            min={0.02}
            max={0.4}
            step={0.01}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </div>
      </div>

      <Button disabled={saving} onClick={handleSave}>
        {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
      </Button>
    </div>
  );
}
