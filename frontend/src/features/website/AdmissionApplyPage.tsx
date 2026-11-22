import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { submitFullAdmissionApplication } from "../../services/publicWebsiteApi";
import { accentStrong, accentText, pickTextOn } from "./colorUtils";
import { resolveTheme } from "./themes";
import { formatCurrency, getText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { createAdmissionFormData } from "@madrasha/shared-ui/src/components/admission/defaults";
import AdmissionFormFields from "@madrasha/shared-ui/src/components/admission/AdmissionFormFields";
import { validateAdmissionForm } from "@madrasha/shared-ui/src/components/admission/validation";
import { buildAdmissionPayload } from "@madrasha/shared-ui/src/components/admission/payload";
import { admissionApplyText } from "./admissionApply.text";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";

import type { AdmissionFormErrors } from "@madrasha/shared-ui/src/components/admission/types";

export default function AdmissionApplyPage({ data, slug, homePath }: { data: any; slug: string; homePath: string }) {
  const t = useText(admissionApplyText);
  const lang = useLang();
  const [form, setForm] = useState(createAdmissionFormData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AdmissionFormErrors>({});
  // The class's default fees, billed immediately on submit (see admitStudent
  // on the backend) - shown as info only, since there's no online payment
  // gateway here; the applicant pays in person at the madrasa office.
  const [submittedInvoices, setSubmittedInvoices] = useState<Array<{ title: string; amount: number }>>([]);

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
    if (submitting) return;
    setError("");

    const nextFieldErrors = validateAdmissionForm(form, t.requiredError);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length) {
      setError(t.requiredError);
      useToastStore.getState().show(t.requiredError, "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitFullAdmissionApplication(slug, buildAdmissionPayload(form));
      const invoices = res?.data?.invoices || [];
      setSubmittedInvoices(invoices.map((inv: any) => ({ title: inv.title, amount: Number(inv.amount) })));
      setSuccess(true);
      useToastStore.getState().show(getText(admissionApplyText).successTitle, "success");
    } catch (err: any) {
      const message = err?.response?.data?.message || getText(admissionApplyText).submitFailed;
      setError(message);
      useToastStore.getState().show(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="admission" className="bg-slate-50 text-slate-900">
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
              to={homePath}
              className={`mt-6 inline-flex items-center gap-1.5 ${theme.button} px-5 py-2.5 text-sm font-bold ${theme.shadowSm} transition hover:opacity-90`}
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              {t.backHome}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4 sm:space-y-6">
            {error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
            <AdmissionFormFields formData={form} setFormData={setForm} errors={fieldErrors} setErrors={setFieldErrors} loadData={loadAdmissionData} loading={submitting} />
            <p className="text-center text-xs text-slate-400" style={{ color: accentLabel }}>{t.requiredNote}</p>
          </form>
        )}
      </main>
    </section>
  );
}
