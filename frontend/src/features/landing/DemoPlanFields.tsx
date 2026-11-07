import { useEffect, useState } from "react";
import { GraduationCap, Layers3 } from "lucide-react";
import { formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { getPublicPricing, type PublicPricing } from "../../services/publicPlansApi";
import { matchingPlan } from "./pricing-selection";
import { useDemoPlanStore } from "./demo-plan.store";
import { demoPlanText } from "./demo-plan.text";
import { FieldError, RequiredMark, invalidFieldClass } from "./DemoFormFeedback";

export default function DemoPlanFields({
  inputClass,
  errors,
  onPlanValidityChange,
}: {
  inputClass: string;
  errors: Record<string, string>;
  onPlanValidityChange: (valid: boolean) => void;
}) {
  const t = useText(demoPlanText);
  const lang = useLang();
  const intent = useDemoPlanStore((s) => s.intent);
  const [data, setData] = useState<PublicPricing | null>(null);
  const [failed, setFailed] = useState(false);
  const [studentCount, setStudentCount] = useState("");
  const [manualPlan, setManualPlan] = useState("");
  useEffect(() => {
    if (!intent) return;
    setManualPlan(intent.custom ? "custom" : intent.planId == null ? "" : String(intent.planId));
    if (intent.studentCount != null) setStudentCount(String(intent.studentCount));
  }, [intent]);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || controller.signal.aborted) return;
      pending = true;
      try {
        const next = await getPublicPricing(controller.signal);
        if (!controller.signal.aborted) {
          setData(next);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(visible, 15_000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  const numericCount = Number(studentCount);
  const count =
    studentCount.trim() !== "" &&
    Number.isSafeInteger(numericCount) &&
    numericCount > 0 &&
    numericCount <= 9999999
      ? numericCount
      : null;
  const recommended =
    count != null && data ? matchingPlan(data.plans, count, data.maxPlanStudents) : null;
  const selected =
    manualPlan && manualPlan !== "custom"
      ? data?.plans.find((p) => p.id === Number(manualPlan))
      : manualPlan === "custom"
        ? null
        : recommended;
  const custom =
    manualPlan === "custom" || (!manualPlan && count != null && data != null && !recommended);
  const unresolvedSelection = !!manualPlan && manualPlan !== "custom" && !selected;
  const unavailableSelection = unresolvedSelection && (!!data || failed);
  const validPlan = !!selected || custom;
  useEffect(() => {
    onPlanValidityChange(validPlan);
  }, [validPlan, onPlanValidityChange]);
  const planName = selected
    ? lang === "bn"
      ? selected.nameBn || selected.name
      : selected.name
    : t.custom;
  const money = (value: number | null) =>
    value == null ? t.negotiated : `৳${formatNumber(value, lang)}`;
  // Existing lead messages carry the enquiry context; these are public quotes,
  // never a purchase, payment record or server-authoritative billing amount.
  const details = selected
    ? [
        `Demo plan: ${selected.name} (#${selected.id})`,
        `Student limit: ${selected.studentLimit}`,
        `First-year quote (BDT): ${selected.price ?? "Negotiated"}`,
        `Annual renewal quote (BDT): ${selected.renewalPrice ?? "Negotiated"}`,
      ].join("\n")
    : custom
      ? "Demo plan: Custom (price to be discussed)"
      : "";
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          {t.students}
          <input
            name="studentCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={9999999}
            step={1}
            value={studentCount}
            onChange={(e) => {
              setStudentCount(e.target.value);
              setManualPlan("");
            }}
            placeholder={t.countPlaceholder}
            className={inputClass + (errors.studentCount ? invalidFieldClass : "")}
            aria-invalid={!!errors.studentCount}
            aria-describedby={errors.studentCount ? "demo-studentCount-error" : undefined}
          />
          <FieldError name="studentCount" message={errors.studentCount} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          {t.plan}
          <RequiredMark />
          <select
            name="interestedPlan"
            value={
              unresolvedSelection
                ? ""
                : manualPlan || (selected ? String(selected.id) : custom ? "custom" : "")
            }
            required
            onChange={(e) => setManualPlan(e.target.value)}
            className={inputClass + (errors.interestedPlan ? invalidFieldClass : "")}
            aria-invalid={!!errors.interestedPlan}
            aria-describedby={errors.interestedPlan ? "demo-interestedPlan-error" : undefined}
          >
            <option value="">{t.automatic}</option>
            {data?.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {lang === "bn" ? plan.nameBn || plan.name : plan.name} —{" "}
                {t.capacity(formatNumber(plan.studentLimit, lang))}
              </option>
            ))}
            <option value="custom">{t.custom}</option>
          </select>
          <FieldError name="interestedPlan" message={errors.interestedPlan} />
        </label>
      </div>
      <input type="hidden" name="planDetails" value={details} />
      {unavailableSelection && (
        <p role="alert" className="text-xs text-amber-700">
          {t.removed}
        </p>
      )}
      {failed ? (
        <p className="text-xs leading-6 text-amber-700">{t.unavailable}</p>
      ) : (
        !data && (
          <p role="status" className="text-xs text-slate-500">
            {t.loading}
          </p>
        )
      )}
      {(selected || custom) && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
        >
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-800">
            <Layers3 size={14} aria-hidden="true" />
            {t.selected}
          </p>
          <p className="mt-2 text-lg font-bold text-slate-900">{planName}</p>
          {selected ? (
            <>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-800">
                <GraduationCap size={14} aria-hidden="true" />
                {t.capacity(formatNumber(selected.studentLimit, lang))}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                {[
                  [t.first, money(selected.price)],
                  [t.renewal, money(selected.renewalPrice)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1 text-lg font-bold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs leading-5 text-slate-500">{t.priceHint}</p>
              {count != null && count > selected.studentLimit && (
                <p className="mt-2 text-xs leading-5 text-amber-800">{t.overLimit}</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-xs leading-6 text-slate-600">{t.customHint}</p>
          )}
        </div>
      )}
    </div>
  );
}
