import { useEffect, useState } from "react";
import { Cloud } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import Button from "../../../components/ui/Button";
import {
  getPlatformCloudinaryConfig,
  savePlatformCloudinaryConfig,
  deletePlatformCloudinaryConfig,
} from "../../../services/superAdminApi";
import { useToastStore } from "../../../store/toastStore";
import { useConfirmStore } from "../../../store/confirmStore";
import { logger } from "../../../utils/logger";

/**
 * Platform-wide Super Admin settings - not tied to any one madrasa. Only
 * one section (Cloudinary) exists today; built as a list of independent
 * cards so more settings can be added later without restructuring the page.
 */
function CloudinarySettingsCard() {
  const toast = useToastStore((s) => s.show);

  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [cloudName, setCloudName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPlatformCloudinaryConfig()
      .then((data) => {
        if (cancelled) return;
        setConfigured(data.configured);
        setCloudName(data.cloud_name || "");
        // API key/secret are write-only - only the (non-sensitive) cloud name is prefilled.
      })
      .catch((err) => {
        logger.error("LOAD PLATFORM CLOUDINARY CONFIG ERROR:", err);
        toast("কনফিগারেশন লোড করা যায়নি", "error");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!cloudName.trim() || !apiKey.trim() || !apiSecret.trim()) {
      toast("Cloud Name, API Key ও API Secret — তিনটিই আবশ্যক", "error");
      return;
    }
    setSaving(true);
    try {
      await savePlatformCloudinaryConfig({
        cloud_name: cloudName.trim(),
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
      });
      setConfigured(true);
      setApiSecret("");
      toast("Cloudinary কনফিগারেশন সেভ হয়েছে", "success");
    } catch (err) {
      logger.error("SAVE PLATFORM CLOUDINARY CONFIG ERROR:", err);
      toast("সেভ করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    useConfirmStore.getState().show({
      title: "Cloudinary কনফিগারেশন মুছুন",
      message:
        "প্ল্যাটফর্ম Cloudinary অ্যাকাউন্ট সরিয়ে ফেলতে চান? এরপর Super Admin থেকে সিস্টেম টেমপ্লেটের ব্যাকগ্রাউন্ড আপলোড কাজ করবে না, যতক্ষণ না আবার কনফিগার করা হয়।",
      confirmText: "মুছুন",
      danger: true,
      onConfirm: async () => {
        try {
          await deletePlatformCloudinaryConfig();
          setConfigured(false);
          setCloudName("");
          setApiKey("");
          setApiSecret("");
          toast("কনফিগারেশন মুছে ফেলা হয়েছে", "success");
        } catch (err) {
          logger.error("DELETE PLATFORM CLOUDINARY CONFIG ERROR:", err);
          toast("মুছে ফেলা যায়নি", "error");
        }
      },
    });
  };

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Cloud size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cloudinary (Platform Storage)</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Super Admin যখন System Document Template-এর ব্যাকগ্রাউন্ড ছবি আপলোড করেন, সেটি এই
              অ্যাকাউন্টে জমা হয় — কোনো নির্দিষ্ট মাদ্রাসার অ্যাকাউন্ট নয়।
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            configured ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
          }`}
        >
          {loading ? "..." : configured ? "কনফিগার করা আছে" : "কনফিগার করা নেই"}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">লোড হচ্ছে...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">Cloud Name</label>
            <input
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={cloudName}
              onChange={(e) => setCloudName(e.target.value)}
              placeholder="e.g. my-cloud-name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">API Key</label>
            <input
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={configured ? "•••••••••• (পরিবর্তনে নতুন মান দিন)" : ""}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">API Secret</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={configured ? "•••••••••• (পরিবর্তনে নতুন মান দিন)" : ""}
            />
          </div>
        </div>
      )}
      {!loading && (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          সেভ করার পর Secret আর কখনো দেখানো হয় না — পরিবর্তন করতে হলে আবার নতুন করে লিখুন।
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        {configured ? (
          <Button variant="danger" onClick={remove} disabled={loading || saving}>
            মুছুন
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={save} disabled={loading || saving}>
          {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </Button>
      </div>
    </div>
  );
}

export default function SuperAdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="প্ল্যাটফর্ম-ওয়াইড কনফিগারেশন — নির্দিষ্ট কোনো মাদ্রাসার জন্য নয়" />
      <CloudinarySettingsCard />
    </div>
  );
}
