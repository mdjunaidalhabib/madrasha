import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { scanCard } from "../../services/attendanceKioskApi";

type ScanResult =
  | { type: "success"; name: string; roll: string | number }
  | { type: "already"; name: string }
  | { type: "notfound" }
  | { type: "error" };

const OVERLAY_DURATION_MS = 4000;
// RFID/NFC USB রিডার কীবোর্ড এমুলেট করে — কার্ডের UID-এর প্রতিটি অক্ষর
// কয়েক মিলিসেকেন্ডের ব্যবধানে টাইপ হয়, শেষে একটা Enter আসে। মানুষ কীবোর্ডে
// টাইপ করলে সাধারণত এর চেয়ে অনেক বেশি ব্যবধান থাকে। তাই দুই কী-প্রেসের
// মধ্যে ব্যবধান ১০০ মিলিসেকেন্ডের বেশি হলে বাফার রিসেট করে দেওয়া হয়, যাতে
// টাচ কিওস্কে ভুলবশত হওয়া মানুষের টাইপিং স্ক্যান হিসেবে ধরা না পড়ে।
const SCAN_KEY_GAP_RESET_MS = 100;

export default function AttendanceKioskPage() {
  const { madrasaSlug = "" } = useParams();
  const storageKey = `kiosk_key_${madrasaSlug}`;

  const [kioskKey, setKioskKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [result, setResult] = useState<ScanResult | null>(null);

  const busyRef = useRef(false);
  const overlayTimeoutRef = useRef<number | null>(null);
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

  // localStorage থেকে সংরক্ষিত কিওস্ক-কী লোড করা হয় — থাকলে সরাসরি স্ক্যান
  // স্ক্রিন দেখানো হয়, না থাকলে সেটআপ স্ক্রিন।
  useEffect(() => {
    try {
      setKioskKey(window.localStorage.getItem(storageKey));
    } catch {
      setKioskKey(null);
    }
  }, [storageKey]);

  // লাইভ ঘড়ি — প্রতি সেকেন্ডে আপডেট হয়।
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) window.clearTimeout(overlayTimeoutRef.current);
    };
  }, []);

  const handleScan = useCallback(
    async (cardUid: string) => {
      if (!madrasaSlug || !kioskKey) return;
      if (busyRef.current) return; // একটা স্ক্যান প্রসেস/ওভারলে দেখানো চলাকালীন নতুন স্ক্যান উপেক্ষা করা হয়
      busyRef.current = true;

      try {
        const res = await scanCard(madrasaSlug, kioskKey, cardUid);
        const data = res.data.data;
        if (data.alreadyMarked) {
          setResult({ type: "already", name: data.student.name_bn });
        } else {
          setResult({ type: "success", name: data.student.name_bn, roll: data.student.roll });
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setResult({ type: "notfound" });
        } else {
          setResult({ type: "error" });
        }
      } finally {
        if (overlayTimeoutRef.current) window.clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = window.setTimeout(() => {
          setResult(null);
          busyRef.current = false;
        }, OVERLAY_DURATION_MS);
      }
    },
    [madrasaSlug, kioskKey],
  );

  // কীবোর্ড-এমুলেটেড কার্ড স্ক্যান ধরার জন্য window-লেভেল লিসেনার — কোনো
  // দৃশ্যমান/ফোকাসযোগ্য input ব্যবহার করা হয়নি, যাতে টাচ কিওস্কে ফোকাস
  // ভুলবশত অন্য কোথাও সরে না যায়।
  useEffect(() => {
    if (!kioskKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Alt/Meta কম্বো মানুষের কীবোর্ড শর্টকাট হতে পারে — এগুলো উপেক্ষা করা হয়।
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const nowTs = Date.now();
      if (nowTs - lastKeyTimeRef.current > SCAN_KEY_GAP_RESET_MS) {
        bufferRef.current = "";
      }
      lastKeyTimeRef.current = nowTs;

      if (e.key === "Enter") {
        const uid = bufferRef.current.trim();
        bufferRef.current = "";
        if (uid) handleScan(uid);
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [kioskKey, handleScan]);

  const saveKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    try {
      window.localStorage.setItem(storageKey, trimmed);
    } catch {
      // localStorage না থাকলেও state-এ রেখে স্ক্যান স্ক্রিন দেখানো হয় — সেশনের
      // জন্য অন্তত কাজ করবে।
    }
    setKeyInput("");
    setKioskKey(trimmed);
  };

  const resetSetup = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setKioskKey(null);
    setResult(null);
    busyRef.current = false;
    bufferRef.current = "";
  };

  const dateStr = now.toLocaleDateString("bn-BD", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("bn-BD", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // ---------------- সেটআপ স্ক্রিন ----------------
  if (!kioskKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            কিওস্ক সেটআপ
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            এডমিন থেকে তৈরি করা কিওস্ক ডিভাইস কী পেস্ট করুন
          </p>
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveKey();
            }}
            placeholder="ডিভাইস কী"
            className="mt-4 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            autoFocus
          />
          <button
            type="button"
            onClick={saveKey}
            disabled={!keyInput.trim()}
            className="mt-4 h-11 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            সংরক্ষণ করুন
          </button>
        </div>
      </div>
    );
  }

  // ---------------- স্ক্যান স্ক্রিন ----------------
  const overlayStyles: Record<ScanResult["type"], string> = {
    success: "bg-emerald-600",
    already: "bg-blue-600",
    notfound: "bg-rose-600",
    error: "bg-rose-600",
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-900 text-white">
      <header className="flex flex-col items-center gap-1 border-b border-white/10 px-4 py-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{madrasaSlug || "কিওস্ক অ্যাটেন্ডেন্স"}</h1>
        <p className="text-lg text-white/80">{dateStr}</p>
        <p className="font-mono text-3xl font-bold tracking-wider sm:text-4xl">{timeStr}</p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-6xl">
          💳
        </div>
        <p className="text-2xl font-semibold sm:text-3xl">কার্ড স্ক্যান করুন</p>
        <p className="text-white/60">কার্ডটি কিওস্ক রিডারের কাছে ধরুন</p>
      </main>

      <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-sm text-white/50">
        <span>ফিঙ্গারপ্রিন্ট: ডিভাইস সংযুক্ত নেই</span>
        <button
          type="button"
          onClick={resetSetup}
          className="rounded-md px-2 py-1 text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
        >
          সেটআপ রিসেট
        </button>
      </footer>

      {result && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6 text-center text-white ${overlayStyles[result.type]}`}
        >
          {result.type === "success" && (
            <>
              <div className="text-7xl">✓</div>
              <p className="text-3xl font-bold sm:text-4xl">{result.name}</p>
              <p className="text-xl">রোল: {result.roll}</p>
              <p className="text-lg text-white/90">উপস্থিতি সফল হয়েছে</p>
            </>
          )}
          {result.type === "already" && (
            <>
              <div className="text-7xl">ℹ️</div>
              <p className="text-3xl font-bold sm:text-4xl">{result.name}</p>
              <p className="text-lg text-white/90">আজকের উপস্থিতি আগেই নেওয়া হয়েছে</p>
            </>
          )}
          {result.type === "notfound" && (
            <p className="text-2xl font-bold sm:text-3xl">
              ❌ কার্ড শনাক্ত হয়নি, অ্যাডমিনের সাথে যোগাযোগ করুন
            </p>
          )}
          {result.type === "error" && (
            <p className="text-2xl font-bold sm:text-3xl">ত্রুটি হয়েছে, আবার চেষ্টা করুন</p>
          )}
        </div>
      )}
    </div>
  );
}
