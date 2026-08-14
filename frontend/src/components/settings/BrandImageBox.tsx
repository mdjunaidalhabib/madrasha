import { useRef, useState } from "react";
import { ImageUp, Loader2, Pencil, X } from "lucide-react";
import { useToastStore } from "../../store/toastStore";
import { uploadApi, type UploadFolder } from "../../services/phase4Api";
import { logger } from "../../utils/logger";

type Props = {
  label: string;
  hint?: string;
  value: string | null | undefined;
  onChange: (dataUrl: string) => void;
  onRemove: () => void;
  /** Fires once the upload attempt for a newly picked file settles - the
   * hosted URL on success, or null if cloud storage rejected it / isn't
   * configured (the base64 set via onChange is kept as a fallback then). */
  onUploaded?: (url: string | null) => void;
  shape?: "square" | "wide";
  folder?: UploadFolder;
};

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export default function BrandImageBox({
  label,
  hint,
  value,
  onChange,
  onRemove,
  onUploaded,
  shape = "square",
  folder = "branding",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      useToastStore.getState().show("শুধু PNG, JPG বা JPEG ছবি আপলোড করা যাবে", "error");
      return;
    }

    if (file.size > MAX_SIZE) {
      useToastStore.getState().show("ছবির সাইজ ২MB এর কম হতে হবে", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      onChange(base64);

      try {
        setUploading(true);
        const res = await uploadApi.uploadImage(base64, folder);
        const data = res.data?.data;
        if (data?.uploaded && data.url) {
          onChange(data.url);
          onUploaded?.(data.url);
        } else {
          // cloud storage not configured yet - keep the base64 already set.
          onUploaded?.(null);
        }
      } catch (err) {
        logger.error("BRANDING IMAGE UPLOAD ERROR:", err);
        onUploaded?.(null);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const ratioLabel = shape === "wide" ? "অনুপাত ১৬:৯" : "অনুপাত ১:১";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="font-semibold text-gray-900 dark:text-slate-100">{label}</p>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-slate-400">{hint}</p>}

      <div
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        className={`group relative mt-3 flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-gray-50 transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:bg-blue-950/30 ${
          shape === "wide" ? "h-28 w-full" : "h-32 w-32"
        }`}
        style={{
          backgroundImage: value ? `url(${value})` : "none",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        {!value && (
          <span className="flex flex-col items-center gap-1 px-2 text-center text-xs text-gray-400 dark:text-slate-500">
            <ImageUp size={22} className="text-gray-300 transition group-hover:text-blue-400 dark:text-slate-600 dark:group-hover:text-blue-400" />
            <span>ছবি আপলোড করুন</span>
            <span className="text-[10px] text-gray-300 dark:text-slate-600">{ratioLabel}</span>
          </span>
        )}

        {value && !uploading && (
          <>
            <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {ratioLabel}
            </span>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
              <Pencil size={16} />
              <span className="text-xs font-medium">পরিবর্তন করুন</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-600 opacity-100 shadow transition hover:bg-red-50 dark:bg-slate-800/90 dark:hover:bg-red-950/40 sm:opacity-0 sm:group-hover:opacity-100"
              title="মুছুন"
            >
              <X size={14} />
            </button>
          </>
        )}

        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 text-xs text-white">
            <Loader2 size={14} className="animate-spin" />
            আপলোড হচ্ছে...
          </span>
        )}
      </div>

      <input
        type="file"
        ref={fileRef}
        hidden
        accept="image/png,image/jpeg"
        onChange={handleFile}
      />
    </div>
  );
}
