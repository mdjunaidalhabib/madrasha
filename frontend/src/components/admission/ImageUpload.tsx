import { useRef, useState, useEffect } from "react";
import { AdmissionFormData } from "../../features/students/AdmissionPage";
import { uploadApi } from "../../services/phase4Api";
import { logger } from "../../utils/logger";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
}

const ImageUpload: React.FC<Props> = ({ formData, setFormData }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64 = reader.result as string;

      // Instant local preview + a safe fallback value in case the
      // upload below fails or Cloudinary isn't configured yet.
      setPreview(base64);
      setFormData((prev) => ({ ...prev, image: base64 }));

      try {
        setUploading(true);
        const res = await uploadApi.uploadImage(base64, "students");
        const data = res.data?.data;
        if (data?.uploaded && data.url) {
          // Cloud storage is configured - store the hosted URL instead
          // of the base64 blob.
          setFormData((prev) => ({ ...prev, image: data.url as string }));
        }
        // else: cloud storage isn't configured yet - the base64 value
        // set above is kept as-is, same as before this feature existed.
      } catch (err) {
        logger.error("STUDENT PHOTO UPLOAD ERROR:", err);
        // Keep the base64 fallback already set above.
      } finally {
        setUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  // ✅ FIX: reset preview when form resets
  useEffect(() => {
    if (!formData.image) {
      setPreview(null);
    }
  }, [formData.image]);

  return (
    <div className="flex justify-center">
      <div
        className="w-40 h-40 rounded-xl border-2 border-dashed border-gray-400 flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition overflow-hidden relative dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
        onClick={() => fileRef.current?.click()}
        style={{
          backgroundImage: preview ? `url(${preview})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!preview && (
          <span className="text-gray-500 text-sm dark:text-slate-400">Upload Photo</span>
        )}
        {uploading && (
          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
            আপলোড হচ্ছে...
          </span>
        )}
      </div>

      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept="image/*"
        onChange={handleImage}
      />
    </div>
  );
};

export default ImageUpload;
