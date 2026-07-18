import Button from "../../components/ui/Button";
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
}: {
  loading: boolean;
  items: Madrasa[];
  plans: Plan[];
  busyId: number | null;
  onPlanChange: (m: Madrasa, planId: number) => Promise<void>;
  onToggleActive: (m: Madrasa) => Promise<void>;
  onDelete: (m: Madrasa) => void;
  onEdit: (m: Madrasa) => void;
}) {
  const renderPlanControl = (m: Madrasa) =>
    plans.length ? (
      <select
        className="w-full rounded border bg-white px-2 py-1.5 text-sm sm:w-auto"
        value={String(m.plan_id ?? "")}
        disabled={busyId === m.id}
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

  const renderActions = (m: Madrasa) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => onEdit(m)}
        disabled={busyId === m.id}
        className="flex-1 sm:flex-none"
      >
        Edit
      </Button>
      <Button
        variant={m.is_active ? "danger" : "primary"}
        onClick={() => onToggleActive(m)}
        disabled={busyId === m.id}
        className="flex-1 sm:flex-none"
      >
        {busyId === m.id ? "..." : m.is_active ? "Suspend" : "Activate"}
      </Button>
      <Button
        variant="danger"
        onClick={() => onDelete(m)}
        disabled={busyId === m.id}
        className="flex-1 sm:flex-none"
      >
        Trash
      </Button>
    </div>
  );

  return (
    <div className="bg-white rounded shadow">
      {/* Mobile / tablet: card list (hidden on md+) */}
      <div className="divide-y md:hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : !items.length ? (
          <div className="p-4 text-gray-500">No madrasas found.</div>
        ) : (
          items.map((m) => (
            <div key={m.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.slug}</div>
                </div>

                {m.is_active ? (
                  <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                    Active
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                    Inactive
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Website</div>
                  <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold capitalize text-blue-700">
                    {m.website_status || "active"}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Student Limit</div>
                  <div>{m.student_limit}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500">Plan</div>
                  {renderPlanControl(m)}
                </div>
                <div>
                  <div className="text-xs text-gray-500">User Limit</div>
                  <div>{m.user_limit}</div>
                </div>
              </div>

              {renderActions(m)}
            </div>
          ))
        )}
      </div>

      {/* Desktop: table (hidden below md) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1150px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Slug</th>
              <th className="p-3 text-left">Website</th>
              <th className="p-3 text-left">Plan</th>
              <th className="p-3 text-left">Student Limit</th>
              <th className="p-3 text-left">User Limit</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-gray-500" colSpan={8}>
                  Loading...
                </td>
              </tr>
            ) : (
              <>
                {items.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-3 font-medium">{m.name}</td>
                    <td className="p-3 text-gray-700">{m.slug}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold capitalize text-blue-700">
                        {m.website_status || "active"}
                      </span>
                    </td>
                    <td className="p-3">{renderPlanControl(m)}</td>
                    <td className="p-3">{m.student_limit}</td>
                    <td className="p-3">{m.user_limit}</td>
                    <td className="p-3">
                      {m.is_active ? (
                        <span className="text-green-600 font-semibold">Active</span>
                      ) : (
                        <span className="text-red-600 font-semibold">Inactive</span>
                      )}
                    </td>
                    <td className="p-3">{renderActions(m)}</td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td className="p-4 text-gray-500" colSpan={8}>
                      No madrasas found.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
