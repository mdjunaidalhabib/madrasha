import { useRef, useState } from "react";
import { ImageUp, Loader2, Pencil, X } from "lucide-react";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { uploadApi, type UploadFolder } from "../../services/phase4Api";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { commonText, getText, localizeDigits, getLang, useText } from "@madrasha/shared-ui/src/i18n";
import { settingsUiText } from "./settingsUi.text";

type Props = {
  label: string;
  hint?: string;
  value: string | null | undefined;
  onChange: (dataUrl: string) => void;
  onRemove: () => void;
  /** Hosted URL on success; null on failure. onChange only receives hosted URLs. */
  onUploaded?: (url: string | null) => void | Promise<void>;
  onUploadingChange?: (uploading: boolean) => void;
  shape?: "square" | "wide";
  imageFit?: "contain" | "cover";
  variant?: "default" | "gallery";
  /** Overrides the shape-based default ratio badge ("১৬:৯"/"১:১") - for a
   * shape whose real recommended ratio doesn't match either default (e.g.
   * a report header/footer banner, much thinner than 16:9). */
  ratioLabel?: string;
  folder?: UploadFolder;
  /** When set, any picked image is center-cropped and scaled to exactly
   * this pixel size (cover-fit, no distortion) and re-encoded as JPEG
   * client-side before preview/upload - so admins can drop in any photo
   * of any size/ratio and it still lands at the exact dimensions the
   * public site expects. */
  resizeTo?: { width: number; height: number };
};

const MAX_SIZE = 10 * 1024 * 1024;

/** Center-crops `src` to the target aspect ratio (cover-fit, never
 * stretched) then scales to exactly width x height, returning a JPEG
 * data URL. */
function resizeImageToJpeg(src: string, width: number, height: number, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas 2d context unavailable"));
        return;
      }
      const targetRatio = width / height;
      const srcRatio = img.width / img.height;
      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;
      if (srcRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

export default function BrandImageBox({
  label,
  hint,
  value,
  onChange,
  onRemove,
  onUploaded,
  onUploadingChange,
  shape = "square",
  imageFit = "contain",
  variant = "default",
  ratioLabel: ratioLabelProp,
  folder = "branding",
  resizeTo,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const t = useText(settingsUiText);
  const c = useText(commonText);

  const updateUploading = (active: boolean) => {
    setUploading(active);
    onUploadingChange?.(active);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      useToastStore.getState().show(getText(settingsUiText).onlyPngJpg, "error");
      return;
    }

    if (file.size > MAX_SIZE) {
      useToastStore.getState().show(
        getText(settingsUiText).maxImageSize(
          localizeDigits(MAX_SIZE / (1024 * 1024), getLang()),
        ),
        "error"
      );
      return;
    }

    const reader = new FileReader();
    updateUploading(true);
    reader.onerror = () => {
      useToastStore.getState().show(getText(settingsUiText).uploadFailed, "error");
      onUploaded?.(null);
      updateUploading(false);
    };
    reader.onload = async () => {
      let base64 = reader.result as string;
      if (resizeTo) {
        try {
          base64 = await resizeImageToJpeg(base64, resizeTo.width, resizeTo.height);
        } catch (err) {
          logger.error("IMAGE RESIZE ERROR:", err);
        }
      }
      setPreview(base64);

      try {
        const res = await uploadApi.uploadImage(base64, folder);
        const data = res.data?.data;
        if (data?.uploaded && data.url) {
          onChange(data.url);
          await onUploaded?.(data.url);
        } else {
          throw new Error(getText(settingsUiText).uploadFailed);
        }
      } catch (err) {
        logger.error("BRANDING IMAGE UPLOAD ERROR:", err);
        const error = err as { response?: { data?: { message?: string } }; message?: string };
        useToastStore.getState().show(error.response?.data?.message || error.message || getText(settingsUiText).uploadFailed, "error");
        await onUploaded?.(null);
      } finally {
        setPreview(null);
        updateUploading(false);
      }
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const ratioLabel = ratioLabelProp ?? (shape === "wide" ? t.ratioWide : t.ratioSquare);

  return (
    <div className={variant === "gallery" ? "min-w-0" : "rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"}>
      <p className="font-semibold text-gray-900 dark:text-slate-100">{label}</p>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-slate-400">{hint}</p>}
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        {t.fileLimits(localizeDigits(["students", "teachers", "staff", "profile"].includes(folder) ? 80 : folder === "branding" ? 300 : ["certificates", "document-templates"].includes(folder) ? 1024 : 250, getLang()))}
      </p>

      <div
        onClick={() => { if (!uploading) fileRef.current?.click(); }}
        role="button"
        tabIndex={0}
        aria-disabled={uploading}
        onKeyDown={(e) => {
          if (!uploading && (e.key === "Enter" || e.key === " ")) fileRef.current?.click();
        }}
        className={`group relative mt-3 flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-gray-50 transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:bg-blue-950/30 ${
          variant === "gallery" ? `${shape === "wide" ? "aspect-[21/9]" : "aspect-square"} w-full rounded-2xl border-indigo-200 bg-white dark:border-indigo-800 dark:bg-slate-900` : shape === "wide" ? "h-28 w-full" : "h-32 w-32"
        }`}
        style={{
          backgroundImage: preview || value ? `url(${preview || value})` : "none",
          backgroundSize: imageFit,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        {!value && (
          <span className="flex flex-col items-center gap-1 px-2 text-center text-xs text-gray-400 dark:text-slate-500">
            <ImageUp size={22} className="text-gray-300 transition group-hover:text-blue-400 dark:text-slate-600 dark:group-hover:text-blue-400" />
            <span>{t.uploadImage}</span>
            <span className="text-[10px] text-gray-300 dark:text-slate-600">{ratioLabel}</span>
          </span>
        )}

        {value && !uploading && (
          <>
            <span className="pointer-events-none absolute start-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {ratioLabel}
            </span>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
              <Pencil size={16} />
              <span className="text-xs font-medium">{t.change}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-600 opacity-100 shadow transition hover:bg-red-50 dark:bg-slate-800/90 dark:hover:bg-red-950/40 sm:opacity-0 sm:group-hover:opacity-100"
              title={c.delete}
            >
              <X size={14} />
            </button>
          </>
        )}

        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 text-xs text-white">
            <Loader2 size={14} className="animate-spin" />
            {t.uploading}
          </span>
        )}
      </div>

      <input
        type="file"
        ref={fileRef}
        hidden
        disabled={uploading}
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
      />
    </div>
  );
}
