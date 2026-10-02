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
  // The public site is served only while the institution itself is active
  // (website.service rejects suspended tenants), so the badge shows the
  // effective state rather than the raw website_status setting.
  const renderWebsiteBadge = (m: Madrasa) => {
    const status = m.is_active ? m.website_status || "active" : "disabled";
    const tone =
      status === "disabled"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
        : status === "limited"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
          : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${tone}`}>
        {m.is_active ? t.websiteStatus[status] || status : t.websiteOffSuspended}
      </span>
    );
  };
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

  // `compact` = desktop table cell (small buttons); otherwise = card footer.
  // Both use a 2-col grid with the last button spanning the full row.
  const renderActions = (m: Madrasa, compact = false) => {
    const locked = busyId === m.id || selectionMode;
    const btn = compact ? "w-full whitespace-nowrap px-2.5 py-1.5 text-xs" : "w-full px-3";
    return (
      <div className={`grid grid-cols-2 gap-2 ${compact ? "min-w-[210px]" : ""}`}>
        <Button variant="secondary" onClick={() => onEdit(m)} disabled={locked} className={btn}>
          {c.edit}
        </Button>
        <Button
          variant={m.is_active ? "danger" : "primary"}
          onClick={() => onToggleActive(m)}
          disabled={locked}
          className={btn}
        >
          {busyId === m.id ? "..." : m.is_active ? t.suspend : t.activate}
        </Button>
        <Button variant="danger" onClick={() => onDelete(m)} disabled={locked} className={btn}>
          {t.trash}
        </Button>
        <Button
          variant="danger"
          onClick={() => onClean(m)}
          disabled={locked}
          title={t.cleanDataTitle}
          className={btn}
        >
          {t.cleanData}
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate(`/madrasas/${m.id}/staff`)}
          disabled={locked}
          className={`${btn} col-span-2`}
        >
          {t.staffPermissions}
        </Button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded shadow dark:bg-slate-900">
      {/* Mobile / tablet / small laptop: card grid (hidden on xl+) */}
      <div className="xl:hidden">
        {loading ? (
          <SkeletonList items={4} className="p-4" />
        ) : !items.length ? (
          <div className="p-4 text-gray-500 dark:text-slate-400">{t.noInstitutions}</div>
        ) : (
          <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2">
            {items.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-3 rounded-lg border p-4 dark:border-slate-800 ${
                selectedIds.has(m.id)
                  ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/20"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                    checked={selectedIds.has(m.id)}
                    onChange={() => onToggleOne(m.id)}
                    aria-label={t.selectRow(m.name)}
                  />
                  <div className="min-w-0">
                    <div className="break-words font-semibold text-gray-900 dark:text-slate-100">{m.name}</div>
                    <div className="truncate font-mono text-xs text-gray-500 dark:text-slate-400" title={m.slug}>
                      /{m.slug}
                    </div>
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
                  <div className="mt-0.5">{renderWebsiteBadge(m)}</div>
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

              <div className="mt-auto">{renderActions(m)}</div>
            </div>
            ))}
          </div>
        )}
      </div>

      {/* Wide desktop: table (hidden below xl) */}
      <div className="hidden overflow-x-auto xl:block">
        {loading ? (
          <SkeletonTable rows={6} columns={9} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-slate-800">
              <tr>
                <th className="w-10 p-3 text-center dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label={t.selectAll}
                  />
                </th>
                <th className="p-3 text-center dark:text-slate-200">{t.colName}</th>
                <th className="p-3 text-center dark:text-slate-200">{t.colType}</th>
                <th className="p-3 text-center dark:text-slate-200">{t.colWebsite}</th>
                <th className="p-3 text-center dark:text-slate-200">{t.colPlan}</th>
                <th className="p-3 text-center dark:text-slate-200">{t.colStudentLimit}</th>
                <th className="p-3 text-center dark:text-slate-200">{t.colUserLimit}</th>
                <th className="p-3 text-center dark:text-slate-200">{t.colStatus}</th>
                <th className="p-3 text-center dark:text-slate-200">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t dark:border-slate-800">
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                      checked={selectedIds.has(m.id)}
                      onChange={() => onToggleOne(m.id)}
                      aria-label={t.selectRow(m.name)}
                    />
                  </td>
                  {/* Slug sits under the name (one line, ellipsis + tooltip) instead of
                      its own column, which got squeezed and broke mid-word. */}
                  <td className="p-3 text-start">
                    <div className="min-w-[180px] max-w-[280px]">
                      <div className="break-words font-medium dark:text-slate-100">{m.name}</div>
                      <div className="truncate font-mono text-xs text-gray-500 dark:text-slate-400" title={m.slug}>
                        /{m.slug}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <InstitutionTypeBadge type={m.institution_type} />
                      <LanguageChip lang={m.default_language} />
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {renderWebsiteBadge(m)}
                  </td>
                  <td className="p-3 text-center">{renderPlanControl(m)}</td>
                  <td className="p-3 text-center dark:text-slate-200">{formatNumber(m.student_limit, lang)}</td>
                  <td className="p-3 text-center dark:text-slate-200">{formatNumber(m.user_limit, lang)}</td>
                  <td className="p-3 text-center">
                    {m.is_active ? (
                      <span className="text-green-600 font-semibold dark:text-green-400">{c.active}</span>
                    ) : (
                      <span className="text-red-600 font-semibold dark:text-red-400">{c.inactive}</span>
                    )}
                  </td>
                  <td className="p-3 text-center">{renderActions(m, true)}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td className="p-4 text-gray-500 dark:text-slate-400" colSpan={9}>
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
