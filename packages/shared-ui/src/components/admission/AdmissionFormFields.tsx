import ImageUpload from "./ImageUpload";
import StudentInfo, { type StudentInfoProps } from "./StudentInfo";
import ParentInfo from "./ParentInfo";
import AlternateGuardianInfo from "./AlternateGuardianInfo";
import OtherInfo from "./OtherInfo";
import AddressInfo from "./AddressInfo";
import SubmitButton from "./SubmitButton";

interface Props extends StudentInfoProps {
  loading?: boolean;
  disabled?: boolean;
  uploadPhoto?: (dataUrl: string) => Promise<string>;
}

/** The complete admission field layout used by the office and public website. */
export default function AdmissionFormFields({
  loading = false,
  disabled = false,
  uploadPhoto,
  ...props
}: Props) {
  const { formData, setFormData, errors, setErrors, isReturning } = props;
  const fields = { formData, setFormData };
  return (
    <fieldset
      disabled={disabled || loading}
      className="min-w-0 space-y-4 disabled:opacity-60 sm:space-y-6"
    >
      <ImageUpload {...fields} uploadPhoto={uploadPhoto} />
      <StudentInfo {...props} />
      <ParentInfo {...fields} errors={errors} setErrors={setErrors} />
      <AlternateGuardianInfo
        {...fields}
        errors={errors}
        setErrors={setErrors}
      />
      <OtherInfo {...fields} />
      <AddressInfo {...fields} />
      <SubmitButton loading={loading} isReAdmission={isReturning} />
    </fieldset>
  );
}
