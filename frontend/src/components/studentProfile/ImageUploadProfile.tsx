import { useRef, useState } from "react";
import { uploadApi } from "../../services/phase4Api";
import { logger } from "../../utils/logger";

const ImageUploadProfile = ({ student, setStudent }: any) => {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImage = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setStudent((prev: any) => ({ ...prev, image: base64 }));

      try {
        setUploading(true);
        const res = await uploadApi.uploadImage(base64, "students");
        const data = res.data?.data;
        if (data?.uploaded && data.url) {
          setStudent((prev: any) => ({ ...prev, image: data.url as string }));
        }
        // else: cloud storage not configured yet - keep the base64 already set.
      } catch (err) {
        logger.error("STUDENT PROFILE PHOTO UPLOAD ERROR:", err);
      } finally {
        setUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="flex justify-center mb-6">
      <div
        onClick={() => ref.current?.click()}
        className="w-40 h-40 rounded-xl border-2 border-dashed border-gray-400 flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition overflow-hidden relative dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
        style={{
          backgroundImage: `url(${student.image || ""})`,
          backgroundSize: "cover",
        }}
      >
        {!student.image && (
          <div>
            <p className="text-gray-500 text-sm dark:text-slate-400">Image Not Set</p>
            <p className="text-gray-500 text-sm dark:text-slate-400">Upload Photo</p>
          </div>
        )}
        {uploading && (
          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
            আপলোড হচ্ছে...
          </span>
        )}
      </div>

      <input type="file" ref={ref} hidden onChange={handleImage} />
    </div>
  );
};

export default ImageUploadProfile;
