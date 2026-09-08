type Props = {
  row: Record<string, any>;
  madrasaName?: string;
};

const genderLabel = (g?: number | null) => (g === 1 ? "ছেলে" : g === 2 ? "মেয়ে" : "-");
const residencyLabel = (v?: number | null) => (v === 1 ? "আবাসিক" : v === 2 ? "অনাবাসিক" : "-");
const admissionTypeLabel = (v?: string) => (v === "RE_ADMISSION" ? "পুনঃভর্তি (পুরাতন)" : "নতুন");

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

  return (
    <div className="print-page-break rounded-xl border-2 border-slate-800 bg-white p-8">
      <div className="text-center">
        {madrasaName && <h2 className="text-xl font-bold">{madrasaName}</h2>}
        <h3 className="mt-1 text-lg font-bold underline">শিক্ষার্থী ভর্তি ফরম</h3>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-8 md:grid-cols-2">
        <div>
          <h4 className="mb-1 text-xs font-bold uppercase text-slate-400">শিক্ষার্থীর তথ্য</h4>
          <Field label="নাম" value={row.name_bn} />
          <Field label="আরবি নাম" value={row.arabic_name} />
          <Field label="NID/জন্ম নিবন্ধন" value={row.nid} />
          <Field label="লিঙ্গ" value={genderLabel(row.gender)} />
          <Field label="জন্ম তারিখ" value={row.dob ? String(row.dob).slice(0, 10) : null} />
          <Field label="রক্তের গ্রুপ" value={row.blood_group} />
          <Field label="আবাসিক/অনাবাসিক" value={residencyLabel(row.residency_type)} />
          <Field label="এতিম" value={row.is_orphan === 1 ? "হ্যাঁ" : "না"} />
          <Field label="ভর্তির ধরন" value={admissionTypeLabel(row.admission_type)} />
        </div>

        <div>
          <h4 className="mb-1 text-xs font-bold uppercase text-slate-400">ভর্তির তথ্য</h4>
          <Field label="শ্রেণি" value={row.current_class} />
          <Field label="শিক্ষাবর্ষ" value={row.academic_year} />
          <Field label="রোল নম্বর" value={row.roll} />
          <Field label="রেজিস্ট্রেশন নম্বর" value={row.registration_no} />
          <Field label="ভর্তির তারিখ" value={row.admission_date ? String(row.admission_date).slice(0, 10) : null} />
          <Field label="পূর্ববর্তী প্রতিষ্ঠান" value={row.previous_institution} />
          <Field label="পূর্বের ফলাফল" value={row.previous_result} />
        </div>

        <div>
          <h4 className="mb-1 mt-4 text-xs font-bold uppercase text-slate-400">অভিভাবকের তথ্য</h4>
          <Field label="পিতার নাম" value={row.father_name} />
          <Field label="পিতার NID" value={row.father_nid} />
          <Field label="পিতার পেশা" value={row.father_occupation} />
          <Field label="মাতার নাম" value={row.mother_name} />
          <Field label="মাতার NID" value={row.mother_nid} />
          <Field label="মাতার পেশা" value={row.mother_occupation} />
          <Field label="মোবাইল নম্বর" value={row.guardian_phone} />
          <Field label="বিকল্প মোবাইল নম্বর" value={row.guardian_phone_2} />
        </div>

        <div>
          {row.alt_guardian_name && (
            <>
              <h4 className="mb-1 mt-4 text-xs font-bold uppercase text-slate-400">
                বিকল্প অভিভাবক
              </h4>
              <Field label="নাম" value={row.alt_guardian_name} />
              <Field label="সম্পর্ক" value={row.alt_guardian_relation} />
              <Field label="মোবাইল নম্বর" value={row.alt_guardian_phone} />
              <Field label="ঠিকানা" value={row.alt_guardian_address} />
            </>
          )}

          <h4 className="mb-1 mt-4 text-xs font-bold uppercase text-slate-400">ঠিকানা</h4>
          <Field label="বিভাগ" value={row.division} />
          <Field label="জেলা" value={row.district} />
          <Field label="থানা/উপজেলা" value={row.thana} />
          <Field label="গ্রাম" value={row.village} />
        </div>
      </div>

      <div className="mt-16 flex items-end justify-between text-sm">
        <div>
          অবস্থা:{" "}
          <span className="font-bold">
            {isApproved ? "অনুমোদিত" : isRejected ? "বাতিলকৃত" : "পর্যালোচনাধীন"}
          </span>
        </div>

        {isApproved ? (
          <div className="text-center">
            <div className="mb-1 h-10 w-48 border-b border-slate-800" />
            <span className="font-semibold">মুহতামিমের স্বাক্ষর</span>
          </div>
        ) : (
          <div className="text-center text-slate-400">
            <div className="mb-1 h-10 w-48 border-b border-dashed border-slate-300" />
            <span className="text-xs">অনুমোদনের পূর্বে স্বাক্ষর প্রযোজ্য নয়</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdmissionFormDocument;
