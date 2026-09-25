import { AdmissionFormData } from "../../features/students/AdmissionPage";
import PhotoFieldCard from "../photo/PhotoFieldCard";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
}

// Form reset clears formData.image, and PhotoPicker is fully controlled by
// that value, so the preview resets with the form automatically.
const ImageUpload: React.FC<Props> = ({ formData, setFormData }) => (
  <PhotoFieldCard
    label="ছাত্রের ছবি"
    folder="students"
    value={formData.image}
    onChange={(image) => setFormData((prev) => ({ ...prev, image }))}
  />
);

export default ImageUpload;
