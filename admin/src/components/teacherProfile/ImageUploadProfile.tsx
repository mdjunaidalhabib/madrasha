import type { UploadFolder } from "../../services/phase4Api";
import PhotoFieldCard from "../photo/PhotoFieldCard";

interface Props {
  data: any;
  setData: React.Dispatch<React.SetStateAction<any>>;
  isEditMode?: boolean;
  folder?: UploadFolder;
}

// Shared by teacher and staff profile pages (folder="staff" for staff).
const ImageUploadProfile: React.FC<Props> = ({
  data,
  setData,
  isEditMode = false,
  folder = "teachers",
}) => (
  <PhotoFieldCard
    label={folder === "staff" ? "স্টাফের ছবি" : "শিক্ষকের ছবি"}
    folder={folder}
    editable={isEditMode}
    value={data?.image}
    onChange={(image) => setData((prev: any) => ({ ...prev, image }))}
  />
);

export default ImageUploadProfile;
