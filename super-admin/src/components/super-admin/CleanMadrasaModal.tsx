import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { getMadrasaCleanStats, type MadrasaCleanStats } from "../../services/superAdminApi";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

type CleanMode = "operational" | "full";

const EMPTY_STATS: MadrasaCleanStats = {
  students: 0,
  invoices: 0,
  exams: 0,
  attendanceRecords: 0,
  users: 0,
  staff: 0,
  teachers: 0,
};

export default function CleanMadrasaModal({
  madrasaId,
  madrasaName,
  busy = false,
  onConfirm,
  onClose,
}: {
  madrasaId: number;
  madrasaName: string;
  busy?: boolean;
  onConfirm: (payload: { mode: CleanMode; confirm_name: string; password: string }) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<CleanMode>("operational");
  const [stats, setStats] = useState<MadrasaCleanStats>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [confirmName, setConfirmName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [nameCopied, setNameCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const data = await getMadrasaCleanStats(madrasaId);
        if (!cancelled) setStats(data);
      } catch (err) {
        logger.error("Failed to load madrasa clean stats:", err);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [madrasaId]);

  // মোড পাল্টালে আগের ধাপগুলো আবার নতুন করে করতে হবে - ভুলবশত ভুল মোডে জমে থাকা
  // কনফার্মেশন দিয়ে সাবমিট হয়ে যাওয়া ঠেকাতে।
  const handleModeChange = (next: CleanMode) => {
    setMode(next);
    setConfirmName("");
    setAcknowledged(false);
    setPassword("");
  };

  const nameValid = confirmName.trim() === madrasaName;
  const canSubmit = nameValid && acknowledged && password.length > 0 && !busy;

  const copyName = async () => {
    try {
      await navigator.clipboard.writeText(madrasaName);
      setNameCopied(true);
      setTimeout(() => setNameCopied(false), 1500);
    } catch (err) {
      logger.error("Failed to copy madrasa name:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:p-6">
        <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">"{madrasaName}" এর ডেটা ক্লিন করুন</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          এই কাজ অপরিবর্তনীয় - মুছে যাওয়া ডেটা আর ফিরিয়ে আনা যাবে না।
        </p>

        {/* Mode selection */}
        <div className="mt-4 space-y-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              mode === "operational"
                ? "border-blue-400 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                : "border-gray-200 dark:border-slate-700"
            }`}
          >
            <input
              type="radio"
              className="mt-1"
              checked={mode === "operational"}
              onChange={() => handleModeChange("operational")}
              disabled={busy}
            />
            <div>
              <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                শুধু অপারেশনাল ডেটা
              </div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                ছাত্র, ভর্তি, ফি স্ট্রাকচার/ইনভয়েস/পেমেন্ট, একাউন্ট, উপস্থিতি, পরীক্ষা/রেজাল্ট/রুটিন,
                লাইব্রেরি ইস্যু, নোটিফিকেশন ও অ্যাক্টিভিটি লগ মুছে যাবে। মাদ্রাসার সেটিংস, বিভাগ/শ্রেণি/বিষয়
                কাঠামো, স্টাফ/শিক্ষক/ইউজার লগইন ও রোল-পারমিশন অক্ষত থাকবে।
              </div>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              mode === "full"
                ? "border-rose-400 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30"
                : "border-gray-200 dark:border-slate-700"
            }`}
          >
            <input
              type="radio"
              className="mt-1"
              checked={mode === "full"}
              onChange={() => handleModeChange("full")}
              disabled={busy}
            />
            <div>
              <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                একদম সব কিছু (ফ্যাক্টরি রিসেট)
              </div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                উপরের সব কিছুসহ সেটিংস, বিভাগ/শ্রেণি/বিষয় কাঠামো, স্টাফ/শিক্ষক, ওয়েবসাইট/ব্র্যান্ডিং, নথি
                টেমপ্লেট এবং প্রতিটি ইউজার লগইন-ও মুছে যাবে। শুধু মাদ্রাসার নাম/স্লাগ/প্ল্যান থাকবে -
                এরপর কেউ লগইন করতে পারবে না, যতক্ষণ না আপনি নতুন করে একটা ইউজার তৈরি করে দেন।
              </div>
            </div>
          </label>
        </div>

        {/* Stats preview */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-slate-800 dark:text-slate-200 sm:grid-cols-3">
          {statsLoading ? (
            <span className="col-span-full text-gray-500 dark:text-slate-400">লোড হচ্ছে...</span>
          ) : (
            <>
              <span>ছাত্র: {stats.students}</span>
              <span>ইনভয়েস: {stats.invoices}</span>
              <span>পরীক্ষা: {stats.exams}</span>
              <span>উপস্থিতি: {stats.attendanceRecords}</span>
              <span>ইউজার: {stats.users}</span>
              <span>স্টাফ/শিক্ষক: {stats.staff + stats.teachers}</span>
            </>
          )}
        </div>

        {/* Confirm 1: typed name */}
        <div className="mt-4">
          <label className="mb-1 flex flex-wrap items-center gap-1 text-xs font-medium text-gray-600 dark:text-slate-400">
            নিশ্চিত করতে মাদ্রাসার নাম হুবহু লিখুন: <span className="font-semibold">{madrasaName}</span>
            <button
              type="button"
              onClick={copyName}
              className="inline-flex items-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="নাম কপি করুন"
              aria-label="নাম কপি করুন"
              tabIndex={-1}
            >
              {nameCopied ? <Check size={14} className="text-green-600 dark:text-green-400" /> : <Copy size={14} />}
            </button>
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            disabled={busy}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {/* Confirm 2: explicit acknowledgement */}
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={busy}
          />
          আমি নিশ্চিত যে এই ডেটা স্থায়ীভাবে মুছে ফেলতে চাই এবং জানি এটা আর ফিরিয়ে আনা যাবে না।
        </label>

        {/* Password re-verify */}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
            আপনার সুপার অ্যাডমিন পাসওয়ার্ড দিন
          </label>
          <div className="relative">
            <input
              type={passwordVisible ? "text" : "password"}
              className="w-full rounded border border-gray-300 px-3 py-2 pr-10 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              // "new-password" (নয় "current-password") ব্যবহার করা হয়েছে যাতে
              // ব্রাউজার সেভ করা লগইন পাসওয়ার্ড এখানে নিজে থেকে বসিয়ে না দেয় -
              // এই কনফার্মেশনের পুরো পয়েন্টই হলো সুপার অ্যাডমিন সচেতনভাবে নিজের
              // পাসওয়ার্ড টাইপ করবেন।
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label={passwordVisible ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
              tabIndex={-1}
            >
              {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            বাতিল
          </Button>
          <Button
            variant="danger"
            disabled={!canSubmit}
            onClick={() => onConfirm({ mode, confirm_name: confirmName.trim(), password })}
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ক্লিন করা হচ্ছে...
              </span>
            ) : (
              "ডেটা ক্লিন করুন"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
