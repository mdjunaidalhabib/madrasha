import { AdmissionFormData } from "../../features/students/AdmissionPage";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "./admission.text";
import PhotoFieldCard from "../photo/PhotoFieldCard";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
}

// Form reset clears formData.image, and PhotoPicker is fully controlled by
// that value, so the preview resets with the form automatically.
const ImageUpload: React.FC<Props> = ({ formData, setFormData }) => {
  const t = useText(admissionText);
  return (
  <PhotoFieldCard
    label={t.studentPhoto}
    folder="students"
    value={formData.image}
    onChange={(image) => setFormData((prev) => ({ ...prev, image }))}
  />
  );
};

export default ImageUpload;
