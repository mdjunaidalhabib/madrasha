import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, GraduationCap, MapPin, Phone, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { commonText, formatDate, localizeDigits, useIsMadrasa, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "../admission/admission.text";
import { studentProfileText } from "./studentProfile.text";
import { profile360Text } from "../../features/students/StudentProfile360.text";
import { cachedGet } from "../../services/api";

type Detail = { label: string; value: ReactNode; dir?: "rtl" | "ltr" };

export function ProfileDetailCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <Icon size={17} strokeWidth={1.7} className="shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    </div>
    {children}
  </section>;
}

function Details({ items, columns = 2 }: { items: Detail[]; columns?: 1 | 2 }) {
  return <dl className={`grid px-5 py-1 ${columns === 2 ? "sm:grid-cols-2 sm:gap-x-6" : ""}`}>
    {items.map(({ label, value, dir }) => <div key={label} className="min-w-0 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800/80">
      <dt className="mb-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd dir={dir} className="break-words text-sm font-medium leading-6 text-slate-800 dark:text-slate-100">{value === undefined || value === null || value === "" ? <span className="font-normal text-slate-400">—</span> : value}</dd>
    </div>)}
  </dl>;
}

export default function StudentProfileOverview({ student: s, summary }: { student: any; summary: any }) {
  const t = useText(admissionText);
  const pt = useText(studentProfileText);
  const tx = useText(profile360Text);
  const c = useText(commonText);
  const lang = useLang();
  const isMadrasa = useIsMadrasa();
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const divisionId = s.division_id || s.academicDivision;
  useEffect(() => {
    let current = true;
    const rows = (res: any) => { const value = res.data?.data || res.data?.result || res.data || []; return Array.isArray(value) ? value : []; };
    cachedGet('/madrasa-divisions').then(res => { if (current) setDivisions(rows(res)); }).catch(() => {});
    if (divisionId) cachedGet(`/madrasa-classes?division_id=${divisionId}`).then(res => { if (current) setClasses(rows(res)); }).catch(() => {});
    return () => { current = false; };
  }, [divisionId]);
  const divisionName = divisions.find(row => row.division_id == divisionId)?.division_name_bn;
  const previousClass = classes.find(row => row.class_id == (s.previous_class_id || s.previousClass))?.class_name_bn;
  const phone = (value: string | undefined) => value ? <a dir="ltr" href={`tel:${value}`} className="inline-flex items-center gap-2 text-teal-700 hover:underline dark:text-teal-300"><Phone size={13} aria-hidden="true" />{localizeDigits(value, lang)}</a> : undefined;
  const parentDetails = (prefix: "father" | "mother"): Detail[] => [
    { label: prefix === "father" ? t.fatherNameBn : t.motherNameBn, value: s[`${prefix}_name`] },
    { label: prefix === "father" ? t.fatherNameEn : t.motherNameEn, value: s[`${prefix}_name_en`] },
    ...(isMadrasa ? [{ label: prefix === "father" ? t.fatherNameAr : t.motherNameAr, value: s[`${prefix}_arabic_name`], dir: "rtl" as const }] : []),
    { label: prefix === "father" ? t.fatherNid : t.motherNid, value: s[`${prefix}_nid`] },
    { label: prefix === "father" ? t.fatherOccupation : t.motherOccupation, value: s[`${prefix}_occupation`] },
  ];
  const hasAlternateGuardian = s.alt_guardian_name || s.alt_guardian_name_en || s.alt_guardian_phone;
  const birthDate = s.dob ? new Date(s.dob) : null;
  const today = new Date();
  const age = birthDate && !Number.isNaN(birthDate.getTime())
    ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
    : s.age;
  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="min-w-0 space-y-5">
      <ProfileDetailCard title={t.studentInfo} icon={UserRound}>
        <Details items={[
          { label: pt.nameBn, value: s.name_bn },
          { label: t.studentNameEn, value: s.name_en },
          ...(isMadrasa ? [{ label: t.studentNameAr, value: s.arabic_name, dir: "rtl" as const }] : []),
          { label: pt.studentNid, value: s.nid },
          { label: t.gender, value: Number(s.gender) === 1 ? t.male : Number(s.gender) === 2 ? t.female : undefined },
          { label: t.dob, value: s.dob ? formatDate(s.dob, lang) : undefined },
          { label: t.age, value: age != null ? localizeDigits(age, lang) : undefined },
          { label: t.bloodGroup, value: s.blood_group },
          { label: t.residency, value: Number(s.residency_type) === 1 ? t.residential : Number(s.residency_type) === 2 ? t.nonResidential : undefined },
          { label: t.orphan, value: s.is_orphan == null ? undefined : Number(s.is_orphan) === 1 ? c.yes : c.no },
        ]} />
      </ProfileDetailCard>
      <ProfileDetailCard title={t.parentInfo} icon={UsersRound}>
        <div className="grid sm:grid-cols-2"><Details columns={1} items={parentDetails("father")} /><Details columns={1} items={parentDetails("mother")} /></div>
      </ProfileDetailCard>
      <ProfileDetailCard title={tx.previousEducation} icon={BookOpen}>
        <Details items={[
          { label: t.previousInstitution, value: s.previous_institution },
          { label: t.previousClass, value: previousClass },
          { label: t.previousResult, value: s.previous_result },
        ]} />
      </ProfileDetailCard>
      {hasAlternateGuardian && <ProfileDetailCard title={t.altGuardianInfo} icon={UsersRound}>
        <Details items={[
          { label: t.guardianNameBn, value: s.alt_guardian_name },
          { label: t.guardianNameEn, value: s.alt_guardian_name_en },
          ...(isMadrasa ? [{ label: t.guardianNameAr, value: s.alt_guardian_arabic_name, dir: "rtl" as const }] : []),
          { label: t.relation, value: s.alt_guardian_relation },
          { label: t.mobileNo, value: phone(s.alt_guardian_phone) },
          { label: c.address, value: s.alt_guardian_address },
        ]} />
      </ProfileDetailCard>}
    </div>
    <div className="min-w-0 space-y-5">
      <ProfileDetailCard title={tx.academicInfo} icon={GraduationCap}>
        <Details columns={1} items={[
          { label: t.currentClass, value: summary.classRef?.nameBn || summary.classRef?.name || s.current_class },
          { label: t.division, value: divisionName },
          { label: tx.session, value: summary.academicYear },
          { label: tx.admissionDate, value: summary.admissionDate ? formatDate(summary.admissionDate, lang) : undefined },
        ]} />
      </ProfileDetailCard>
      <ProfileDetailCard title={tx.contactDetails} icon={Phone}>
        <Details columns={1} items={[
          { label: t.guardianMobile, value: phone(s.guardian_phone || summary.guardianPhone) },
          { label: t.guardianAltMobile, value: phone(s.guardian_phone_2) },
        ]} />
      </ProfileDetailCard>
      <ProfileDetailCard title={t.addressInfo} icon={MapPin}>
        <Details columns={1} items={[
          { label: pt.addrDivision, value: s.division },
          { label: pt.district, value: s.district },
          { label: pt.thana, value: s.thana },
          { label: t.village, value: s.village },
        ]} />
      </ProfileDetailCard>
    </div>
  </div>;
}
