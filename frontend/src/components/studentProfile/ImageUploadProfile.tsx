import { useRef } from "react";

const ImageUploadProfile = ({ student, setStudent }: any) => {
  const ref = useRef<HTMLInputElement>(null);

  const handleImage = (e: any) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      setStudent((prev: any) => ({
        ...prev,
        image: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="flex justify-center mb-6">
      <div
        onClick={() => ref.current?.click()}
        className="w-40 h-40 rounded-xl border-2 border-dashed border-gray-400 flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition overflow-hidden"
        style={{
          backgroundImage: `url(${student.image || ""})`,
          backgroundSize: "cover",
        }}
      >
        {!student.image && (
          <div>
            <p className="text-gray-500 text-sm">Image Not Set</p>
            <p className="text-gray-500 text-sm">Upload Photo</p>
          </div>
        )}
      </div>

      <input type="file" ref={ref} hidden onChange={handleImage} />
    </div>
  );
};

export default ImageUploadProfile;
