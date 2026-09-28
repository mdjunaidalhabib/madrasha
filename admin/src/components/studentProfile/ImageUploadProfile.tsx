import PhotoFieldCard from "../photo/PhotoFieldCard";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "../admission/admission.text";

const ImageUploadProfile = ({ student, setStudent, isEditMode = true }: any) => {
  const t = useText(admissionText);
  return (
  <PhotoFieldCard
    label={t.studentPhoto}
    folder="students"
    editable={isEditMode}
    value={student?.image}
    onChange={(image) => setStudent((prev: any) => ({ ...prev, image }))}
  />
  );
};

export default ImageUploadProfile;
