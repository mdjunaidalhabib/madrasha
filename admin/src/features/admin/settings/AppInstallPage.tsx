import { useState } from "react";
import { CheckCircle2, Download, Share, Smartphone } from "lucide-react";
import { defineText, useText } from "@madrasha/shared-ui/src/i18n";
import { isIos, isStandalone, promptInstall, usePwaInstall } from "@madrasha/shared-ui/src/pwa/pwa";
import SectionCard from "../../../components/settings/SectionCard";

const text = defineText({
  bn: {
    title: "অ্যাপ ইনস্টলার",
    hint: "ইনস্টল পপআপ বন্ধ করলেও এখান থেকে যেকোনো সময় অ্যাপ ইনস্টল করতে পারবেন।",
    description: "হোম স্ক্রিন বা ডেস্কটপ থেকে সরাসরি আপনার প্রতিষ্ঠানের অ্যাপ খুলুন।",
    install: "অ্যাপ ইনস্টল করুন",
    busy: "অপেক্ষা করুন…",
    installed: "অ্যাপ ইনস্টল করা আছে",
    installedHint: "আপনি এখন ইনস্টল করা অ্যাপ ব্যবহার করছেন।",
    manual: "ইনস্টল করার পদ্ধতি",
    ios: "Safari-তে এই পেজ খুলুন। Share বাটনে চাপুন, “Add to Home Screen” নির্বাচন করে “Add” চাপুন।",
    browser:
      "ব্রাউজারের মেনু থেকে “Install app” বা “Add to Home Screen” নির্বাচন করুন। অপশনটি না পেলে Chrome বা Edge-এ এই পেজ খুলুন।",
    retry: "ইনস্টল সম্পন্ন হয়নি। আবার চেষ্টা করতে পারেন অথবা ব্রাউজারের মেনু ব্যবহার করুন।",
  },
  en: {
    title: "App Installer",
    hint: "Install the app here anytime, even after closing the install popup.",
    description: "Open your institution’s app directly from your home screen or desktop.",
    install: "Install app",
    busy: "Please wait…",
    installed: "App installed",
    installedHint: "You are using the installed app.",
    manual: "How to install",
    ios: "Open this page in Safari. Tap Share, choose “Add to Home Screen”, then tap “Add”.",
    browser:
      "Choose “Install app” or “Add to Home Screen” from your browser menu. If the option is missing, open this page in Chrome or Edge.",
    retry: "Installation did not complete. Try again or use your browser menu.",
  },
});

export default function AppInstallPage() {
  const t = useText(text);
  const { installEnabled, deferredPrompt, installed, appName, iconUrl } = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(false);
  const alreadyInstalled = installed || isStandalone();
  const install = async () => {
    setBusy(true);
    setMessage(false);
    try {
      if (!(await promptInstall())) setMessage(true);
    } catch {
      setMessage(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title={t.title} hint={t.hint}>
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-contain" />
        ) : (
          <Smartphone size={48} className="shrink-0 text-emerald-600" />
        )}
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">{appName || "EMS Admin"}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.description}</p>
        </div>
      </div>
      {alreadyInstalled ? (
        <div
          role="status"
          className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={20} />
            {t.installed}
          </p>
          <p className="mt-2 text-sm">{t.installedHint}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {installEnabled && deferredPrompt && (
            <button
              type="button"
              disabled={busy}
              onClick={install}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Download size={18} />
              {busy ? t.busy : t.install}
            </button>
          )}
          {message && (
            <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
              {t.retry}
            </p>
          )}
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="flex items-center gap-2 font-semibold">
              <Share size={18} />
              {t.manual}
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">
              {isIos() ? t.ios : t.browser}
            </p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
