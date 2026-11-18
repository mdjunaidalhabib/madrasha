import { useEffect, useState } from "react";
import { formatDate, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { profile360Text } from "../../features/students/StudentProfile360.text";
import StudentInfoProfile from "./StudentInfoProfile";
import ParentInfoProfile from "./ParentInfoProfile";
import AlternateGuardianInfoProfile from "./AlternateGuardianInfoProfile";
import AddressInfoProfile from "./AddressInfoProfile";
import { profileHeadingClass, profileSectionClass, profileValueClass } from "./profileStyles";

const noop = () => {};

/** Keep the read-only profile in the same field order and grid as the edit form. */
export default function StudentProfileOverview({ student, summary }: { student: any; summary: any }) {
  const tx = useText(profile360Text);
  const lang = useLang();
  const [details, setDetails] = useState(student);
  useEffect(() => setDetails(student), [student]);
  const readOnlyProps = { student: details, handleChange: noop, editableField: null, setEditableField: noop, isEditMode: false };
  return <div>
    <StudentInfoProfile {...readOnlyProps} setStudent={setDetails} />
    <ParentInfoProfile {...readOnlyProps} />
    <AlternateGuardianInfoProfile {...readOnlyProps} />
    <AddressInfoProfile {...readOnlyProps} />
    <section className={profileSectionClass}>
      <h2 className={profileHeadingClass}>{tx.academicInfo}</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{tx.session}</dt><dd className={profileValueClass}>{summary.academicYear || tx.none}</dd></div>
        <div><dt className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{tx.admissionDate}</dt><dd className={profileValueClass}>{summary.admissionDate ? formatDate(summary.admissionDate, lang) : tx.none}</dd></div>
      </dl>
    </section>
  </div>;
}
