import { useRef, useState, useEffect } from "react";
import { AdmissionFormData } from "../../features/students/AdmissionPage";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
}

const ImageUpload: React.FC<Props> = ({ formData, setFormData }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      const imageUrl = reader.result as string;

      setPreview(imageUrl);

      // ✅ FIX: safe state update (no stale formData bug)
      setFormData((prev) => ({
        ...prev,
        image: imageUrl,
      }));
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
        className="w-40 h-40 rounded-xl border-2 border-dashed border-gray-400 flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition overflow-hidden"
        onClick={() => fileRef.current?.click()}
        style={{
          backgroundImage: preview ? `url(${preview})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!preview && (
          <span className="text-gray-500 text-sm">Upload Photo</span>
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
