import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import PlanCard from "@madrasha/shared-ui/src/components/plans/PlanCard";
import {
  planAccent,
  readableAccentText,
} from "@madrasha/shared-ui/src/components/plans/plan-colors";
import { formatNumber, LOCALE_MAP, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { getPublicPricing, type PublicPricing } from "../../services/publicPlansApi";
import {
  centerFeatured,
  matchingPlan,
  pricingGroups,
  pricingQuickChoices,
} from "./pricing-selection";
import { landingText } from "./landing.text";
import { useDemoPlanStore } from "./demo-plan.store";

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2";
const rowClass =
  "flex snap-x snap-mandatory gap-5 overflow-x-auto px-2 pb-5 pt-4 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible";
const cardClass =
  "relative min-h-[740px] w-[82%] shrink-0 snap-center rounded-2xl md:w-auto [&>article]:h-full";

function PricingSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} role="status" className="space-y-6">
      <span className="sr-only">{label}</span>
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none" />
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none" />
      <div className="mx-auto h-12 w-64 animate-pulse rounded-xl bg-slate-200/70 motion-reduce:animate-none" />
      <div className={rowClass}>
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className={`${cardClass} animate-pulse border border-slate-200 bg-white motion-reduce:animate-none`}
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none" />
    </div>
  );
}

