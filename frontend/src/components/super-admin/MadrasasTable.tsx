import Button from "../../components/ui/Button";
import { SkeletonList, SkeletonTable } from "../ui/Skeleton";
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
  onCloudinary,
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
  onCloudinary: (m: Madrasa) => void;
  selectedIds: Set<number>;
  onToggleOne: (id: number) => void;
  onToggleAll: () => void;
}) {
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
          Select plan
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
          Edit
        </Button>
        <Button
          variant={m.is_active ? "danger" : "primary"}
          onClick={() => onToggleActive(m)}
          disabled={locked}
          className="flex-1 sm:flex-none"
        >
          {busyId === m.id ? "..." : m.is_active ? "Suspend" : "Activate"}
        </Button>
        <Button
          variant="danger"
          onClick={() => onDelete(m)}
          disabled={locked}
          className="flex-1 sm:flex-none"
        >
          Trash
        </Button>
        <Button
          variant="secondary"
          onClick={() => onCloudinary(m)}
          disabled={locked}
          className="flex-1 sm:flex-none"
        >
          Cloudinary
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
          <div className="p-4 text-gray-500 dark:text-slate-400">No madrasas found.</div>
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
                    aria-label={`Select ${m.name}`}
                  />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-slate-100">{m.name}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{m.slug}</div>
                  </div>
                </div>

                {m.is_active ? (
                  <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">
                    Active
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                    Inactive
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Website</div>
                  <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold capitalize text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                    {m.website_status || "active"}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Student Limit</div>
                  <div className="dark:text-slate-200">{m.student_limit}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 dark:text-slate-400">Plan</div>
                  {renderPlanControl(m)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">User Limit</div>
                  <div className="dark:text-slate-200">{m.user_limit}</div>
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
          <SkeletonTable rows={6} columns={9} />
        ) : (
          <table className="min-w-[1150px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-slate-800">
              <tr>
                <th className="w-10 p-3 text-left dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="p-3 text-left dark:text-slate-200">Name</th>
                <th className="p-3 text-left dark:text-slate-200">Slug</th>
                <th className="p-3 text-left dark:text-slate-200">Website</th>
                <th className="p-3 text-left dark:text-slate-200">Plan</th>
                <th className="p-3 text-left dark:text-slate-200">Student Limit</th>
                <th className="p-3 text-left dark:text-slate-200">User Limit</th>
                <th className="p-3 text-left dark:text-slate-200">Status</th>
                <th className="p-3 text-left dark:text-slate-200">Actions</th>
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
                      aria-label={`Select ${m.name}`}
                    />
                  </td>
                  <td className="p-3 font-medium dark:text-slate-100">{m.name}</td>
                  <td className="p-3 text-gray-700 dark:text-slate-300">{m.slug}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold capitalize text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                      {m.website_status || "active"}
                    </span>
                  </td>
                  <td className="p-3">{renderPlanControl(m)}</td>
                  <td className="p-3 dark:text-slate-200">{m.student_limit}</td>
                  <td className="p-3 dark:text-slate-200">{m.user_limit}</td>
                  <td className="p-3">
                    {m.is_active ? (
                      <span className="text-green-600 font-semibold dark:text-green-400">Active</span>
                    ) : (
                      <span className="text-red-600 font-semibold dark:text-red-400">Inactive</span>
                    )}
                  </td>
                  <td className="p-3">{renderActions(m)}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td className="p-4 text-gray-500 dark:text-slate-400" colSpan={9}>
                    No madrasas found.
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
