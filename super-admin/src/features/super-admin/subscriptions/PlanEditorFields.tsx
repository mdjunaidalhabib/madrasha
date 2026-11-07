import { formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { planAccent } from "@madrasha/shared-ui/src/components/plans/plan-colors";
import type {
  AdminPlan,
  PlanDisplayFields,
} from "../../../services/subscriptionApi";
import { planToolsText } from "./plan-tools.text";

export type PlanDisplayDraft = {
  nameBn: string;
  tagline: string;
  taglineBn: string;
  accentColor: string;
  renewalPrice: number | null;
  extraStudentPriceFirst: number | null;
  extraStudentPriceRenewal: number | null;
  sortOrder: number;
  showOnLanding: 0 | 1;
  isFeatured: 0 | 1;
};
export function displayDraft(plan?: Partial<AdminPlan>): PlanDisplayDraft {
  return {
    nameBn: plan?.nameBn ?? "",
    tagline: plan?.tagline ?? "",
    taglineBn: plan?.taglineBn ?? "",
    accentColor: plan?.accentColor ?? "",
    renewalPrice: plan?.renewalPrice == null ? null : Number(plan.renewalPrice),
    extraStudentPriceFirst:
      plan?.extraStudentPriceFirst == null
        ? null
        : Number(plan.extraStudentPriceFirst),
    extraStudentPriceRenewal:
      plan?.extraStudentPriceRenewal == null
        ? null
        : Number(plan.extraStudentPriceRenewal),
    sortOrder: plan?.sortOrder ?? 0,
    showOnLanding: plan?.showOnLanding === 0 ? 0 : 1,
    isFeatured: plan?.isFeatured ? 1 : 0,
  };
}
export function displayPayload(draft: PlanDisplayDraft): PlanDisplayFields {
  return {
    ...draft,
    nameBn: draft.nameBn.trim() || null,
    tagline: draft.tagline.trim() || null,
    taglineBn: draft.taglineBn.trim() || null,
    accentColor: draft.accentColor.trim() || null,
  };
}

export default function PlanEditorFields({
  value,
  onChange,
  orderCount,
}: {
  value: PlanDisplayDraft;
  orderCount: number;
  onChange: (patch: Partial<PlanDisplayDraft>) => void;
}) {
  const t = useText(planToolsText);
  const lang = useLang();
  const input =
    "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
  const numberFields = [
    ["renewalPrice", t.renewalPrice],
    ["extraStudentPriceFirst", t.extraFirst],
    ["extraStudentPriceRenewal", t.extraRenewal],
  ] as const;
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        {t.unlimited}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["nameBn", t.nameBn],
            ["tagline", t.tagline],
            ["taglineBn", t.taglineBn],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="text-xs text-slate-600 dark:text-slate-300"
          >
            {label}
            <input
              className={input}
              value={value[key]}
              onChange={(e) => onChange({ [key]: e.target.value })}
            />
          </label>
        ))}
        {numberFields.map(([key, label]) => (
          <label
            key={key}
            className="text-xs text-slate-600 dark:text-slate-300"
          >
            {label}
            <input
              className={input}
              type="number"
              min={0}
              max={99999999}
              step="0.01"
              value={value[key] ?? ""}
              onChange={(e) =>
                onChange({
                  [key]: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        ))}
        <label className="text-xs text-slate-600 dark:text-slate-300">
          {t.order}
          <select
            className={input}
            value={
              value.sortOrder > 0 && value.sortOrder <= orderCount
                ? value.sortOrder
                : 0
            }
            onChange={(e) => onChange({ sortOrder: Number(e.target.value) })}
          >
            <option value={0}>{t.autoOrder}</option>
            {Array.from({ length: orderCount }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {formatNumber(i + 1, lang)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs">{t.orderHint}</span>
        </label>
        <label className="text-xs text-slate-600 dark:text-slate-300">
          {t.color}
          <div className="flex items-center gap-2">
            <input
              aria-label={t.color}
              type="color"
              value={planAccent(value.accentColor, value.sortOrder)}
              onChange={(e) => onChange({ accentColor: e.target.value })}
              className="mt-1 h-10 w-12 rounded border bg-transparent"
            />
            <input
              aria-label={`${t.color} (HEX)`}
              className={input}
              placeholder="#047857"
              value={value.accentColor}
              onChange={(e) => onChange({ accentColor: e.target.value })}
            />
          </div>
          <span className="mt-1 block text-xs">{t.colorHint}</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-200">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value.showOnLanding}
            onChange={(e) =>
              onChange({ showOnLanding: e.target.checked ? 1 : 0 })
            }
          />
          {t.landing}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value.isFeatured}
            onChange={(e) => onChange({ isFeatured: e.target.checked ? 1 : 0 })}
          />
          {t.featured}
        </label>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t.cacheHint}
      </p>
    </div>
  );
}

export function PlanVisibilityControls({
  plan,
  busy,
  onChange,
  orderCount,
}: {
  plan: AdminPlan;
  orderCount: number;
  busy: boolean;
  onChange: (patch: Partial<PlanDisplayFields>) => void;
}) {
  const t = useText(planToolsText);
  const lang = useLang();
  return (
    <fieldset
      disabled={busy}
      className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-60"
    >
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={plan.showOnLanding !== 0}
          onChange={(e) =>
            onChange({ showOnLanding: e.target.checked ? 1 : 0 })
          }
        />
        {t.landing}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!plan.isFeatured}
          onChange={(e) => onChange({ isFeatured: e.target.checked ? 1 : 0 })}
        />
        {t.featured}
      </label>
      <label className="flex items-center gap-2">
        {t.order}
        <select
          aria-label={`${plan.name} ${t.order}`}
          value={
            plan.sortOrder && plan.sortOrder <= orderCount ? plan.sortOrder : 0
          }
          className="min-w-20 rounded-lg border bg-white px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
          onChange={(e) => {
            const value = Number(e.target.value);
            if (value !== plan.sortOrder) onChange({ sortOrder: value });
          }}
        >
          <option value={0} disabled>
            {t.autoOrder}
          </option>
          {Array.from({ length: orderCount }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {formatNumber(i + 1, lang)}
            </option>
          ))}
        </select>
      </label>
      <p className="leading-5 text-slate-400">{t.orderHint}</p>
    </fieldset>
  );
}
