import { useEffect, useState } from "react";
import { Download, PlusSquare, Share, X } from "lucide-react";
import { isIos, isStandalone, promptInstall, usePwaInstall } from "./pwa";

interface InstallPromptProps {
  /** Shown as the banner heading, e.g. "QMS Admin" or the madrasa's name. */
  appName: string;
  description?: string;
  /** localStorage key that remembers a ✕ click; separate per app. */
  storageKey?: string;
  /** Routes where the banner must never appear (print/headless pages, kiosk…). */
  hideOnPaths?: RegExp;
}

// After ✕ the banner stays away for this long, then asks again on the next visit.
const DISMISS_MS = 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 1500;

const readDismissedAt = (key: string) => {
  try {
    return Number(localStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
};

export default function InstallPrompt({
  appName,
  description = "এক ক্লিকে ইনস্টল করুন — হোম স্ক্রিন থেকে দ্রুত খুলুন, অ্যাপের মতো ব্যবহার করুন।",
  storageKey = "pwa:install-dismissed-at",
  hideOnPaths,
}: InstallPromptProps) {
  const { deferredPrompt, installed, appName: manifestName } = usePwaInstall();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => Date.now() - readDismissedAt(storageKey) < DISMISS_MS,
  );
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  // Small delay so the banner doesn't compete with the page's first paint.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const ios = isIos();
  const canInstall = !!deferredPrompt || ios;
  const blockedPath = hideOnPaths?.test(window.location.pathname);

  if (!ready || dismissed || installed || isStandalone() || !canInstall || blockedPath) return null;

  const close = () => {
    try {
      localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // Private mode etc. - still hide for this page view.
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) {
      setShowIosSteps(true);
      return;
    }
    setBusy(true);
    try {
      const accepted = await promptInstall();
      if (!accepted) close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="অ্যাপ ইনস্টল"
      className="fixed inset-x-3 bottom-3 z-[9998] animate-heroFadeUp sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px] print:hidden"
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <button
          type="button"
          onClick={close}
          aria-label="বন্ধ করুন"
          className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl shadow-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
              {manifestName || appName} অ্যাপ ইনস্টল করুন
            </p>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-600 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>

        {showIosSteps ? (
          <ol className="mt-3 space-y-1.5 rounded-xl bg-emerald-50 p-3 text-[13px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <span className="font-semibold">১.</span> নিচের
              <Share size={16} className="text-sky-600" /> Share বাটনে চাপুন
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold">২.</span>
              <PlusSquare size={16} className="text-slate-700 dark:text-slate-200" />
              “Add to Home Screen” নির্বাচন করুন
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold">৩.</span> উপরে “Add” চাপুন
            </li>
          </ol>
        ) : null}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {showIosSteps ? "ঠিক আছে" : "এখন না"}
          </button>
          {!showIosSteps && (
            <button
              type="button"
              onClick={install}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Download size={16} />
              ইনস্টল
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
