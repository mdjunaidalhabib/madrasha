import { StaffFormData } from "../../features/staff/StaffPage";
import PhotoFieldCard from "../photo/PhotoFieldCard";

interface Props {
  formData: StaffFormData;
  setFormData: React.Dispatch<React.SetStateAction<StaffFormData>>;
}

// Controlled by formData.image, so a form reset clears the preview too.
const StaffImageUpload: React.FC<Props> = ({ formData, setFormData }) => (
  <PhotoFieldCard
    label="স্টাফের ছবি"
    folder="staff"
    value={formData.image}
    onChange={(image) => setFormData((prev) => ({ ...prev, image }))}
  />
);

export default StaffImageUpload;
