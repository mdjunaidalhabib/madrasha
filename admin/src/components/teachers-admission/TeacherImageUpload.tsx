import { TeacherFormData } from "../../features/teachers/TeacherPage";
import PhotoFieldCard from "../photo/PhotoFieldCard";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../../features/teachers/teacherStaff.text";

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
}

// Controlled by formData.image, so a form reset clears the preview too.
const TeacherImageUpload: React.FC<Props> = ({ formData, setFormData }) => {
  const t = useText(teacherStaffText);
  return (
  <PhotoFieldCard
    label={t.teacherPhoto}
    folder="teachers"
    value={formData.image}
    onChange={(image) => setFormData((prev) => ({ ...prev, image }))}
  />
  );
};

export default TeacherImageUpload;
