import { useEffect, useRef, useState } from "react";
import { TeacherFormData } from "../../features/teachers/TeacherPage";
import { uploadApi } from "../../services/phase4Api";
import { logger } from "../../utils/logger";

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
}

const TeacherImageUpload: React.FC<Props> = ({ formData, setFormData }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!formData.image) {
      setPreview(null);
    }
  }, [formData.image]);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = async () => {
      const img = reader.result as string;
      setPreview(img);
      setFormData((prev) => ({ ...prev, image: img }));

      try {
        setUploading(true);
        const res = await uploadApi.uploadImage(img, "teachers");
        const data = res.data?.data;
        if (data?.uploaded && data.url) {
          setPreview(data.url);
          setFormData((prev) => ({ ...prev, image: data.url as string }));
        }
        // else: cloud storage not configured yet - keep the base64 already set.
      } catch (err) {
        logger.error("TEACHER PHOTO UPLOAD ERROR:", err);
      } finally {
        setUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="flex justify-center">
      <div
        className="w-40 h-40 rounded-xl border-2 border-dashed border-gray-400 flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition overflow-hidden relative"
        onClick={() => fileRef.current?.click()}
        style={{
          backgroundImage: preview ? `url(${preview})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!preview && <span className="text-gray-500 text-sm">Upload Photo</span>}
        {uploading && (
          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
            আপলোড হচ্ছে...
          </span>
        )}
      </div>

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

export default TeacherImageUpload;
