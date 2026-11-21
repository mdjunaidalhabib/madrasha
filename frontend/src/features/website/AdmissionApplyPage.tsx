import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronLeft, GraduationCap, Loader2 } from "lucide-react";
import { getPublicWebsite, submitFullAdmissionApplication } from "../../services/publicWebsiteApi";
import { useCustomDomainRedirect } from "../../utils/useCustomDomainRedirect";
import { useTenantSlug } from "../../utils/useTenantSlug";
import { accentStrong, accentText, initials, pickTextOn } from "./colorUtils";
import { resolveTheme } from "./themes";
import { formatCurrency, getText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { admissionApplyText } from "./admissionApply.text";

import StudentInfo from "@madrasha/shared-ui/src/components/admission/StudentInfo";
import ParentInfo from "@madrasha/shared-ui/src/components/admission/ParentInfo";
import AlternateGuardianInfo from "@madrasha/shared-ui/src/components/admission/AlternateGuardianInfo";
import OtherInfo from "@madrasha/shared-ui/src/components/admission/OtherInfo";
import AddressInfo from "@madrasha/shared-ui/src/components/admission/AddressInfo";
import SubmitButton from "@madrasha/shared-ui/src/components/admission/SubmitButton";
import PhotoPicker from "@madrasha/shared-ui/src/components/photo/PhotoPicker";
import { admissionText } from "@madrasha/shared-ui/src/components/admission/admission.text";
import type { AdmissionFormData, AdmissionFormErrors } from "@madrasha/shared-ui/src/components/admission/types";

const emptyForm: AdmissionFormData = {
  age: null,
  roll: "",
  admissionDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
  academicYear: "",
  name: "",
  arabicName: "",
  nameEn: "",
  nid: "",
  gender: null,
  dob: "",
  bloodGroup: "",
  residencyType: null,
  isOrphan: false,
  academicDivision: "",
  currentClass: "",
  previousClass: "",
  previousInstitution: "",
  previousResult: "",
  fatherName: "",
  fatherArabicName: "",
  fatherNameEn: "",
  fatherNid: "",
  fatherOccupation: "",
  motherName: "",
  motherArabicName: "",
  motherNameEn: "",
  motherNid: "",
  motherOccupation: "",
  parentPhone: "",
  parentPhone2: "",
  hasAltGuardian: false,
  altGuardianName: "",
  altGuardianArabicName: "",
  altGuardianNameEn: "",
  altGuardianRelation: "",
  altGuardianAddress: "",
  altGuardianPhone: "",
  division: "",
  district: "",
  thana: "",
  village: "",
  image: "",
};

const cleanPhone = (phone: string) => phone.replace(/[^0-9]/g, "");

export default function AdmissionApplyPage() {
  const t = useText(admissionApplyText);
  const lang = useLang();
  const at = useText(admissionText);
  const slug = useTenantSlug();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AdmissionFormErrors>({});
  // The class's default fees, billed immediately on submit (see admitStudent
  // on the backend) - shown as info only, since there's no online payment
  // gateway here; the applicant pays in person at the madrasa office.
  const [submittedInvoices, setSubmittedInvoices] = useState<Array<{ title: string; amount: number }>>([]);

  useEffect(() => {
    setLoading(true);
    getPublicWebsite(slug)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const madrasa = data?.madrasa;
  useCustomDomainRedirect(madrasa?.custom_domain);
  const settings = data?.settings || {};
  const themeColor = settings.theme_color || "#2563eb";
  const accentSolid = useMemo(() => accentStrong(themeColor), [themeColor]);
  const accentLabel = useMemo(() => accentText(themeColor), [themeColor]);
  const onAccent = useMemo(() => pickTextOn(accentSolid), [accentSolid]);

  // Theme tokens (radius / shadow style) shared with the public website.
  const theme = resolveTheme(settings.theme_key);
  // Public form options come from the anonymous website response.
  const loadAdmissionData = useCallback(async (path: string) => {
    if (path === "/madrasa-divisions") return { data: data?.divisions || [] };
    if (path.startsWith("/sessions")) return { data: data?.sessions || [] };
    const divisionId = new URLSearchParams(path.split("?")[1]).get("division_id");
    return { data: (data?.classes || []).filter((item: { division_id: number }) => String(item.division_id) === divisionId) };
  }, [data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nextFieldErrors: AdmissionFormErrors = {};
    if (!form.name.trim()) nextFieldErrors.name = t.requiredError;
    if (!form.academicDivision) nextFieldErrors.academicDivision = t.requiredError;
    if (!form.currentClass) nextFieldErrors.currentClass = t.requiredError;
    if (!form.academicYear) nextFieldErrors.academicYear = t.requiredError;
    if (!(form.hasAltGuardian ? form.altGuardianPhone : form.parentPhone).trim()) {
      if (form.hasAltGuardian) setError(t.requiredError);
      else nextFieldErrors.parentPhone = t.requiredError;
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length || (form.hasAltGuardian && !form.altGuardianPhone.trim())) {
      setError(t.requiredError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitFullAdmissionApplication(slug, {
        name_bn: form.name.trim(),
        arabic_name: form.arabicName || null,
        name_en: form.nameEn || null,
        nid: form.nid || null,
        gender: form.gender === null ? null : Number(form.gender),
        dob: form.dob || null,
        blood_group: form.bloodGroup || null,
        residency_type: form.residencyType === null ? null : Number(form.residencyType),
        is_orphan: form.isOrphan ? 1 : 0,
        division_id: Number(form.academicDivision),
        class_id: Number(form.currentClass),
        academic_year: form.academicYear,
        admission_date: form.admissionDate,
        previous_class_id: form.previousClass ? Number(form.previousClass) : null,
        previous_institution: form.previousInstitution || null,
        previous_result: form.previousResult || null,
        father_name: form.fatherName || null,
        father_arabic_name: form.fatherArabicName || null,
        father_name_en: form.fatherNameEn || null,
        father_nid: form.fatherNid || null,
        father_occupation: form.fatherOccupation || null,
        mother_name: form.motherName || null,
        mother_arabic_name: form.motherArabicName || null,
        mother_name_en: form.motherNameEn || null,
        mother_nid: form.motherNid || null,
        mother_occupation: form.motherOccupation || null,
        guardian_phone: cleanPhone(form.hasAltGuardian ? form.altGuardianPhone : form.parentPhone),
        guardian_phone_2: form.parentPhone2 ? cleanPhone(form.parentPhone2) : null,
        alt_guardian_name: form.hasAltGuardian ? form.altGuardianName || null : null,
        alt_guardian_arabic_name: form.hasAltGuardian ? form.altGuardianArabicName || null : null,
        alt_guardian_name_en: form.hasAltGuardian ? form.altGuardianNameEn || null : null,
        alt_guardian_relation: form.hasAltGuardian ? form.altGuardianRelation || null : null,
        alt_guardian_address: form.hasAltGuardian ? form.altGuardianAddress || null : null,
        alt_guardian_phone: form.hasAltGuardian
          ? cleanPhone(form.altGuardianPhone) || null
          : null,
        division: form.division || null,
        district: form.district || null,
        thana: form.thana || null,
        village: form.village || null,
        image: form.image || null,
      });
      const invoices = res?.data?.invoices || [];
      setSubmittedInvoices(invoices.map((inv: any) => ({ title: inv.title, amount: Number(inv.amount) })));
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || getText(admissionApplyText).submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <Link to=".." relative="path" className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
            <ChevronLeft size={16} className="rtl:rotate-180" />
            {t.goBack}
          </Link>
          <div className="ms-auto flex items-center gap-2">
            {madrasa?.logo_url ? (
              <img src={madrasa.logo_url} alt={t.logo} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: accentSolid, color: onAccent }}
              >
                {initials(madrasa?.name)}
              </div>
            )}
            <span className="text-sm font-bold text-slate-800">{madrasa?.name}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-md"
            style={{ backgroundColor: accentSolid, color: onAccent }}
          >
            <GraduationCap size={26} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">{t.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t.intro}
          </p>
        </div>

        {success ? (
          <div className="rounded-3xl border border-green-100 bg-green-50 p-8 text-center shadow-sm">
            <CheckCircle2 size={40} className="mx-auto text-green-600" />
            <h2 className="mt-4 text-lg font-bold text-green-800">{t.successTitle}</h2>
            <p className="mt-2 text-sm text-green-700">
              {t.successBody}
            </p>

            {submittedInvoices.length > 0 && (
              <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-green-200 bg-white p-4 text-start shadow-sm">
                <h3 className="text-sm font-bold text-slate-700">{t.applicableFees}</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {submittedInvoices.map((inv, index) => (
                    <li key={index} className="flex items-center justify-between gap-2">
                      <span>{inv.title}</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(inv.amount, lang)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-bold text-slate-800">
                  <span>{t.total}</span>
                  <span>{formatCurrency(submittedInvoices.reduce((sum, inv) => sum + inv.amount, 0), lang)}</span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {t.payAtOffice}
                </p>
              </div>
            )}

            <Link
              to=".."
              relative="path"
              className={`mt-6 inline-flex items-center gap-1.5 ${theme.button} px-5 py-2.5 text-sm font-bold ${theme.shadowSm} transition hover:opacity-90`}
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              {t.backHome}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4 sm:space-y-6">
            {error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
            <fieldset disabled={submitting} className="min-w-0 space-y-4 sm:space-y-6">
              <div className="bg-white shadow-lg px-6 py-4 rounded-xl border border-gray-200 dark:bg-slate-900 dark:border-slate-700">
                <PhotoPicker label={at.studentPhoto} value={form.image} onChange={(image) => setForm((prev) => ({ ...prev, image }))} layout="row" />
              </div>
              <StudentInfo formData={form} setFormData={setForm} errors={fieldErrors} setErrors={setFieldErrors} loadData={loadAdmissionData} />
              <ParentInfo formData={form} setFormData={setForm} errors={fieldErrors} setErrors={setFieldErrors} />
              <AlternateGuardianInfo formData={form} setFormData={setForm} />
              <OtherInfo formData={form} setFormData={setForm} />
              <AddressInfo formData={form} setFormData={setForm} />
              <SubmitButton loading={submitting} />
            </fieldset>
            <p className="text-center text-xs text-slate-400" style={{ color: accentLabel }}>{t.requiredNote}</p>
          </form>
        )}
      </main>
    </div>
  );
}
