import { useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";
import { useToastStore } from "../../store/toastStore";
import { uploadApi, type UploadFolder } from "../../services/phase4Api";
import { logger } from "../../utils/logger";

type Props = {
  label: string;
  hint?: string;
  value: string | null | undefined;
  onChange: (dataUrl: string) => void;
  onRemove: () => void;
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
        }
        // else: cloud storage not configured yet - keep the base64 already set.
      } catch (err) {
        logger.error("BRANDING IMAGE UPLOAD ERROR:", err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="font-semibold text-gray-900">{label}</p>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{hint}</p>}

      <div
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        className={`relative mt-3 flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-gray-50 transition hover:border-blue-300 hover:bg-blue-50/40 ${
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
          <span className="flex flex-col items-center gap-1.5 px-2 text-center text-xs text-gray-400">
            <ImageUp size={22} className="text-gray-300" />
            ছবি আপলোড করুন
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 text-xs text-white">
            <Loader2 size={14} className="animate-spin" />
            আপলোড হচ্ছে...
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
        >
          <ImageUp size={14} />
          আপলোড
        </button>
        {value && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
          >
            <X size={14} />
            মুছুন
          </button>
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
