import StudentInfoFields, { type StudentInfoProps } from "@madrasha/shared-ui/src/components/admission/StudentInfo";
import { cachedGet } from "../../services/api";

export default function StudentInfo(props: Omit<StudentInfoProps, "loadData">) {
  return <StudentInfoFields {...props} loadData={cachedGet} />;
}
