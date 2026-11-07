import {
  CalendarDays,
  ChevronDown,
  GraduationCap,
  Hash,
  Layers3,
  Pencil,
  Power,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
  Globe2,
  ShieldCheck,
} from "lucide-react";
import {
  formatDateTime,
  formatNumber,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { planAccent } from "@madrasha/shared-ui/src/components/plans/plan-colors";
import type {
  AdminPlan,
  PlanDisplayFields,
} from "../../../services/subscriptionApi";
import type { CatalogDivisionDto } from "../../../services/superAdminCatalogApi";
import { PlanVisibilityControls } from "./PlanEditorFields";
import { plansText } from "./plans.text";
import { planToolsText } from "./plan-tools.text";

export default function PlanManagementCard({
  plan,
  divisions,
  trash,
  busy,
  orderCount,
  onEdit,
  onToggle,
  onTrash,
  onRestore,
  onPermanent,
  onDisplay,
}: {
  plan: AdminPlan & { deletedAt?: string | null };
  divisions: CatalogDivisionDto[];
  trash: boolean;
  busy: boolean;
  orderCount: number;
  onEdit: () => void;
  onToggle: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onPermanent: () => void;
  onDisplay: (patch: Partial<PlanDisplayFields>) => void;
}) {
  const t = useText(plansText);
  const pt = useText(planToolsText);
  const lang = useLang();
  const n = (value: number) => formatNumber(value, lang);
  const money = (value: number | string | null | undefined) =>
    value == null ? pt.customPrice : `৳${formatNumber(Number(value), lang)}`;
  const accent = planAccent(plan.accentColor, plan.sortOrder);
  const name = lang === "bn" ? plan.nameBn || plan.name : plan.name;
  const tagline =
    lang === "bn"
      ? plan.taglineBn || plan.tagline
      : plan.tagline || plan.taglineBn;
  const sizes = new Map(
    (plan.regBlocks || []).map((b) => [b.divisionId, b.blockSize]),
  );
  const blockRows = [...sizes].map(([id, size]) => ({
    id,
    size,
    label:
      divisions.find((d) => d.id === id)?.label ||
      divisions.find((d) => d.id === id)?.name ||
      `#${n(id)}`,
  }));
  const button =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700";
  return (
    <article
      data-plan-id={plan.id}
      aria-label={name}
      data-inactive={!plan.isActive || undefined}
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md ${plan.isActive ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" : "border-slate-400 bg-slate-200 dark:border-slate-500 dark:bg-slate-800"}`}
    >
      <div
        className="h-1.5"
        style={{ backgroundColor: plan.isActive ? accent : "#64748b" }}
      />
      <div className="flex-1 space-y-5 p-5 sm:p-6">
        <header>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
              <Hash size={12} aria-hidden="true" />
              {n(plan.id)}
            </span>
            <div className="flex flex-wrap gap-2">
              {!!plan.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  <Sparkles size={12} aria-hidden="true" />
                  {t.featuredLabel}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${plan.isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-slate-600 text-white dark:bg-slate-500"}`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${plan.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
                />
                {plan.isActive ? t.active : t.inactive}
              </span>
            </div>
          </div>
          <h2 className="break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {name}
          </h2>
          {plan.nameBn && plan.nameBn !== plan.name && (
            <p className="mt-0.5 text-xs text-slate-400">
              {lang === "bn" ? plan.name : plan.nameBn}
            </p>
          )}
          <p className="mt-2 min-h-6 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {tagline || t.planSummary(n(plan.studentLimit))}
          </p>
        </header>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {pt.firstCycle}
            </p>
            <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {money(plan.price)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {t.firstPriceHint}
            </p>
          </div>
          <div
            className="min-w-0 rounded-xl border p-3.5 dark:border-slate-700"
            style={{ borderTopColor: accent, borderTopWidth: 2 }}
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {pt.renewalCycle}
            </p>
            <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {money(plan.renewalPrice ?? plan.price)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {t.renewalPriceHint}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
          {[
            {
              icon: GraduationCap,
              label: t.students,
              value: n(plan.studentLimit),
            },
            { icon: Users, label: t.users, value: t.unlimitedLabel },
            { icon: CalendarDays, label: t.days, value: n(plan.durationDays) },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="min-w-0 px-2 text-center first:ps-0 last:pe-0"
            >
              <dt className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <Icon size={13} aria-hidden="true" />
                {label}
              </dt>
              <dd className="mt-1.5 break-words text-sm font-bold text-slate-800 dark:text-slate-100">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <ShieldCheck size={15} className="shrink-0" aria-hidden="true" />
          {pt.unlimited}
        </p>
        <section className="rounded-xl border border-dashed border-slate-200 p-3.5 dark:border-slate-700">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t.extraRates}
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-400">{pt.firstCycle}</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                {plan.extraStudentPriceFirst == null
                  ? t.notSet
                  : money(plan.extraStudentPriceFirst)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">{pt.renewalCycle}</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                {plan.extraStudentPriceRenewal == null
                  ? t.notSet
                  : money(plan.extraStudentPriceRenewal)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">{t.extraRateHint}</p>
        </section>
        <details className="group rounded-xl border border-slate-200 dark:border-slate-700">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-3.5 text-xs font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
            <Layers3
              size={15}
              className="shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <span className="flex-1">{t.regBlockPerClass}</span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-500 dark:bg-slate-800">
              {n(blockRows.length)}
            </span>
            <ChevronDown
              size={14}
              className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <dl className="space-y-2 border-t border-slate-100 p-3.5 dark:border-slate-800">
            {blockRows.length ? (
              blockRows.map((block) => (
                <div
                  key={block.id}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <dt className="min-w-0 break-words leading-5 text-slate-500 dark:text-slate-400">
                    {block.label}
                  </dt>
                  <dd className="shrink-0 rounded-md bg-slate-50 px-2 py-0.5 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    {n(block.size)}
                  </dd>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">{t.notSet}</p>
            )}
          </dl>
        </details>
        {trash ? (
          <p className="text-xs text-slate-400">
            {t.deleted}:{" "}
            {plan.deletedAt ? formatDateTime(plan.deletedAt, lang) : t.notSet}
          </p>
        ) : (
          <section className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/50">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Globe2 size={14} className="text-slate-400" aria-hidden="true" />
              {t.displaySettings}
            </h3>
            <PlanVisibilityControls
              orderCount={orderCount}
              plan={plan}
              busy={busy}
              onChange={onDisplay}
            />
          </section>
        )}
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/20">
        {trash ? (
          <>
            <button
              type="button"
              className={`${button} flex-1 bg-white text-emerald-700 hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-400`}
              onClick={onRestore}
            >
              <RotateCcw size={15} aria-hidden="true" />
              {t.restore}
            </button>
            <button
              type="button"
              className={`${button} border-rose-200 text-rose-600 hover:bg-rose-50 dark:text-rose-400`}
              onClick={onPermanent}
            >
              <Trash2 size={15} aria-hidden="true" />
              {t.permanent}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              title={t.edit}
              onClick={onEdit}
              className={`${button} flex-1 border-indigo-600 bg-indigo-600 text-white hover:border-indigo-700 hover:bg-indigo-700 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600`}
            >
              <Pencil size={14} aria-hidden="true" />
              {t.edit}
            </button>
            <button
              type="button"
              title={t.toggle}
              onClick={onToggle}
              className={`${button} bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800`}
            >
              <Power size={15} aria-hidden="true" />
              {plan.isActive ? t.deactivate : t.activate}
            </button>
            <button
              type="button"
              title={t.moveToTrash}
              aria-label={t.moveToTrash}
              onClick={onTrash}
              className={`${button} text-rose-500 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30`}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
