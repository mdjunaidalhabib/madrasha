import { useNavigate } from "react-router-dom";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { SkeletonList, SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { commonText, formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { superAdminText } from "./superAdmin.text";
import InstitutionTypeBadge, { LanguageChip } from "./InstitutionTypeBadge";
import {
  Madrasa,
  Plan,
} from "../../features/super-admin/madrasa-management/SuperAdminMadrasasPage";

export default function MadrasasTable({
  loading,
  items,
  plans,
  busyId,
  onPlanChange,
  onToggleActive,
  onDelete,
  onEdit,
  onClean,
  selectedIds,
  onToggleOne,
  onToggleAll,
}: {
  loading: boolean;
  items: Madrasa[];
  plans: Plan[];
  busyId: number | null;
  onPlanChange: (m: Madrasa, planId: number) => Promise<void>;
  onToggleActive: (m: Madrasa) => Promise<void>;
  onDelete: (m: Madrasa) => void;
  onEdit: (m: Madrasa) => void;
  onClean: (m: Madrasa) => void;
  selectedIds: Set<number>;
  onToggleOne: (id: number) => void;
  onToggleAll: () => void;
}) {
  const navigate = useNavigate();
  const t = useText(superAdminText);
  const c = useText(commonText);
  const lang = useLang();
  const websiteLabel = (status?: string) => t.websiteStatus[status || "active"] || status || "active";
  const allSelected = items.length > 0 && items.every((m) => selectedIds.has(m.id));
  // While a bulk selection is active, single-row actions don't make sense
  // alongside it — lock them so the row's only usable control is its checkbox.
  const selectionMode = selectedIds.size > 0;

  const renderPlanControl = (m: Madrasa) =>
    plans.length ? (
      <select
        className="w-full rounded border bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
        value={String(m.plan_id ?? "")}
        disabled={busyId === m.id || selectionMode}
        onChange={(e) => onPlanChange(m, Number(e.target.value))}
      >
        <option value="" disabled>
          {t.selectPlan}
        </option>
        {plans.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {p.name}
          </option>
        ))}
      </select>
    ) : (
      <span>{m.plan_name || "-"}</span>
    );

  const renderActions = (m: Madrasa) => {
    const locked = busyId === m.id || selectionMode;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => onEdit(m)}
          disabled={locked}
          className="flex-1 sm:flex-none"
        >
          {c.edit}
        </Button>
        <Button
          variant={m.is_active ? "danger" : "primary"}
          onClick={() => onToggleActive(m)}
          disabled={locked}
          className="flex-1 sm:flex-none"
        >
          {busyId === m.id ? "..." : m.is_active ? t.suspend : t.activate}
        </Button>
        <Button
          variant="danger"
          onClick={() => onDelete(m)}
          disabled={locked}
          className="flex-1 sm:flex-none"
        >
          {t.trash}
        </Button>
        <Button
          variant="danger"
          onClick={() => onClean(m)}
          disabled={locked}
          title={t.cleanDataTitle}
          className="flex-1 sm:flex-none"
        >
          {t.cleanData}
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate(`/madrasas/${m.id}/staff`)}
          disabled={locked}
          className="flex-1 sm:flex-none"
        >
          {t.staffPermissions}
        </Button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded shadow dark:bg-slate-900">
      {/* Mobile / tablet: card list (hidden on md+) */}
      <div className="divide-y dark:divide-slate-800 md:hidden">
        {loading ? (
          <SkeletonList items={4} className="p-4" />
        ) : !items.length ? (
          <div className="p-4 text-gray-500 dark:text-slate-400">{t.noInstitutions}</div>
        ) : (
          items.map((m) => (
            <div key={m.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                    checked={selectedIds.has(m.id)}
                    onChange={() => onToggleOne(m.id)}
                    aria-label={t.selectRow(m.name)}
                  />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-slate-100">{m.name}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{m.slug}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <InstitutionTypeBadge type={m.institution_type} />
                      <LanguageChip lang={m.default_language} />
                    </div>
                  </div>
                </div>

                {m.is_active ? (
                  <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">
                    {c.active}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                    {c.inactive}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.colWebsite}</div>
                  <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold capitalize text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                    {websiteLabel(m.website_status)}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.colStudentLimit}</div>
                  <div className="dark:text-slate-200">{formatNumber(m.student_limit, lang)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.colPlan}</div>
                  {renderPlanControl(m)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.colUserLimit}</div>
                  <div className="dark:text-slate-200">{formatNumber(m.user_limit, lang)}</div>
                </div>
              </div>

              {renderActions(m)}
            </div>
          ))
        )}
      </div>

      {/* Desktop: table (hidden below md) */}
      <div className="hidden overflow-x-auto md:block">
        {loading ? (
          <SkeletonTable rows={6} columns={10} />
        ) : (
          <table className="min-w-[1250px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-slate-800">
              <tr>
                <th className="w-10 p-3 text-start dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label={t.selectAll}
                  />
                </th>
                <th className="p-3 text-start dark:text-slate-200">{t.colName}</th>
                <th className="p-3 text-start dark:text-slate-200">{t.colSlug}</th>
                <th className="p-3 text-start dark:text-slate-200">{t.colType}</th>
                <th className="p-3 text-start dark:text-slate-200">{t.colWebsite}</th>
                <th className="p-3 text-start dark:text-slate-200">{t.colPlan}</th>
                <th className="p-3 text-start dark:text-slate-200">{t.colStudentLimit}</th>
                <th className="p-3 text-start dark:text-slate-200">{t.colUserLimit}</th>
                <th className="p-3 text-start dark:text-slate-200">{t.colStatus}</th>
                <th className="p-3 text-start dark:text-slate-200">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t dark:border-slate-800">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                      checked={selectedIds.has(m.id)}
                      onChange={() => onToggleOne(m.id)}
                      aria-label={t.selectRow(m.name)}
                    />
                  </td>
                  <td className="p-3 font-medium dark:text-slate-100">{m.name}</td>
                  <td className="p-3 text-gray-700 dark:text-slate-300">{m.slug}</td>
                  <td className="p-3">
                    <div className="flex flex-col items-start gap-1">
                      <InstitutionTypeBadge type={m.institution_type} />
                      <LanguageChip lang={m.default_language} />
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold capitalize text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                      {websiteLabel(m.website_status)}
                    </span>
                  </td>
                  <td className="p-3">{renderPlanControl(m)}</td>
                  <td className="p-3 dark:text-slate-200">{formatNumber(m.student_limit, lang)}</td>
                  <td className="p-3 dark:text-slate-200">{formatNumber(m.user_limit, lang)}</td>
                  <td className="p-3">
                    {m.is_active ? (
                      <span className="text-green-600 font-semibold dark:text-green-400">{c.active}</span>
                    ) : (
                      <span className="text-red-600 font-semibold dark:text-red-400">{c.inactive}</span>
                    )}
                  </td>
                  <td className="p-3">{renderActions(m)}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td className="p-4 text-gray-500 dark:text-slate-400" colSpan={10}>
                    {t.noInstitutions}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
