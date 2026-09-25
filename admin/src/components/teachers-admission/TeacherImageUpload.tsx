import { TeacherFormData } from "../../features/teachers/TeacherPage";
import PhotoFieldCard from "../photo/PhotoFieldCard";

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
}

// Controlled by formData.image, so a form reset clears the preview too.
const TeacherImageUpload: React.FC<Props> = ({ formData, setFormData }) => (
  <PhotoFieldCard
    label="শিক্ষকের ছবি"
    folder="teachers"
    value={formData.image}
    onChange={(image) => setFormData((prev) => ({ ...prev, image }))}
  />
);

export default TeacherImageUpload;
