import { CheckCircle2, CircleAlert, Clock3, UserRound } from "lucide-react";
import { defineText, formatDate, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";

const text = defineText({
  bn: {
    personal: "ব্যক্তিগত তথ্য", enrollment: "ভর্তি ও শিক্ষাগত তথ্য", family: "পিতা-মাতার তথ্য",
    guardian: "অভিভাবক ও যোগাযোগ", address: "ঠিকানা", yes: "হ্যাঁ", no: "না",
    male: "ছাত্র", female: "ছাত্রী", residential: "আবাসিক", nonResidential: "অনাবাসিক",
    active: "সক্রিয়", inactive: "বহিষ্কৃত", approved: "অনুমোদিত", pending: "অপেক্ষমাণ", rejected: "প্রত্যাখ্যাত",
    newAdmission: "নতুন ভর্তি", readmission: "পুনঃভর্তি",
    fields: {
      nameBn: "বাংলা নাম", nameEn: "ইংরেজি নাম", arabicName: "আরবি নাম", dob: "জন্মতারিখ",
      age: "বয়স", gender: "লিঙ্গ", nid: "জন্মনিবন্ধন / জাতীয় পরিচয়পত্র", bloodGroup: "রক্তের গ্রুপ", isOrphan: "এতিম",
      divisionName: "বিভাগ", className: "শ্রেণি", sessionName: "শিক্ষাবর্ষ", roll: "রোল", registrationNo: "রেজিস্ট্রেশন নম্বর",
      admissionDate: "ভর্তির তারিখ", admissionStatus: "ভর্তির অবস্থা", admissionType: "ভর্তির ধরন", residencyType: "আবাসনের ধরন", isActive: "শিক্ষার্থীর অবস্থা",
      previousClassName: "পূর্বের শ্রেণি", previousInstitution: "পূর্বের প্রতিষ্ঠান", previousResult: "পূর্বের ফলাফল",
      fatherName: "পিতার নাম", fatherNameEn: "পিতার ইংরেজি নাম", fatherArabicName: "পিতার আরবি নাম", fatherNid: "পিতার জাতীয় পরিচয়পত্র", fatherOccupation: "পিতার পেশা",
      motherName: "মাতার নাম", motherNameEn: "মাতার ইংরেজি নাম", motherArabicName: "মাতার আরবি নাম", motherNid: "মাতার জাতীয় পরিচয়পত্র", motherOccupation: "মাতার পেশা",
      guardianPhone: "অভিভাবকের মোবাইল", guardianPhone2: "বিকল্প মোবাইল", altGuardianName: "অন্য অভিভাবকের নাম", altGuardianNameEn: "ইংরেজি নাম", altGuardianArabicName: "আরবি নাম",
      altGuardianRelation: "সম্পর্ক", altGuardianPhone: "মোবাইল", altGuardianAddress: "অভিভাবকের ঠিকানা",
      division: "বিভাগ", district: "জেলা", thana: "থানা / উপজেলা", village: "গ্রাম / মহল্লা",
    } as Record<string, string>,
  },
  en: {
    personal: "Personal information", enrollment: "Admission and academics", family: "Parents",
    guardian: "Guardian and contact", address: "Address", yes: "Yes", no: "No",
    male: "Male", female: "Female", residential: "Residential", nonResidential: "Non-residential",
    active: "Active", inactive: "Expelled", approved: "Approved", pending: "Pending", rejected: "Rejected",
    newAdmission: "New admission", readmission: "Readmission",
    fields: {
      nameBn: "Bengali name", nameEn: "English name", arabicName: "Arabic name", dob: "Date of birth",
      age: "Age", gender: "Gender", nid: "Birth registration / national ID", bloodGroup: "Blood group", isOrphan: "Orphan",
      divisionName: "Division", className: "Class", sessionName: "Session", roll: "Roll", registrationNo: "Registration number",
      admissionDate: "Admission date", admissionStatus: "Admission status", admissionType: "Admission type", residencyType: "Residency", isActive: "Student status",
      previousClassName: "Previous class", previousInstitution: "Previous institution", previousResult: "Previous result",
      fatherName: "Father's name", fatherNameEn: "Father's English name", fatherArabicName: "Father's Arabic name", fatherNid: "Father's national ID", fatherOccupation: "Father's occupation",
      motherName: "Mother's name", motherNameEn: "Mother's English name", motherArabicName: "Mother's Arabic name", motherNid: "Mother's national ID", motherOccupation: "Mother's occupation",
      guardianPhone: "Guardian mobile", guardianPhone2: "Alternative mobile", altGuardianName: "Other guardian's name", altGuardianNameEn: "English name", altGuardianArabicName: "Arabic name",
      altGuardianRelation: "Relationship", altGuardianPhone: "Mobile", altGuardianAddress: "Guardian address",
      division: "Division", district: "District", thana: "Thana / upazila", village: "Village / neighborhood",
    },
  },
});

export default function GuardianPersonalDetails({ profile }: { profile: Record<string, string | number | null> }) {
  const t = useText(text);
  const lang = useLang();
  const groups = [
    { title: t.personal, fields: ["nameBn", "nameEn", "arabicName", "dob", "age", "gender", "nid", "bloodGroup", "isOrphan"] },
    { title: t.enrollment, fields: ["divisionName", "className", "sessionName", "roll", "registrationNo", "admissionDate", "admissionStatus", "admissionType", "residencyType", "isActive", "previousClassName", "previousInstitution", "previousResult"] },
    { title: t.family, fields: ["fatherName", "fatherNameEn", "fatherArabicName", "fatherNid", "fatherOccupation", "motherName", "motherNameEn", "motherArabicName", "motherNid", "motherOccupation"] },
    { title: t.guardian, fields: ["guardianPhone", "guardianPhone2", "altGuardianName", "altGuardianNameEn", "altGuardianArabicName", "altGuardianRelation", "altGuardianPhone", "altGuardianAddress"] },
    { title: t.address, fields: ["division", "district", "thana", "village"] },
  ];
  const value = (key: string) => {
    const raw = profile[key];
    if (raw === null || raw === undefined || raw === "") return "—";
    if (key === "dob" || key === "admissionDate") return formatDate(String(raw), lang);
    if (key === "gender") return raw === 1 ? t.male : raw === 2 ? t.female : "—";
    if (key === "residencyType") return raw === 1 ? t.residential : raw === 2 ? t.nonResidential : "—";
    if (key === "isOrphan") return raw === 1 ? t.yes : t.no;
    if (key === "isActive") return raw === 1 ? t.active : t.inactive;
    if (key === "admissionStatus") return ({ APPROVED: t.approved, PENDING: t.pending, REJECTED: t.rejected } as Record<string, string>)[raw] || "—";
    if (key === "admissionType") return raw === "NEW" ? t.newAdmission : t.readmission;
    return localizeDigits(String(raw), lang);
  };
  return (
    <div className="guardian-profile-details">
      <div className="guardian-profile-identity">
        <div className="guardian-profile-identity-heading">
        <span className="guardian-profile-photo">
          {profile.image ? <img src={String(profile.image)} alt="" /> : <UserRound size={36} aria-hidden="true" />}
        </span>
        <div className="guardian-profile-identity-name">
          <h1>{profile.nameBn}</h1>
        </div>
        </div>
        <dl className="guardian-profile-highlights">
          {["className", "sessionName", "roll", "registrationNo", "admissionStatus", "isActive", "residencyType"].map((key) => {
            const isStatus = key === "admissionStatus" || key === "isActive";
            const positive = key === "admissionStatus" ? profile[key] === "APPROVED" : profile[key] === 1;
            const pending = key === "admissionStatus" && profile[key] === "PENDING";
            const negative = key === "admissionStatus" ? profile[key] === "REJECTED" : profile[key] === 0;
            const tone = positive ? "positive" : pending ? "pending" : negative ? "negative" : "unknown";
            const Icon = positive ? CheckCircle2 : pending ? Clock3 : CircleAlert;
            return (
              <div key={key} className={isStatus ? `guardian-profile-highlight-status is-${tone}` : undefined}>
                <dt>{t.fields[key]}</dt>
                <dd>{isStatus ? <span className="guardian-profile-status-badge"><Icon size={18} aria-hidden="true" />{value(key)}</span> : value(key)}</dd>
              </div>
            );
          })}
        </dl>
      </div>
      {groups.map((group) => (
        <section className="guardian-profile-section" key={group.title}>
          <h2>{group.title}</h2>
          <dl>{group.fields.map((key) => (
            <div key={key}><dt>{t.fields[key]}</dt><dd lang={key.toLowerCase().includes("arabic") ? "ar" : undefined}>{value(key)}</dd></div>
          ))}</dl>
        </section>
      ))}
    </div>
  );
}
