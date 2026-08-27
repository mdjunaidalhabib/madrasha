import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, GraduationCap, Loader2 } from "lucide-react";
import { getPublicWebsite, submitFullAdmissionApplication } from "../../../services/websiteApi";
import { accentStrong, accentText, initials, pickTextOn } from "./colorUtils";
import CustomDatePicker from "../../../components/CustomDatePicker/CustomDatePicker";
import ScriptInput from "../../../components/ui/ScriptInput";
import NumericInput from "../../../components/ui/NumericInput";
import AddressCascadeFields from "../../../components/ui/AddressCascadeFields";

type DivisionItem = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string; division_id: number };

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const emptyForm = {
  name_bn: "",
  arabic_name: "",
  name_en: "",
  nid: "",
  gender: "" as number | "",
  dob: "",
  blood_group: "",
  residency_type: "" as number | "",
  is_orphan: false,
  division_id: "",
  class_id: "",
  previous_class_id: "",
  previous_institution: "",
  previous_result: "",
  father_name: "",
  father_arabic_name: "",
  father_name_en: "",
  father_nid: "",
  father_occupation: "",
  mother_name: "",
  mother_arabic_name: "",
  mother_name_en: "",
  mother_nid: "",
  mother_occupation: "",
  guardian_phone: "",
  guardian_phone_2: "",
  has_alt_guardian: false,
  alt_guardian_name: "",
  alt_guardian_arabic_name: "",
  alt_guardian_name_en: "",
  alt_guardian_relation: "",
  alt_guardian_address: "",
  alt_guardian_phone: "",
  division: "",
  district: "",
  thana: "",
  village: "",
  image: "",
  note: "",
};

const cleanPhone = (phone: string) => phone.replace(/[^0-9]/g, "");

const cardClass = "rounded-3xl border border-slate-100 bg-white p-6 shadow-sm md:p-8";
const labelClass = "text-sm font-semibold text-slate-700";
const baseInputClass = "mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2";
const inputClass = `${baseInputClass} border-slate-200`;
const requiredMark = <span className="text-red-500">*</span>;

