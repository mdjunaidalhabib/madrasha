import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, Loader2, RefreshCw, Trash2, User, X, SwitchCamera, Check } from "lucide-react";
import { uploadApi, type UploadFolder } from "../../services/phase4Api";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";

/* ------------------------------------------------------------------ */
/*  Image helpers                                                      */
/* ------------------------------------------------------------------ */

// Passport-style 3:4 output, capped so base64 fallbacks (no Cloudinary)
// stay small in the DB.
const OUT_W = 480;
const OUT_H = 640;

/** Center-crops any drawable source to 3:4 and returns a JPEG data-URI. */
function cropToPortrait(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  mirror = false,
): string {
  const targetRatio = OUT_W / OUT_H;
  let sw = srcW;
  let sh = srcH;
  if (srcW / srcH > targetRatio) sw = srcH * targetRatio;
  else sh = srcW / targetRatio;
  const sx = (srcW - sw) / 2;
  const sy = (srcH - sh) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext("2d")!;
  if (mirror) {
    ctx.translate(OUT_W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
  return canvas.toDataURL("image/jpeg", 0.88);
}

/** Reads a picked file and normalizes it to the same 3:4 JPEG. */
export function fileToPortraitDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(cropToPortrait(img, img.naturalWidth, img.naturalHeight));
      img.onerror = () => reject(new Error("invalid image"));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a data-URI to cloud storage. Returns the hosted URL, or the
 * data-URI itself when cloud storage isn't configured / upload fails
 * (same fallback the old per-form uploaders used).
 */
export async function uploadPhoto(dataUrl: string, folder: UploadFolder): Promise<string> {
  try {
    const res = await uploadApi.uploadImage(dataUrl, folder);
    const data = res.data?.data;
    if (data?.uploaded && data.url) return data.url;
  } catch (err) {
    logger.error("PHOTO UPLOAD ERROR:", err);
  }
  return dataUrl;
}

/* ------------------------------------------------------------------ */
/*  Camera modal                                                       */
/* ------------------------------------------------------------------ */

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraModalProps> = ({
  open,
  onClose,
  onCapture,
  title = "ক্যামেরা দিয়ে ছবি তুলুন",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [hasMultipleCams, setHasMultipleCams] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open || shot) return;
    let cancelled = false;
    const start = async () => {
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
        logger.error("CAMERA ERROR:", err);
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
    };
    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, shot, stop]);

  useEffect(() => {
    if (!open) {
      setShot(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setShot(cropToPortrait(v, v.videoWidth, v.videoHeight, facing === "user"));
    stop();
  };

  const confirm = () => {
    if (!shot) return;
    onCapture(shot);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Camera className="h-4 w-4 text-emerald-600" />
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="বন্ধ করুন"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-xl bg-slate-950">
            {shot ? (
              <img src={shot} alt="" className="h-full w-full object-cover" />
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                  style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
                />
                {/* face guide */}
                {!error && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-[58%] w-[62%] rounded-[50%] border-2 border-dashed border-white/60" />
                  </div>
                )}
                {starting && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/80">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/90">
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
          {!shot && !error && (
            <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              মুখ ডিম্বাকার গাইডের ভেতরে রেখে ছবি তুলুন
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
          {shot ? (
            <>
              <button
                type="button"
                onClick={() => setShot(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw className="h-4 w-4" /> আবার তুলুন
              </button>
              <button
                type="button"
                onClick={confirm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" /> ব্যবহার করুন
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                disabled={!hasMultipleCams}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                title="ক্যামেরা বদলান"
              >
                <SwitchCamera className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={capture}
                disabled={!!error || starting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" /> ছবি তুলুন
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* ------------------------------------------------------------------ */
/*  Compact photo picker (forms)                                       */
/* ------------------------------------------------------------------ */

interface PhotoPickerProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  folder: UploadFolder;
  label?: string;
  hint?: string;
  /** "row" = compact horizontal card for forms; "stack" = avatar above buttons. */
  layout?: "row" | "stack";
  className?: string;
}

/**
 * Compact passport-photo field: thumbnail + "আপলোড" / "ক্যামেরা" / remove.
 * Images are normalized to a 3:4 JPEG, previewed instantly, then swapped
 * for the hosted URL once the cloud upload finishes.
 */
const PhotoPicker: React.FC<PhotoPickerProps> = ({
  value,
  onChange,
  folder,
  label = "ছবি",
  hint = "JPG/PNG · পাসপোর্ট সাইজ (৩:৪)",
  layout = "row",
  className = "",
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const accept = async (dataUrl: string) => {
    onChange(dataUrl); // instant preview + fallback value
    setUploading(true);
    const url = await uploadPhoto(dataUrl, folder);
    if (url !== dataUrl) onChange(url);
    setUploading(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await accept(await fileToPortraitDataUrl(file));
    } catch (err) {
      logger.error("PHOTO READ ERROR:", err);
      useToastStore.getState().show("ছবিটি পড়া যায়নি — সঠিক ইমেজ ফাইল দিন", "error");
    }
  };

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50";

  return (
    <div
      className={`flex ${layout === "row" ? "items-center gap-4" : "flex-col items-center gap-3"} ${className}`}
    >
      <div className="relative h-[104px] w-[78px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
            <User className="h-10 w-10" strokeWidth={1.5} />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className={`min-w-0 ${layout === "stack" ? "text-center" : ""}`}>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</div>
        <div className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
          {uploading ? "আপলোড হচ্ছে..." : hint}
        </div>
        <div className={`flex flex-wrap gap-2 ${layout === "stack" ? "justify-center" : ""}`}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`${btn} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
          >
            <ImagePlus className="h-3.5 w-3.5" /> আপলোড
          </button>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={uploading}
            className={`${btn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            <Camera className="h-3.5 w-3.5" /> ক্যামেরা
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={uploading}
              className={`${btn} border-transparent px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40`}
              title="ছবি মুছুন"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <CameraCaptureModal open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={accept} />
    </div>
  );
};

export default PhotoPicker;
