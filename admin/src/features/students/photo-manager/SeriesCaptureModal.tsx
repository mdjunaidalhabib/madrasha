import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PartyPopper,
  SkipForward,
  SwitchCamera,
  User,
  X,
} from "lucide-react";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { captureVideoFrame, type CardStatus, type PhotoPerson } from "./photoManager";

type Props = {
  open: boolean;
  /** Snapshot taken when the mode started - saving a photo doesn't reshuffle it. */
  queue: PhotoPerson[];
  onClose: () => void;
  /** Uploads + saves; resolves true on success. The modal doesn't wait on it to move on. */
  onCapture: (person: PhotoPerson, dataUrl: string) => Promise<boolean>;
};

/**
 * "ক্যামেরা সিরিজ মোড" - one live camera stream kept open while the operator
 * walks down the queue: ছবি তুলুন -> saved in the background -> next person.
 * Space/Enter = capture, → = skip, ← = previous, Esc = close.
 */
export default function SeriesCaptureModal({ open, queue, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [hasMultipleCams, setHasMultipleCams] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState<Record<number, { url: string; status: CardStatus }>>({});

  useEffect(() => {
    if (open) {
      setIndex(0);
      setShots({});
    }
  }, [open]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finished = index >= queue.length;

  // One stream for the whole series - only restarted when the camera is switched.
  useEffect(() => {
    if (!open || finished) return;
    let cancelled = false;
    (async () => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("এই ব্রাউজারে ক্যামেরা সাপোর্ট নেই (HTTPS বা localhost প্রয়োজন)।");
        return;
      }
      setStarting(true);
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) setHasMultipleCams(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (err: any) {
        logger.error("SERIES CAMERA ERROR:", err);
        if (!cancelled) {
          setError(
            err?.name === "NotAllowedError"
              ? "ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি। ব্রাউজারের ঠিকানা-বারের পাশ থেকে অনুমতি দিন।"
              : err?.name === "NotFoundError"
                ? "কোনো ক্যামেরা পাওয়া যায়নি।"
                : "ক্যামেরা চালু করা যায়নি।",
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, finished, stop]);

  const current = queue[index];

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!current || !v || !v.videoWidth || error) return;
    const dataUrl = captureVideoFrame(v, facing === "user");
    const person = current;

    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    setShots((prev) => ({ ...prev, [person.id]: { url: dataUrl, status: "saving" } }));
    setIndex((i) => i + 1);

    onCapture(person, dataUrl).then((ok) =>
      setShots((prev) => ({ ...prev, [person.id]: { url: dataUrl, status: ok ? "saved" : "error" } })),
    );
  }, [current, error, facing, onCapture]);

  const skip = useCallback(() => setIndex((i) => Math.min(i + 1, queue.length)), [queue.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (finished) return;
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        capture();
      } else if (e.key === "ArrowRight") skip();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finished, capture, skip, prev, onClose]);

  if (!open) return null;

  const shotList = Object.values(shots);
  const savedCount = shotList.filter((s) => s.status === "saved").length;
  const failedCount = shotList.filter((s) => s.status === "error").length;
  const pendingCount = shotList.filter((s) => s.status === "saving").length;
  const progress = queue.length ? Math.round((Math.min(index, queue.length) / queue.length) * 100) : 0;
  const recent = queue.filter((p) => shots[p.id]).slice(-12).reverse();
  const currentShot = current ? shots[current.id] : undefined;

  const ghostBtn =
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-slate-900/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Camera className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">ক্যামেরা সিরিজ মোড</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {toBanglaDigits(Math.min(index + 1, queue.length))} / {toBanglaDigits(queue.length)} · সংরক্ষিত{" "}
              {toBanglaDigits(savedCount)}
              {pendingCount > 0 && ` · চলছে ${toBanglaDigits(pendingCount)}`}
              {failedCount > 0 && ` · ব্যর্থ ${toBanglaDigits(failedCount)}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="বন্ধ করুন"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {finished ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <PartyPopper className="h-8 w-8" />
              </div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">সিরিজ শেষ হয়েছে</div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {toBanglaDigits(savedCount)} টি ছবি সংরক্ষিত
                {pendingCount > 0 && `, ${toBanglaDigits(pendingCount)} টি সংরক্ষণ হচ্ছে`}
                {failedCount > 0 && `, ${toBanglaDigits(failedCount)} টি ব্যর্থ`}
                {queue.length - shotList.length > 0 && `, ${toBanglaDigits(queue.length - shotList.length)} জন বাদ গেছে`}
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={prev} className={ghostBtn}>
                  <ChevronLeft className="h-4 w-4" /> পেছনে যান
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  সম্পন্ন
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,340px)_1fr] md:gap-6 md:p-6">
              {/* Live camera */}
              <div className="mx-auto w-full max-w-[340px]">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-950">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                    style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
                  />
                  {!error && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-[58%] w-[62%] rounded-[50%] border-2 border-dashed border-white/60" />
                    </div>
                  )}
                  {starting && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/80">
                      <Loader2 className="h-7 w-7 animate-spin" />
                    </div>
                  )}
                  {error && (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/90">
                      {error}
                    </div>
                  )}
                  <div
                    className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${flash ? "opacity-80" : "opacity-0"}`}
                  />
                </div>
              </div>

              {/* Current person + controls */}
              <div className="flex min-w-0 flex-col gap-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    এখন যার ছবি তুলবেন
                  </div>
                  <div className="mt-1 flex items-start gap-3">
                    <div className="h-20 w-[60px] shrink-0 overflow-hidden rounded-lg border border-emerald-200 bg-white dark:border-emerald-900 dark:bg-slate-800">
                      {currentShot?.url || current.image ? (
                        <img src={currentShot?.url || current.image!} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
                          <User className="h-8 w-8" strokeWidth={1.25} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xl font-bold leading-tight text-slate-900 dark:text-white sm:text-2xl">
                        {current.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{current.subtitle || "—"}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {current.roll && (
                          <span className="rounded-lg bg-emerald-600 px-2.5 py-1 text-sm font-bold text-white">
                            রোল {toBanglaDigits(current.roll)}
                          </span>
                        )}
                        {current.regNo && (
                          <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                            রেজি. {toBanglaDigits(current.regNo)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {queue[index + 1] && (
                    <div className="mt-3 truncate border-t border-emerald-200/70 pt-2 text-xs text-slate-500 dark:border-emerald-900/50 dark:text-slate-400">
                      পরবর্তী: <span className="font-medium text-slate-700 dark:text-slate-200">{queue[index + 1].name}</span>
                      {queue[index + 1].roll && ` · রোল ${toBanglaDigits(queue[index + 1].roll!)}`}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={prev} disabled={index === 0} className={ghostBtn} title="পূর্ববর্তী (←)">
                    <ChevronLeft className="h-4 w-4" /> পূর্ববর্তী
                  </button>
                  <button type="button" onClick={skip} className={ghostBtn} title="এড়িয়ে যান (→)">
                    <SkipForward className="h-4 w-4" /> এড়িয়ে যান
                  </button>
                  <button
                    type="button"
                    onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                    disabled={!hasMultipleCams}
                    className={ghostBtn}
                    title="ক্যামেরা বদলান"
                    aria-label="ক্যামেরা বদলান"
                  >
                    <SwitchCamera className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={capture}
                  disabled={!!error || starting}
                  className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50"
                >
                  <Camera className="h-5 w-5" /> ছবি তুলুন ও পরবর্তী
                  <ChevronRight className="h-5 w-5" />
                </button>
                <p className="-mt-2 hidden text-center text-xs text-slate-400 sm:block">
                  কিবোর্ড: Space = ছবি তুলুন · → = এড়িয়ে যান · ← = পূর্ববর্তী
                </p>

                {recent.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">সাম্প্রতিক</div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {recent.map((p) => {
                        const s = shots[p.id];
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setIndex(queue.indexOf(p))}
                            className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                            title={`${p.name} - আবার তুলতে ক্লিক করুন`}
                          >
                            <img src={s.url} alt="" className="h-full w-full object-cover" />
                            <span className="absolute bottom-0.5 right-0.5">
                              {s.status === "saving" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-white drop-shadow" />
                              ) : s.status === "saved" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 rounded-full bg-white text-emerald-600" />
                              ) : (
                                <AlertCircle className="h-3.5 w-3.5 rounded-full bg-white text-rose-600" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