export default function AdmissionApplyPage() {
  const params = useParams();
  const slug = params.madrasaSlug || params.slug || "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
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
  const settings = data?.settings || {};
  const divisions: DivisionItem[] = data?.divisions || [];
  const allClasses: ClassItem[] = data?.classes || [];

  const themeColor = settings.theme_color || "#2563eb";
  const accentSolid = useMemo(() => accentStrong(themeColor), [themeColor]);
  const accentLabel = useMemo(() => accentText(themeColor), [themeColor]);
  const onAccent = useMemo(() => pickTextOn(accentSolid), [accentSolid]);

  const classesInDivision = useMemo(
    () => allClasses.filter((c) => String(c.division_id) === String(form.division_id)),
    [allClasses, form.division_id],
  );

  const update = (key: keyof typeof emptyForm, value: string | boolean | number) => {
    setForm((prev) => ({ ...prev, [key]: value } as typeof emptyForm));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const handleDivisionChange = (value: string) => {
    setForm((prev) => ({ ...prev, division_id: value, class_id: "", previous_class_id: "" }));
    setFieldErrors((prev) => (prev.division_id ? { ...prev, division_id: false } : prev));
  };

  const fieldClass = (key: string) =>
    `${baseInputClass} ${fieldErrors[key] ? "border-red-500 focus:ring-red-500" : "border-slate-200"}`;

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Public visitors aren't authenticated, so the cloud-upload endpoint
      // (auth-protected) can't be called here - the base64 value is stored
      // directly, same as the admin form's fallback when cloud storage isn't
      // configured.
      setImagePreview(base64);
      update("image", base64);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nextFieldErrors: Record<string, boolean> = {
      name_bn: !form.name_bn.trim(),
      division_id: !form.division_id,
      class_id: !form.class_id,
      guardian_phone: !form.guardian_phone.trim(),
    };
    setFieldErrors(nextFieldErrors);

    if (Object.values(nextFieldErrors).some(Boolean)) {
      setError("লাল চিহ্নিত আবশ্যক (*) ঘরগুলো পূরণ করুন");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitFullAdmissionApplication(slug, {
        name_bn: form.name_bn.trim(),
        arabic_name: form.arabic_name || null,
        name_en: form.name_en || null,
        nid: form.nid || null,
        gender: form.gender === "" ? null : Number(form.gender),
        dob: form.dob || null,
        blood_group: form.blood_group || null,
        residency_type: form.residency_type === "" ? null : Number(form.residency_type),
        is_orphan: form.is_orphan ? 1 : 0,
        division_id: Number(form.division_id),
        class_id: Number(form.class_id),
        academic_year: String(new Date().getFullYear()),
        previous_class_id: form.previous_class_id ? Number(form.previous_class_id) : null,
        previous_institution: form.previous_institution || null,
        previous_result: form.previous_result || null,
        father_name: form.father_name || null,
        father_arabic_name: form.father_arabic_name || null,
        father_name_en: form.father_name_en || null,
        father_nid: form.father_nid || null,
        father_occupation: form.father_occupation || null,
        mother_name: form.mother_name || null,
        mother_arabic_name: form.mother_arabic_name || null,
        mother_name_en: form.mother_name_en || null,
        mother_nid: form.mother_nid || null,
        mother_occupation: form.mother_occupation || null,
        guardian_phone: cleanPhone(form.guardian_phone),
        guardian_phone_2: form.guardian_phone_2 ? cleanPhone(form.guardian_phone_2) : null,
        alt_guardian_name: form.has_alt_guardian ? form.alt_guardian_name || null : null,
        alt_guardian_arabic_name: form.has_alt_guardian ? form.alt_guardian_arabic_name || null : null,
        alt_guardian_name_en: form.has_alt_guardian ? form.alt_guardian_name_en || null : null,
        alt_guardian_relation: form.has_alt_guardian ? form.alt_guardian_relation || null : null,
        alt_guardian_address: form.has_alt_guardian ? form.alt_guardian_address || null : null,
        alt_guardian_phone: form.has_alt_guardian
          ? cleanPhone(form.alt_guardian_phone) || null
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
      setError(err?.response?.data?.message || "আবেদন জমা দেওয়া যায়নি, আবার চেষ্টা করুন।");
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
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link to=".." relative="path" className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
            <ChevronLeft size={16} />
            ফিরে যান
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {madrasa?.logo_url ? (
              <img src={madrasa.logo_url} alt="Logo" className="h-8 w-8 rounded-full object-cover" />
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

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-md"
            style={{ backgroundColor: accentSolid, color: onAccent }}
          >
            <GraduationCap size={26} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">অনলাইনে ভর্তি আবেদন</h1>
          <p className="mt-2 text-sm text-slate-500">
            নিচের ফরমটি সঠিকভাবে পূরণ করে জমা দিন। আবেদনটি মাদ্রাসা কর্তৃপক্ষের অনুমোদনের পর
            চূড়ান্ত ভর্তি সম্পন্ন হবে।
          </p>
        </div>

        {success ? (
          <div className="rounded-3xl border border-green-100 bg-green-50 p-8 text-center shadow-sm">
            <CheckCircle2 size={40} className="mx-auto text-green-600" />
            <h2 className="mt-4 text-lg font-bold text-green-800">আবেদন সফলভাবে জমা হয়েছে</h2>
            <p className="mt-2 text-sm text-green-700">
              আপনার আবেদনটি পর্যালোচনার অপেক্ষায় আছে। মাদ্রাসা কর্তৃপক্ষ অনুমোদন করলে আপনার দেওয়া
              ফোন নম্বরে যোগাযোগ করা হবে।
            </p>

            {submittedInvoices.length > 0 && (
              <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-green-200 bg-white p-4 text-left shadow-sm">
                <h3 className="text-sm font-bold text-slate-700">প্রযোজ্য ভর্তি ফি</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {submittedInvoices.map((inv, index) => (
                    <li key={index} className="flex items-center justify-between gap-2">
                      <span>{inv.title}</span>
                      <span className="font-semibold text-slate-800">৳{inv.amount}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-bold text-slate-800">
                  <span>মোট</span>
                  <span>৳{submittedInvoices.reduce((sum, inv) => sum + inv.amount, 0)}</span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  অনুগ্রহ করে এই ফি মাদ্রাসা অফিসে সরাসরি গিয়ে জমা দিন। অনুমোদনের আগে ফি জমা না
                  হলে ভর্তি প্রক্রিয়া সম্পন্ন হবে না।
                </p>
              </div>
            )}

            <Link
              to=".."
              relative="path"
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              হোমপেজে ফিরে যান
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
            )}

            {/* ছবি */}
            <div className={cardClass}>
              <div className="flex justify-center">
                <div
                  className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition overflow-hidden"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    backgroundImage: imagePreview ? `url(${imagePreview})` : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {!imagePreview && <span className="text-slate-400 text-xs">ছবি আপলোড</span>}
                </div>
                <input
                  type="file"
                  ref={fileRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImage}
                />
              </div>
            </div>

            {/* শিক্ষার্থীর তথ্য */}
            <div className={cardClass}>
              <h2 className="mb-4 text-base font-bold text-slate-800">শিক্ষার্থীর তথ্য</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelClass}>শিক্ষার্থীর পূর্ণ নাম (বাংলা) {requiredMark}</label>
                  <ScriptInput
                    scriptLang="bn"
                    className={fieldClass("name_bn")}
                    value={form.name_bn}
                    onChange={(e) => update("name_bn", e.target.value)}
                    placeholder="সম্পূর্ণ নাম লিখুন"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>নাম (আরবি)</label>
                  <ScriptInput
                    scriptLang="ar"
                    className={inputClass}
                    value={form.arabic_name}
                    onChange={(e) => update("arabic_name", e.target.value)}
                    placeholder="اسم الطالب"
                  />
                </div>
                <div>
                  <label className={labelClass}>নাম (ইংরেজি)</label>
                  <ScriptInput
                    scriptLang="en"
                    className={inputClass}
                    value={form.name_en}
                    onChange={(e) => update("name_en", e.target.value)}
                    placeholder="Student's Name"
                  />
                </div>
                <div>
                  <label className={labelClass}>NID/জন্ম নিবন্ধন নম্বর</label>
                  <NumericInput
                    className={inputClass}
                    value={form.nid}
                    onChange={(e) => update("nid", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>লিঙ্গ</label>
                  <select
                    className={inputClass}
                    value={form.gender}
                    onChange={(e) => update("gender", e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">নির্বাচন করুন</option>
                    <option value={1}>ছেলে</option>
                    <option value={2}>মেয়ে</option>
                  </select>
                </div>
                <div>
                  <CustomDatePicker
                    label="জন্ম তারিখ"
                    value={form.dob}
                    onChange={(date) => update("dob", date)}
                  />
                </div>
                <div>
                  <label className={labelClass}>রক্তের গ্রুপ</label>
                  <select
                    className={inputClass}
                    value={form.blood_group}
                    onChange={(e) => update("blood_group", e.target.value)}
                  >
                    <option value="">নির্বাচন করুন</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>আবাসিক/অনাবাসিক</label>
                  <select
                    className={inputClass}
                    value={form.residency_type}
                    onChange={(e) =>
                      update("residency_type", e.target.value ? Number(e.target.value) : "")
                    }
                  >
                    <option value="">নির্বাচন করুন</option>
                    <option value={1}>আবাসিক</option>
                    <option value={2}>অনাবাসিক</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>এতিম শিক্ষার্থী</label>
                  <select
                    className={inputClass}
                    value={form.is_orphan ? "yes" : "no"}
                    onChange={(e) => update("is_orphan", e.target.value === "yes")}
                  >
                    <option value="no">না</option>
                    <option value="yes">হ্যাঁ</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ভর্তি তথ্য */}
            <div className={cardClass}>
              <h2 className="mb-4 text-base font-bold text-slate-800">ভর্তির তথ্য</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>বিভাগ {requiredMark}</label>
                  <select
                    className={fieldClass("division_id")}
                    value={form.division_id}
                    onChange={(e) => handleDivisionChange(e.target.value)}
                    required
                  >
                    <option value="">নির্বাচন করুন</option>
                    {divisions.map((d) => (
                      <option key={d.division_id} value={d.division_id}>
                        {d.division_name_bn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ভর্তি হতে ইচ্ছুক শ্রেণি {requiredMark}</label>
                  <select
                    className={fieldClass("class_id")}
                    value={form.class_id}
                    onChange={(e) => update("class_id", e.target.value)}
                    disabled={!classesInDivision.length}
                    required
                  >
                    <option value="">নির্বাচন করুন</option>
                    {classesInDivision.map((c) => (
                      <option key={c.class_id} value={c.class_id}>
                        {c.class_name_bn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>পূর্বের শ্রেণি</label>
                  <select
                    className={inputClass}
                    value={form.previous_class_id}
                    onChange={(e) => update("previous_class_id", e.target.value)}
                    disabled={!classesInDivision.length}
                  >
                    <option value="">নির্বাচন করুন</option>
                    {classesInDivision.map((c) => (
                      <option key={c.class_id} value={c.class_id}>
                        {c.class_name_bn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>পূর্ববর্তী প্রতিষ্ঠান</label>
                  <input
                    className={inputClass}
                    value={form.previous_institution}
                    onChange={(e) => update("previous_institution", e.target.value)}
                    placeholder="পূর্ববর্তী প্রতিষ্ঠানের নাম"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>পূর্বের ফলাফল</label>
                  <input
                    className={inputClass}
                    value={form.previous_result}
                    onChange={(e) => update("previous_result", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* অভিভাবকের তথ্য */}
            <div className={cardClass}>
              <h2 className="mb-4 text-base font-bold text-slate-800">অভিভাবকের তথ্য</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>পিতার নাম (বাংলা)</label>
                  <ScriptInput
                    scriptLang="bn"
                    className={inputClass}
                    value={form.father_name}
                    onChange={(e) => update("father_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>পিতার নাম (আরবি)</label>
                  <ScriptInput
                    scriptLang="ar"
                    className={inputClass}
                    value={form.father_arabic_name}
                    onChange={(e) => update("father_arabic_name", e.target.value)}
                    placeholder="الأب اسم"
                  />
                </div>
                <div>
                  <label className={labelClass}>পিতার নাম (ইংরেজি)</label>
                  <ScriptInput
                    scriptLang="en"
                    className={inputClass}
                    value={form.father_name_en}
                    onChange={(e) => update("father_name_en", e.target.value)}
                    placeholder="Father's Name"
                  />
                </div>
                <div>
                  <label className={labelClass}>পিতার NID</label>
                  <NumericInput
                    className={inputClass}
                    value={form.father_nid}
                    onChange={(e) => update("father_nid", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>পিতার পেশা</label>
                  <input
                    className={inputClass}
                    value={form.father_occupation}
                    onChange={(e) => update("father_occupation", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>মাতার নাম (বাংলা)</label>
                  <ScriptInput
                    scriptLang="bn"
                    className={inputClass}
                    value={form.mother_name}
                    onChange={(e) => update("mother_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>মাতার নাম (আরবি)</label>
                  <ScriptInput
                    scriptLang="ar"
                    className={inputClass}
                    value={form.mother_arabic_name}
                    onChange={(e) => update("mother_arabic_name", e.target.value)}
                    placeholder="الأم اسم"
                  />
                </div>
                <div>
                  <label className={labelClass}>মাতার নাম (ইংরেজি)</label>
                  <ScriptInput
                    scriptLang="en"
                    className={inputClass}
                    value={form.mother_name_en}
                    onChange={(e) => update("mother_name_en", e.target.value)}
                    placeholder="Mother's Name"
                  />
                </div>
                <div>
                  <label className={labelClass}>মাতার NID</label>
                  <NumericInput
                    className={inputClass}
                    value={form.mother_nid}
                    onChange={(e) => update("mother_nid", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>মাতার পেশা</label>
                  <input
                    className={inputClass}
                    value={form.mother_occupation}
                    onChange={(e) => update("mother_occupation", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>অভিভাবকের ফোন নম্বর {requiredMark}</label>
                  <NumericInput
                    className={fieldClass("guardian_phone")}
                    value={form.guardian_phone}
                    onChange={(e) => update("guardian_phone", e.target.value)}
                    placeholder="01XXXXXXXXX"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>অভিভাবকের বিকল্প ফোন নম্বর</label>
                  <NumericInput
                    className={inputClass}
                    value={form.guardian_phone_2}
                    onChange={(e) => update("guardian_phone_2", e.target.value)}
                    placeholder="01XXXXXXXXX"
                  />
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.has_alt_guardian}
                  onChange={(e) => update("has_alt_guardian", e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm font-semibold text-slate-700">
                  পিতা-মাতা ছাড়া অন্য অভিভাবক আছে
                </span>
              </label>

              {form.has_alt_guardian && (
                <div className="mt-3 grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>অভিভাবকের নাম (বাংলা)</label>
                    <ScriptInput
                      scriptLang="bn"
                      className={inputClass}
                      value={form.alt_guardian_name}
                      onChange={(e) => update("alt_guardian_name", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>অভিভাবকের নাম (আরবি)</label>
                    <ScriptInput
                      scriptLang="ar"
                      className={inputClass}
                      value={form.alt_guardian_arabic_name}
                      onChange={(e) => update("alt_guardian_arabic_name", e.target.value)}
                      placeholder="اسم ولي الأمر"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>অভিভাবকের নাম (ইংরেজি)</label>
                    <ScriptInput
                      scriptLang="en"
                      className={inputClass}
                      value={form.alt_guardian_name_en}
                      onChange={(e) => update("alt_guardian_name_en", e.target.value)}
                      placeholder="Guardian's Name"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ছাত্রের সাথে সম্পর্ক</label>
                    <input
                      className={inputClass}
                      value={form.alt_guardian_relation}
                      onChange={(e) => update("alt_guardian_relation", e.target.value)}
                      placeholder="যেমন: চাচা, দাদা"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>মোবাইল নম্বর</label>
                    <NumericInput
                      className={inputClass}
                      value={form.alt_guardian_phone}
                      onChange={(e) => update("alt_guardian_phone", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ঠিকানা</label>
                    <input
                      className={inputClass}
                      value={form.alt_guardian_address}
                      onChange={(e) => update("alt_guardian_address", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ঠিকানা */}
            <div className={cardClass}>
              <h2 className="mb-4 text-base font-bold text-slate-800">ঠিকানা</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <AddressCascadeFields
                  values={{ division: form.division || "", district: form.district || "", thana: form.thana || "" }}
                  onChange={update}
                  selectClassName={inputClass}
                  labelClassName={labelClass}
                  wrapperClassName=""
                />
                <div>
                  <label className={labelClass}>গ্রাম</label>
                  <input
                    className={inputClass}
                    value={form.village}
                    onChange={(e) => update("village", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              {submitting ? "জমা দেওয়া হচ্ছে..." : "আবেদন জমা দিন"}
            </button>
            <p className="text-center text-xs text-slate-400" style={{ color: accentLabel }}>
              * চিহ্নিত ঘরগুলো আবশ্যক
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
