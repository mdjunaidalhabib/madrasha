import { useEffect, useRef, useState } from "react";
import { TeacherFormData } from "../../features/teachers/TeacherPage";

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
}

const TeacherImageUpload: React.FC<Props> = ({ formData, setFormData }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!formData.image) {
      setPreview(null);
    }
  }, [formData.image]);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      const img = reader.result as string;
      setPreview(img);

      setFormData((prev) => ({
        ...prev,
        image: img,
      }));
    };

    reader.readAsDataURL(file);
  };

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
        {!preview && <span className="text-gray-500 text-sm">Upload Photo</span>}
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