export default function PricingSection() {
  const chooseDemo = useDemoPlanStore((s) => s.choose);
  const t = useText(landingText).pricing;
  const lang = useLang();
  const [data, setData] = useState<PublicPricing | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [studentInput, setStudentInput] = useState<string | null>(null);
  const [manualGroup, setManualGroup] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const result = await getPublicPricing(controller.signal);
        if (!controller.signal.aborted) {
          setData(result);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        pending = false;
      }
    }
    void refresh();
    // Recheck within the server cache window so a cache warmed by another visitor
    // cannot add a second minute of stale prices to this page.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [retry]);

  const defaultCount = data?.plans.length
    ? Math.min(...data.plans.map((plan) => plan.studentLimit))
    : 0;
  const input = studentInput ?? String(defaultCount);
  const count =
    input.trim() !== "" && Number.isSafeInteger(Number(input)) && Number(input) >= 0
      ? Number(input)
      : null;
  const match = useMemo(
    () => (data && count !== null ? matchingPlan(data.plans, count, data.maxPlanStudents) : null),
    [data, count],
  );
  const custom = !!data && count !== null && !match;
  const groups = pricingGroups(data?.plans ?? []);
  const matchingGroup =
    match && data ? Math.floor(data.plans.findIndex((plan) => plan.id === match.id) / 3) : 0;
  const activeGroup = Math.min(manualGroup ?? matchingGroup, Math.max(0, groups.length - 1));
  const visiblePlans = centerFeatured(groups[activeGroup] ?? []);
  const money = (value: number | null) =>
    value == null
      ? t.contactPrice
      : `৳${value.toLocaleString(LOCALE_MAP[lang], { maximumFractionDigits: 2 })}`;

  useEffect(() => {
    const container = scroller.current;
    if (!container || container.scrollWidth <= container.clientWidth || !match) return;
    const card = container.querySelector<HTMLElement>(`[data-plan-id="${match.id}"]`);
    if (!card) return;
    // Scroll the mobile row horizontally while keeping the selector in place.
    container.scrollTo({
      left: card.offsetLeft - (container.clientWidth - card.clientWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [match, activeGroup, data]);

  function chooseCount(value: string) {
    setStudentInput(value);
    setManualGroup(null);
  }
  function tryAgain() {
    if (!data) setFailed(false);
    setRetry((value) => value + 1);
  }

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-24 overflow-hidden border-y border-slate-100 bg-slate-50 py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-emerald-600/20 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-800">
            {t.eyebrow}
          </span>
          <h2
            id="pricing-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          >
            {t.title}
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{t.body}</p>
        </div>

        {!data && !failed ? (
          <PricingSkeleton label={t.loading} />
        ) : !data || !data.plans.length ? (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-8 text-center"
            role="status"
          >
            <h3 className="text-lg font-semibold">{failed ? t.loadFailed : t.unavailable}</h3>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
              {t.fallbackBody}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className={`rounded-xl border px-4 py-2 text-sm ${focus}`}
                onClick={tryAgain}
              >
                {t.retry}
              </button>
              <a
                href="#demo"
                className={`rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white ${focus}`}
              >
                {t.customContact}
              </a>
            </div>
          </div>
        ) : (
          <>
            {failed && (
              <div
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                role="status"
              >
                <p>{t.refreshFailed}</p>
                <button
                  className={`rounded-lg px-2 py-1 underline ${focus}`}
                  type="button"
                  onClick={tryAgain}
                >
                  {t.retry}
                </button>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <label
                  className="text-sm font-semibold text-slate-800"
                  htmlFor="pricing-student-count"
                >
                  {t.students}
                </label>
                <input
                  id="pricing-student-count"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={input}
                  onChange={(event) => chooseCount(event.target.value)}
                  aria-invalid={count === null}
                  aria-describedby={count === null ? "pricing-count-error" : undefined}
                  className={`w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-lg tabular-nums sm:w-44 ${focus}`}
                />
              </div>
              <div role="group" aria-label={t.quickChoices} className="mt-4 flex flex-wrap gap-2">
                {pricingQuickChoices(data.plans).map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={count === value}
                    onClick={() => chooseCount(String(value))}
                    className={`min-w-14 rounded-full border px-4 py-2 text-sm font-medium tabular-nums ${focus} ${count === value ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-600"}`}
                  >
                    {formatNumber(value, lang)}
                  </button>
                ))}
              </div>
              {count === null && (
                <p id="pricing-count-error" className="mt-3 text-sm text-rose-700">
                  {t.enterCount}
                </p>
              )}
            </div>

            <div
              aria-live="polite"
              aria-atomic="true"
              className="mt-5 min-h-32 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
            >
              {match ? (
                <>
                  <h3 className="text-sm font-semibold text-emerald-950">
                    {t.quote(lang === "bn" ? match.nameBn || match.name : match.name)}
                  </h3>
                  <dl className="mt-3 grid gap-4 sm:grid-cols-3">
                    {[
                      [t.firstYear, money(match.price)],
                      [t.renewal, money(match.renewalPrice)],
                      [
                        t.perStudent,
                        count && match.price != null ? money(match.price / count) : "—",
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-emerald-900">{label}</dt>
                        <dd className="mt-1 text-xl font-semibold tabular-nums text-emerald-950">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-xs text-emerald-900">{t.perStudentHint}</p>
                </>
              ) : (
                <p className="text-sm leading-7 text-emerald-950">
                  {count === null ? t.enterCount : t.custom}
                </p>
              )}
            </div>

            {!custom && groups.length > 1 && (
              <div
                role="group"
                aria-label={t.groups}
                className="mt-7 flex flex-wrap justify-center gap-2"
              >
                {groups.map((group, index) => (
                  <button
                    key={group.map((plan) => plan.id).join(":")}
                    type="button"
                    aria-pressed={index === activeGroup}
                    onClick={() => setManualGroup(index)}
                    className={`rounded-xl border px-4 py-2 text-center text-sm ${focus} ${index === activeGroup ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                  >
                    <span className="block font-medium">
                      {t.groupNames[index] ?? t.moreGroup(formatNumber(index + 1, lang))}
                    </span>
                    <span
                      className={`mt-0.5 block text-xs tabular-nums ${index === activeGroup ? "text-slate-200" : "text-slate-500"}`}
                    >
                      {t.range(
                        formatNumber(Math.min(...group.map((plan) => plan.studentLimit)), lang),
                        formatNumber(Math.max(...group.map((plan) => plan.studentLimit)), lang),
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {custom ? (
              <div className="mx-auto my-7 max-w-lg rounded-2xl border-2 border-emerald-700 bg-white p-8 shadow-sm">
                <h3 className="text-2xl font-semibold text-slate-900">{t.custom}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {count !== null && count > data.maxPlanStudents
                    ? t.customBody(formatNumber(data.maxPlanStudents, lang))
                    : t.noFittingPlan}
                </p>
                <a
                  href="#demo"
                  onClick={() => chooseDemo({ planId: null, studentCount: count, custom: true })}
                  className={`mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white ${focus}`}
                >
                  {t.customContact}
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            ) : (
              <div ref={scroller} className={`relative mt-2 ${rowClass}`} aria-label={t.groups}>
                {visiblePlans.map((plan) => {
                  const selected = match?.id === plan.id;
                  const accent = planAccent(plan.accentColor, plan.sortOrder);
                  return (
                    <div
                      key={plan.id}
                      data-plan-id={plan.id}
                      aria-current={selected ? "true" : undefined}
                      className={`${cardClass} ${selected ? "ring-2 ring-emerald-700 ring-offset-4 ring-offset-slate-50" : ""}`}
                    >
                      {selected && (
                        <span
                          className="absolute -top-3 start-4 z-10 rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ backgroundColor: accent, color: readableAccentText(accent) }}
                        >
                          {t.recommended}
                        </span>
                      )}
                      <PlanCard
                        plan={plan}
                        href="#demo"
                        ctaLabel={t.contact}
                        onSelect={() =>
                          chooseDemo({ planId: plan.id, studentCount: count, custom: false })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-7 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 sm:px-6">
              <div className="py-5">
                <h3 className="text-sm font-semibold text-slate-900">{t.included}</h3>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-700">
                  {data.includes.map((item) => (
                    <li key={item.en} className="flex items-center gap-2">
                      <CheckCircle2
                        size={17}
                        className="shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      {item[lang]}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="py-5">
                <h3 className="text-sm font-semibold text-slate-900">{t.excluded}</h3>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-700">
                  {data.excludes.map((item) => (
                    <li key={item.en} className="flex items-center gap-2">
                      <XCircle size={17} className="shrink-0 text-slate-500" aria-hidden="true" />
                      {item[lang]}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-6 text-slate-600">
                  {t.domainPrice(
                    money(data.customDomain.firstYear),
                    money(data.customDomain.renewal),
                  )}
                </p>
              </div>
            </div>
            {/* DECISION: the money-back note covers the first purchase only, excluding renewals. */}
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <ShieldCheck
                size={24}
                className="mt-0.5 shrink-0 text-emerald-800"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-emerald-950">
                  {t.refundTitle(formatNumber(data.refundDays, lang))}
                </h3>
                <p className="mt-2 text-sm leading-6 text-emerald-900">{t.refundBody}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
