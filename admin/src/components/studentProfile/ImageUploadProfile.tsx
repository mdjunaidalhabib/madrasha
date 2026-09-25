import PhotoFieldCard from "../photo/PhotoFieldCard";

const ImageUploadProfile = ({ student, setStudent, isEditMode = true }: any) => (
  <PhotoFieldCard
    label="ছাত্রের ছবি"
    folder="students"
    editable={isEditMode}
    value={student?.image}
    onChange={(image) => setStudent((prev: any) => ({ ...prev, image }))}
  />
);

export default ImageUploadProfile;
