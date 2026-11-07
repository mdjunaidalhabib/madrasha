import { useId } from "react";
import { formatNumber, LOCALE_MAP, useLang, useText } from "../../i18n";
import { planCardText } from "./plan-card.text";
import { planAccent, readableAccentText } from "./plan-colors";

export interface PlanCardData {
  name: string;
  nameBn?: string | null;
  tagline?: string | null;
  taglineBn?: string | null;
  studentLimit: number;
  price: number | string | null;
  renewalPrice?: number | string | null;
  sortOrder?: number;
  accentColor?: string | null;
  isFeatured?: number | boolean;
}

export interface PlanCardProps {
  plan: PlanCardData;
  onSelect?: () => void;
  href?: string;
  ctaLabel?: string;
  preview?: boolean;
  loading?: boolean;
}

/** Shared landing, owner-preview and tenant-plan card. Inherits the app's Kalpurush font. */
export default function PlanCard({
  plan,
  onSelect,
  href,
  ctaLabel,
  preview = false,
  loading = false,
}: PlanCardProps) {
  const t = useText(planCardText);
  const lang = useLang();
  const headingId = useId();
  const accent = planAccent(plan.accentColor, plan.sortOrder);
  const text = readableAccentText(accent);
  const tier = Math.min(9, Math.max(1, Math.floor(plan.sortOrder ?? 1)));
  const money = (value: number | string) =>
    `৳${Number(value).toLocaleString(LOCALE_MAP[lang], { maximumFractionDigits: 2 })}`;
  const name = lang === "bn" ? plan.nameBn || plan.name : plan.name;
  const tagline =
    lang === "bn"
      ? plan.taglineBn || plan.tagline
      : plan.tagline || plan.taglineBn;
  const ctaClass =
    "block w-full rounded-xl border px-4 py-3 text-center text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2 disabled:cursor-default motion-safe:transition-colors motion-safe:duration-150";
  const ctaStyle = plan.isFeatured
    ? { backgroundColor: accent, borderColor: accent, color: text }
    : { borderColor: accent };

  if (loading)
    return (
      <div className="relative" aria-label={t.loading} aria-busy="true">
        <div className="invisible" aria-hidden="true">
          <PlanCard plan={plan} preview />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse rounded-2xl border bg-slate-100 motion-reduce:animate-none dark:border-slate-700 dark:bg-slate-800"
        />
      </div>
    );

  return (
    <article
      aria-labelledby={headingId}
      className={`relative isolate flex min-h-[560px] flex-col overflow-hidden rounded-2xl border bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100 motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-1 ${plan.isFeatured ? "border-2 shadow-lg md:scale-[1.02]" : "border-slate-200 dark:border-slate-700"}`}
      style={plan.isFeatured ? { borderColor: accent } : undefined}
    >
      <div className="h-1.5 shrink-0" style={{ backgroundColor: accent }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(150deg, ${accent}20, transparent 55%)`,
        }}
      />
      <div className="relative flex flex-1 flex-col p-6">
        <div className="mb-3 h-6">
          {!!plan.isFeatured && (
            <span
              className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: accent, color: text }}
            >
              {t.featured}
            </span>
          )}
        </div>
        <h3
          id={headingId}
          className="relative z-10 pe-12 text-xl font-semibold"
        >
          {name}
        </h3>
        <p
          className="min-h-5 text-xs text-slate-600 dark:text-slate-300"
          lang="en"
        >
          {lang === "bn" ? plan.name : plan.nameBn}
        </p>
        <p className="mt-2 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-300">
          {tagline}
        </p>
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-14 h-24 w-24 opacity-20"
          style={{ color: accent }}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M61 17a31 31 0 1 0 22 49A29 29 0 0 1 61 17Z" />
          {Array.from({ length: Math.floor(tier / 3) }, (_, i) => (
            <circle
              key={`ring-${i}`}
              cx="50"
              cy="50"
              r={38 + i * 4}
              opacity={0.7 - i * 0.15}
            />
          ))}
          {Array.from({ length: tier }, (_, i) => {
            const angle = ((-70 + (i * 300) / tier) * Math.PI) / 180;
            return (
              <path
                key={`star-${i}`}
                transform={`translate(${50 + 42 * Math.cos(angle)} ${50 + 42 * Math.sin(angle)}) scale(.4)`}
                d="M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2Z"
              />
            );
          })}
        </svg>
        <div className="relative mt-5">
          <div className="text-6xl font-semibold tracking-tight tabular-nums">
            {formatNumber(plan.studentLimit, lang)}
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t.students}
          </p>
        </div>
        <div className="mt-6 min-h-28">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t.firstYear}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {plan.price == null ? t.unavailable : money(plan.price)}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
              {t.renewal}
            </span>
            <span className="tabular-nums">
              {plan.renewalPrice == null ? "—" : money(plan.renewalPrice)}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {t.annually}
            </span>
          </p>
          <p className="mt-2 min-h-5 text-xs text-slate-600 dark:text-slate-300">
            {plan.price != null && plan.studentLimit > 0
              ? t.perStudent(money(Number(plan.price) / plan.studentLimit))
              : ""}
          </p>
        </div>
        <ul className="my-5 space-y-2 border-t border-slate-200 pt-5 text-sm dark:border-slate-700">
          {t.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2">
              <span aria-hidden="true" className="font-semibold">
                ✓
              </span>
              {highlight}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-2">
          {href && !preview ? (
            <a href={href} className={ctaClass} style={ctaStyle}>
              {ctaLabel || t.choose}
            </a>
          ) : (
            <button
              type="button"
              disabled={preview || !onSelect}
              onClick={onSelect}
              className={ctaClass}
              style={ctaStyle}
            >
              {ctaLabel || t.choose}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
