import { useRef, useState } from "react";
import { useToastStore } from "../../store/toastStore";
import { uploadApi } from "../../services/phase4Api";
import { logger } from "../../utils/logger";

interface Props {
  data: any;
  setData: React.Dispatch<React.SetStateAction<any>>;
  isEditMode?: boolean;
}

const ImageUploadProfile: React.FC<Props> = ({
  data,
  setData,
  isEditMode = false,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(data?.image || null);
  const [uploading, setUploading] = useState(false);

  /* =============================
     HANDLE IMAGE UPLOAD
  ============================= */
  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ❌ optional validation
    if (!file.type.startsWith("image/")) {
      useToastStore.getState().show("Please upload an image file", "error");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      useToastStore.getState().show("Image must be under 2MB", "error");
      return;
    }

    const reader = new FileReader();

    reader.onloadend = async () => {
      const img = reader.result as string;

      setPreview(img);
      setData((prev: any) => ({ ...prev, image: img }));

      try {
        setUploading(true);
        const res = await uploadApi.uploadImage(img, "teachers");
        const uploaded = res.data?.data;
        if (uploaded?.uploaded && uploaded.url) {
          setPreview(uploaded.url);
          setData((prev: any) => ({ ...prev, image: uploaded.url as string }));
        }
        // else: cloud storage not configured yet - keep the base64 already set.
      } catch (err) {
        logger.error("TEACHER PROFILE PHOTO UPLOAD ERROR:", err);
      } finally {
        setUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  /* =============================
     REMOVE IMAGE
  ============================= */
  const handleRemove = () => {
    setPreview(null);

    setData((prev: any) => ({
      ...prev,
      image: "",
    }));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* IMAGE BOX */}
      <div
        onClick={() => isEditMode && fileRef.current?.click()}
        className={`w-40 h-40 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition relative dark:border-slate-700 dark:bg-slate-800
          ${isEditMode ? "hover:bg-gray-100 dark:hover:bg-slate-700" : "cursor-default"}
        `}
        style={{
          backgroundImage: preview ? `url(${preview})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!preview && (
          <div className="text-center text-gray-500 text-sm dark:text-slate-400">
            <p>No Image</p>
            {isEditMode && <p>Click to Upload</p>}
          </div>
        )}
        {uploading && (
          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
            আপলোড হচ্ছে...
          </span>
        )}
      </div>

      {/* BUTTONS */}
      {isEditMode && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded"
          >
            Upload
          </button>

          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* INPUT */}
      <input
        type="file"
        ref={fileRef}
        hidden
        accept="image/*"
        onChange={handleImage}
      />
    </div>
  );
};

export default ImageUploadProfile;
