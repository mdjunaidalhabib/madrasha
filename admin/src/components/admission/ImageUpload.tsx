import SharedImageUpload, { type AdmissionImageProps } from "@madrasha/shared-ui/src/components/admission/ImageUpload";
import { uploadPhoto } from "../photo/PhotoPicker";

const uploadStudentPhoto = (dataUrl: string) => uploadPhoto(dataUrl, "students");

export default function ImageUpload(props: Omit<AdmissionImageProps, "uploadPhoto">) {
  return <SharedImageUpload {...props} uploadPhoto={uploadStudentPhoto} />;
}
