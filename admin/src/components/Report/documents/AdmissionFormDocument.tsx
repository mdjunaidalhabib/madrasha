import { useIsMadrasa, usePrintLang, usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../report.text";
import { admissionFormText } from "./admissionForm.text";

type AdmissionFormLabels = typeof admissionFormText.bn;

type Props = {
  row: Record<string, any>;
  madrasaName?: string;
};

const genderLabel = (t: AdmissionFormLabels, g?: number | null) => (g === 1 ? t.male : g === 2 ? t.female : "-");
const residencyLabel = (t: AdmissionFormLabels, v?: number | null) =>
  v === 1 ? t.residential : v === 2 ? t.nonResidential : "-";
const admissionTypeLabel = (t: AdmissionFormLabels, v?: string) =>
  v === "RE_ADMISSION" ? t.readmission : t.newAdmission;

const Field = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="flex border-b border-slate-200 py-1.5 text-sm">
    <span className="w-40 shrink-0 text-slate-500">{label}</span>
    <span className="font-semibold text-slate-900">{value || value === 0 ? value : "-"}</span>
  </div>
);

/**
 * A single printable admission-form document for one student, whether the
 * admission is still PENDING, was REJECTED, or is APPROVED. Rendered via
 * AdmissionFormPrintButton inside a `.print-area` so it only appears while
 * printing (see index.css's `@media print` `.print-area` rule).
 */
const AdmissionFormDocument = ({ row, madrasaName }: Props) => {
  const isApproved = row.admission_status === "APPROVED";
  const isRejected = row.admission_status === "REJECTED";
  const t = usePrintText(admissionFormText);
  const r = usePrintText(reportText);
  const { lang, dir } = usePrintLang();
  const isMadrasa = useIsMadrasa();

  return (
    <div lang={lang} dir={dir} className="print-page-break rounded-xl border-2 border-slate-800 bg-white p-8">
      <div className="text-center">
        {madrasaName && <h2 className="text-xl font-bold">{madrasaName}</h2>}
        <h3 className="mt-1 text-lg font-bold underline">{r.title.admissionForm}</h3>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-8 md:grid-cols-2">
        <div>
          <h4 className="mb-1 text-xs font-bold uppercase text-slate-400">{t.studentInfo}</h4>
          <Field label={t.name} value={row.name_bn} />
          {isMadrasa && <Field label={t.arabicName} value={row.arabic_name} />}
          <Field label={t.nid} value={row.nid} />
          <Field label={t.gender} value={genderLabel(t, row.gender)} />
          <Field label={t.dob} value={row.dob ? String(row.dob).slice(0, 10) : null} />
          <Field label={t.bloodGroup} value={row.blood_group} />
          <Field label={t.residency} value={residencyLabel(t, row.residency_type)} />
          <Field label={t.orphan} value={row.is_orphan === 1 ? t.yes : t.no} />
          <Field label={t.admissionType} value={admissionTypeLabel(t, row.admission_type)} />
        </div>

        <div>
          <h4 className="mb-1 text-xs font-bold uppercase text-slate-400">{t.admissionInfo}</h4>
          <Field label={t.class} value={row.current_class} />
          <Field label={t.session} value={row.academic_year} />
          <Field label={t.rollNo} value={row.roll} />
          <Field label={t.regNo} value={row.registration_no} />
          <Field label={t.admissionDate} value={row.admission_date ? String(row.admission_date).slice(0, 10) : null} />
          <Field label={t.previousInstitution} value={row.previous_institution} />
          <Field label={t.previousResult} value={row.previous_result} />
        </div>

        <div>
          <h4 className="mb-1 mt-4 text-xs font-bold uppercase text-slate-400">{t.guardianInfo}</h4>
          <Field label={t.fatherName} value={row.father_name} />
          <Field label={t.fatherNid} value={row.father_nid} />
          <Field label={t.fatherOccupation} value={row.father_occupation} />
          <Field label={t.motherName} value={row.mother_name} />
          <Field label={t.motherNid} value={row.mother_nid} />
          <Field label={t.motherOccupation} value={row.mother_occupation} />
          <Field label={t.mobileNo} value={row.guardian_phone} />
          <Field label={t.altMobileNo} value={row.guardian_phone_2} />
        </div>

        <div>
          {row.alt_guardian_name && (
            <>
              <h4 className="mb-1 mt-4 text-xs font-bold uppercase text-slate-400">
                {t.altGuardian}
              </h4>
              <Field label={t.name} value={row.alt_guardian_name} />
              <Field label={t.relation} value={row.alt_guardian_relation} />
              <Field label={t.mobileNo} value={row.alt_guardian_phone} />
              <Field label={t.address} value={row.alt_guardian_address} />
            </>
          )}

          <h4 className="mb-1 mt-4 text-xs font-bold uppercase text-slate-400">{t.address}</h4>
          <Field label={t.adminDivision} value={row.division} />
          <Field label={t.district} value={row.district} />
          <Field label={t.thana} value={row.thana} />
          <Field label={t.village} value={row.village} />
        </div>
      </div>

      <div className="mt-16 flex items-end justify-between text-sm">
        <div>
          {t.statusLabel}{" "}
          <span className="font-bold">
            {isApproved ? t.approved : isRejected ? t.rejected : t.pending}
          </span>
        </div>

        {isApproved ? (
          <div className="text-center">
            <div className="mb-1 h-10 w-48 border-b border-slate-800" />
            <span className="font-semibold">{r.sign.head}</span>
          </div>
        ) : (
          <div className="text-center text-slate-400">
            <div className="mb-1 h-10 w-48 border-b border-dashed border-slate-300" />
            <span className="text-xs">{t.signatureNotApplicable}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdmissionFormDocument;
