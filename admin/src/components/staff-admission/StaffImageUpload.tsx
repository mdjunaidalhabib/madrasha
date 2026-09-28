import { StaffFormData } from "../../features/staff/StaffPage";
import PhotoFieldCard from "../photo/PhotoFieldCard";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../../features/teachers/teacherStaff.text";

interface Props {
  formData: StaffFormData;
  setFormData: React.Dispatch<React.SetStateAction<StaffFormData>>;
}

// Controlled by formData.image, so a form reset clears the preview too.
const StaffImageUpload: React.FC<Props> = ({ formData, setFormData }) => {
  const t = useText(teacherStaffText);
  return (
  <PhotoFieldCard
    label={t.staffPhoto}
    folder="staff"
    value={formData.image}
    onChange={(image) => setFormData((prev) => ({ ...prev, image }))}
  />
  );
};

export default StaffImageUpload;
