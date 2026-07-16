import { useRef, useState } from "react";

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

  /* =============================
     HANDLE IMAGE UPLOAD
  ============================= */
  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ❌ optional validation
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be under 2MB");
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      const img = reader.result as string;

      setPreview(img);

      setData((prev: any) => ({
        ...prev,
        image: img,
      }));
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
        className={`w-40 h-40 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition
          ${isEditMode ? "hover:bg-gray-100" : "cursor-default"}
        `}
        style={{
          backgroundImage: preview ? `url(${preview})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!preview && (
          <div className="text-center text-gray-500 text-sm">
            <p>No Image</p>
            {isEditMode && <p>Click to Upload</p>}
          </div>
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
