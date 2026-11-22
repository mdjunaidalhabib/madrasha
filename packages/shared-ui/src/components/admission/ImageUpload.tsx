import { useText } from "../../i18n";
import PhotoPicker from "../photo/PhotoPicker";
import { admissionText } from "./admission.text";
import type { AdmissionFormData } from "./types";

export interface AdmissionImageProps {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
  uploadPhoto?: (dataUrl: string) => Promise<string>;
}

export default function ImageUpload({
  formData,
  setFormData,
  uploadPhoto,
}: AdmissionImageProps) {
  const t = useText(admissionText);
  return (
    <div className="bg-white shadow-lg px-6 py-4 rounded-xl border border-gray-200 dark:bg-slate-900 dark:border-slate-700">
      <PhotoPicker
        label={t.studentPhoto}
        value={formData.image}
        onChange={(image) => setFormData((prev) => ({ ...prev, image }))}
        upload={uploadPhoto}
        layout="row"
      />
    </div>
  );
}
