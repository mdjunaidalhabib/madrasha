import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, GraduationCap, Loader2 } from "lucide-react";
import { getPublicWebsite, submitAdmissionApplication } from "../../../services/websiteApi";
import { accentStrong, accentText, initials, pickTextOn } from "./colorUtils";

const emptyForm = {
  student_name: "",
  father_name: "",
  mother_name: "",
  gender: "",
  date_of_birth: "",
  class_applied: "",
  guardian_phone: "",
  address: "",
  note: "",
};

export default function AdmissionApplyPage() {
  const params = useParams();
  const slug = params.madrasaSlug || params.slug || "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPublicWebsite(slug)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const madrasa = data?.madrasa;
  const settings = data?.settings || {};
  const classes: { id: number; name: string }[] = data?.classes || [];

  const themeColor = settings.theme_color || "#2563eb";
  const accentSolid = useMemo(() => accentStrong(themeColor), [themeColor]);
  const accentLabel = useMemo(() => accentText(themeColor), [themeColor]);
  const onAccent = useMemo(() => pickTextOn(accentSolid), [accentSolid]);

  const update = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.student_name.trim()) {
      setError("শিক্ষার্থীর নাম আবশ্যক");
      return;
    }
    if (!form.guardian_phone.trim()) {
      setError("অভিভাবকের ফোন নম্বর আবশ্যক");
      return;
    }
    setSubmitting(true);
    try {
      await submitAdmissionApplication(slug, form);
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
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8 w-8 rounded-full object-cover" />
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
            নিচের ফরমটি সঠিকভাবে পূরণ করে জমা দিন। মাদ্রাসা কর্তৃপক্ষ যোগাযোগ করে পরবর্তী ধাপ জানিয়ে দেবেন।
          </p>
        </div>

        {success ? (
          <div className="rounded-3xl border border-green-100 bg-green-50 p-8 text-center shadow-sm">
            <CheckCircle2 size={40} className="mx-auto text-green-600" />
            <h2 className="mt-4 text-lg font-bold text-green-800">আবেদন সফলভাবে জমা হয়েছে</h2>
            <p className="mt-2 text-sm text-green-700">
              আপনার আবেদনটি মাদ্রাসা কর্তৃপক্ষের কাছে পাঠানো হয়েছে। প্রয়োজনে তারা আপনার দেওয়া ফোন নম্বরে যোগাযোগ করবেন।
            </p>
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
          <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">শিক্ষার্থীর পূর্ণ নাম *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={{ boxShadow: undefined }}
                  value={form.student_name}
                  onChange={(e) => update("student_name", e.target.value)}
                  placeholder="সম্পূর্ণ নাম লিখুন"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">পিতার নাম</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                  value={form.father_name}
                  onChange={(e) => update("father_name", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">মাতার নাম</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                  value={form.mother_name}
                  onChange={(e) => update("mother_name", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">লিঙ্গ</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                  value={form.gender}
                  onChange={(e) => update("gender", e.target.value)}
                >
                  <option value="">নির্বাচন করুন</option>
                  <option value="male">ছাত্র</option>
                  <option value="female">ছাত্রী</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">জন্ম তারিখ</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                  value={form.date_of_birth}
                  onChange={(e) => update("date_of_birth", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">ভর্তি হতে ইচ্ছুক শ্রেণি</label>
                {classes.length ? (
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                    value={form.class_applied}
                    onChange={(e) => update("class_applied", e.target.value)}
                  >
                    <option value="">নির্বাচন করুন</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                    value={form.class_applied}
                    onChange={(e) => update("class_applied", e.target.value)}
                    placeholder="যেমন: নাযেরা, হিফজ"
                  />
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">অভিভাবকের ফোন নম্বর *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                  value={form.guardian_phone}
                  onChange={(e) => update("guardian_phone", e.target.value)}
                  placeholder="01XXXXXXXXX"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">ঠিকানা</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                  rows={2}
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">অতিরিক্ত তথ্য / মন্তব্য</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                  rows={3}
                  value={form.note}
                  onChange={(e) => update("note", e.target.value)}
                />
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
