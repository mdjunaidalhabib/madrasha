import { useEffect, useState } from "react";
import { Cloud, MessageSquare, Mail, RefreshCw } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import Button from "../../../components/ui/Button";
import {
  getPlatformCloudinaryConfig,
  savePlatformCloudinaryConfig,
  deletePlatformCloudinaryConfig,
  getPlatformSmsConfig,
  savePlatformSmsConfig,
  deletePlatformSmsConfig,
  checkPlatformSmsBalance,
  getPlatformEmailConfig,
  savePlatformEmailConfig,
  deletePlatformEmailConfig,
  checkPlatformEmailConnection,
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

/**
 * Platform-wide SMS gateway account - every madrasa's SMS notifications go
 * out through this single account. Kept generic (URL + param names both
 * for sending and for balance-check) because Bangladeshi SMS gateways
 * (SSLWireless, Alpha SMS, BulkSMSBD, ...) all differ on exact param
 * names - the "অ্যাডভান্সড" fields let this adapt to whichever gateway is
 * in use without a code change.
 */
function SmsSettingsCard() {
  const toast = useToastStore((s) => s.show);

  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [httpMethod, setHttpMethod] = useState("GET");
  const [paramApiKey, setParamApiKey] = useState("api_key");
  const [paramSenderId, setParamSenderId] = useState("senderid");
  const [paramNumber, setParamNumber] = useState("number");
  const [paramMessage, setParamMessage] = useState("message");
  const [balanceUrl, setBalanceUrl] = useState("");
  const [balanceHttpMethod, setBalanceHttpMethod] = useState("GET");
  const [balanceParamApiKey, setBalanceParamApiKey] = useState("api_key");
  const [balanceResponsePath, setBalanceResponsePath] = useState("balance");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [balanceResult, setBalanceResult] = useState<{
    success: boolean;
    balance?: number | string;
    raw?: string;
    errorMessage?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPlatformSmsConfig()
      .then((data) => {
        if (cancelled) return;
        setConfigured(data.configured);
        setProvider(data.provider || "");
        setApiUrl(data.api_url || "");
        setSenderId(data.sender_id || "");
        setHttpMethod(data.http_method || "GET");
        setParamApiKey(data.param_api_key || "api_key");
        setParamSenderId(data.param_sender_id || "senderid");
        setParamNumber(data.param_number || "number");
        setParamMessage(data.param_message || "message");
        setBalanceUrl(data.balance_url || "");
        setBalanceHttpMethod(data.balance_http_method || "GET");
        setBalanceParamApiKey(data.balance_param_api_key || "api_key");
        setBalanceResponsePath(data.balance_response_path || "balance");
      })
      .catch((err) => {
        logger.error("LOAD PLATFORM SMS CONFIG ERROR:", err);
        toast("SMS কনফিগারেশন লোড করা যায়নি", "error");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!apiUrl.trim() || !apiKey.trim()) {
      toast("API URL ও API Key আবশ্যক", "error");
      return;
    }
    setSaving(true);
    try {
      await savePlatformSmsConfig({
        provider: provider.trim() || undefined,
        api_url: apiUrl.trim(),
        api_key: apiKey.trim(),
        sender_id: senderId.trim() || undefined,
        http_method: httpMethod,
        param_api_key: paramApiKey.trim() || undefined,
        param_sender_id: paramSenderId.trim() || undefined,
        param_number: paramNumber.trim() || undefined,
        param_message: paramMessage.trim() || undefined,
        balance_url: balanceUrl.trim() || undefined,
        balance_http_method: balanceHttpMethod,
        balance_param_api_key: balanceParamApiKey.trim() || undefined,
        balance_response_path: balanceResponsePath.trim() || undefined,
      });
      setConfigured(true);
      setApiKey("");
      setBalanceResult(null);
      toast("SMS গেটওয়ে কনফিগারেশন সেভ হয়েছে", "success");
    } catch (err) {
      logger.error("SAVE PLATFORM SMS CONFIG ERROR:", err);
      toast("সেভ করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    useConfirmStore.getState().show({
      title: "SMS গেটওয়ে কনফিগারেশন মুছুন",
      message: "প্ল্যাটফর্ম SMS অ্যাকাউন্ট সরিয়ে ফেলতে চান? এরপর কোনো মাদ্রাসা থেকেই SMS পাঠানো যাবে না।",
      confirmText: "মুছুন",
      danger: true,
      onConfirm: async () => {
        try {
          await deletePlatformSmsConfig();
          setConfigured(false);
          setApiUrl("");
          setApiKey("");
          setBalanceResult(null);
          toast("কনফিগারেশন মুছে ফেলা হয়েছে", "success");
        } catch (err) {
          logger.error("DELETE PLATFORM SMS CONFIG ERROR:", err);
          toast("মুছে ফেলা যায়নি", "error");
        }
      },
    });
  };

  const checkBalance = async () => {
    setChecking(true);
    try {
      const result = await checkPlatformSmsBalance();
      setBalanceResult(result);
      if (!result.success) toast(result.errorMessage || "ব্যালেন্স চেক করা যায়নি", "error");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "ব্যালেন্স চেক করা যায়নি";
      logger.error("CHECK PLATFORM SMS BALANCE ERROR:", err);
      setBalanceResult({ success: false, errorMessage: msg });
      toast(msg, "error");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <MessageSquare size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">SMS গেটওয়ে</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              সব মাদ্রাসার SMS নোটিফিকেশন এই একটি অ্যাকাউন্ট থেকে পাঠানো হবে।
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
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold dark:text-slate-200">গেটওয়ে (ঐচ্ছিক লেবেল)</label>
              <input
                className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. BulkSMSBD"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold dark:text-slate-200">Sender ID</label>
              <input
                className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="ঐচ্ছিক"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold dark:text-slate-200">API URL</label>
              <input
                className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold dark:text-slate-200">API Key</label>
              <input
                type="password"
                className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={configured ? "•••••••••• (পরিবর্তনে নতুন মান দিন)" : ""}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold dark:text-slate-200">HTTP Method</label>
              <select
                className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={httpMethod}
                onChange={(e) => setHttpMethod(e.target.value)}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="mt-3 text-xs font-medium text-blue-600 underline dark:text-blue-400"
          >
            {showAdvanced ? "অ্যাডভান্সড সেটিংস লুকান" : "অ্যাডভান্সড সেটিংস (প্যারামিটার নাম, ব্যালেন্স চেক)"}
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 rounded-md border border-dashed border-gray-300 p-3 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                গেটওয়ে যে প্যারামিটার নাম প্রত্যাশা করে, সেগুলো এখানে মিলিয়ে দিন (ডিফল্টে না মিললে SMS পাঠানো ব্যর্থ হবে)।
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold dark:text-slate-200">param: api key</label>
                  <input className="w-full rounded border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={paramApiKey} onChange={(e) => setParamApiKey(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold dark:text-slate-200">param: sender id</label>
                  <input className="w-full rounded border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={paramSenderId} onChange={(e) => setParamSenderId(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold dark:text-slate-200">param: number</label>
                  <input className="w-full rounded border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={paramNumber} onChange={(e) => setParamNumber(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold dark:text-slate-200">param: message</label>
                  <input className="w-full rounded border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={paramMessage} onChange={(e) => setParamMessage(e.target.value)} />
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-slate-400">
                ব্যালেন্স চেক করার এন্ডপয়েন্ট (না দিলে ব্যালেন্স চেক ফিচার কাজ করবে না):
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold dark:text-slate-200">Balance URL</label>
                  <input className="w-full rounded border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={balanceUrl} onChange={(e) => setBalanceUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold dark:text-slate-200">Method</label>
                  <select className="w-full rounded border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={balanceHttpMethod} onChange={(e) => setBalanceHttpMethod(e.target.value)}>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold dark:text-slate-200">param: api key</label>
                  <input className="w-full rounded border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={balanceParamApiKey} onChange={(e) => setBalanceParamApiKey(e.target.value)} />
                </div>
                <div className="sm:col-span-4">
                  <label className="mb-1 block text-xs font-semibold dark:text-slate-200">
                    Response এ ব্যালেন্স ফিল্ডের path (dot-path, যেমন "balance" বা "data.balance")
                  </label>
                  <input className="w-full rounded border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={balanceResponsePath} onChange={(e) => setBalanceResponsePath(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
            সেভ করার পর API Key আর কখনো দেখানো হয় না — পরিবর্তন করতে হলে আবার নতুন করে লিখুন।
          </p>
        </>
      )}

      {configured && balanceResult && (
        <div
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            balanceResult.success
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          }`}
        >
          {balanceResult.success
            ? balanceResult.balance !== undefined
              ? `ব্যালেন্স: ${balanceResult.balance}`
              : balanceResult.raw
                ? `গেটওয়ে সাড়া: ${balanceResult.raw}`
                : "গেটওয়ে সংযুক্ত আছে"
            : balanceResult.errorMessage || "চেক করা যায়নি"}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {configured && (
            <Button variant="danger" onClick={remove} disabled={loading || saving}>
              মুছুন
            </Button>
          )}
          {configured && (
            <button
              type="button"
              onClick={checkBalance}
              disabled={checking}
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
              {checking ? "চেক হচ্ছে..." : "ব্যালেন্স চেক করুন"}
            </button>
          )}
        </div>
        <Button onClick={save} disabled={loading || saving}>
          {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </Button>
      </div>
    </div>
  );
}

/** Platform-wide SMTP account used to send every madrasa's Email
 * notifications. SMTP has no balance concept, so this offers a
 * connection test instead. */
function EmailSettingsCard() {
  const toast = useToastStore((s) => s.show);

  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; errorMessage?: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPlatformEmailConfig()
      .then((data) => {
        if (cancelled) return;
        setConfigured(data.configured);
        setHost(data.host || "");
        setPort(data.port ? String(data.port) : "587");
        setSecure(Boolean(data.secure));
        setUser(data.user || "");
        setFromName(data.from_name || "");
        setFromEmail(data.from_email || "");
      })
      .catch((err) => {
        logger.error("LOAD PLATFORM EMAIL CONFIG ERROR:", err);
        toast("Email কনফিগারেশন লোড করা যায়নি", "error");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!host.trim() || !user.trim() || !pass.trim() || !fromEmail.trim()) {
      toast("Host, User, Password ও From Email — সবগুলো আবশ্যক", "error");
      return;
    }
    setSaving(true);
    try {
      await savePlatformEmailConfig({
        host: host.trim(),
        port: port ? Number(port) : 587,
        secure,
        user: user.trim(),
        pass: pass.trim(),
        from_name: fromName.trim() || undefined,
        from_email: fromEmail.trim(),
      });
      setConfigured(true);
      setPass("");
      setTestResult(null);
      toast("Email কনফিগারেশন সেভ হয়েছে", "success");
    } catch (err) {
      logger.error("SAVE PLATFORM EMAIL CONFIG ERROR:", err);
      toast("সেভ করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    useConfirmStore.getState().show({
      title: "Email কনফিগারেশন মুছুন",
      message: "প্ল্যাটফর্ম SMTP অ্যাকাউন্ট সরিয়ে ফেলতে চান? এরপর কোনো মাদ্রাসা থেকেই Email পাঠানো যাবে না।",
      confirmText: "মুছুন",
      danger: true,
      onConfirm: async () => {
        try {
          await deletePlatformEmailConfig();
          setConfigured(false);
          setHost("");
          setUser("");
          setPass("");
          setFromEmail("");
          setTestResult(null);
          toast("কনফিগারেশন মুছে ফেলা হয়েছে", "success");
        } catch (err) {
          logger.error("DELETE PLATFORM EMAIL CONFIG ERROR:", err);
          toast("মুছে ফেলা যায়নি", "error");
        }
      },
    });
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await checkPlatformEmailConnection();
      setTestResult(result);
      if (!result.success) toast(result.errorMessage || "সংযোগ ব্যর্থ হয়েছে", "error");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সংযোগ পরীক্ষা করা যায়নি";
      logger.error("TEST PLATFORM EMAIL CONNECTION ERROR:", err);
      setTestResult({ success: false, errorMessage: msg });
      toast(msg, "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <Mail size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Email (SMTP)</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              সব মাদ্রাসার Email নোটিফিকেশন এই একটি SMTP অ্যাকাউন্ট থেকে পাঠানো হবে।
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">SMTP Host</label>
            <input className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">Port</label>
            <input className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm dark:text-slate-200">
              <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
              Secure (SSL, port 465)
            </label>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">User</label>
            <input className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={user} onChange={(e) => setUser(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">Password</label>
            <input type="password" className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={configured ? "•••••••••• (পরিবর্তনে নতুন মান দিন)" : ""} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">From Name</label>
            <input className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Madrasa Management" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">From Email</label>
            <input className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="noreply@example.com" />
          </div>
        </div>
      )}
      {!loading && (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          সেভ করার পর Password আর কখনো দেখানো হয় না — পরিবর্তন করতে হলে আবার নতুন করে লিখুন।
        </p>
      )}

      {configured && testResult && (
        <div
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            testResult.success
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          }`}
        >
          {testResult.success ? "SMTP সংযোগ সফল" : testResult.errorMessage || "সংযোগ ব্যর্থ হয়েছে"}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {configured && (
            <Button variant="danger" onClick={remove} disabled={loading || saving}>
              মুছুন
            </Button>
          )}
          {configured && (
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw size={14} className={testing ? "animate-spin" : ""} />
              {testing ? "পরীক্ষা হচ্ছে..." : "সংযোগ পরীক্ষা করুন"}
            </button>
          )}
        </div>
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
      <SmsSettingsCard />
      <EmailSettingsCard />
    </div>
  );
}
