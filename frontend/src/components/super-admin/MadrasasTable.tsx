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
  onDelete: (m: Madrasa) => Promise<void>;
  onEdit: (m: Madrasa) => void;
}) {
  return (
    <div className="bg-white rounded shadow overflow-x-auto">
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
                  <td className="p-3">
                    {plans.length ? (
                      <select
                        className="border rounded px-2 py-1 bg-white"
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
                    )}
                  </td>
                  <td className="p-3">{m.student_limit}</td>
                  <td className="p-3">{m.user_limit}</td>
                  <td className="p-3">
                    {m.is_active ? (
                      <span className="text-green-600 font-semibold">Active</span>
                    ) : (
                      <span className="text-red-600 font-semibold">Inactive</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => onEdit(m)}
                        disabled={busyId === m.id}
                      >
                        Edit
                      </Button>
                      <Button
                        variant={m.is_active ? "danger" : "primary"}
                        onClick={() => onToggleActive(m)}
                        disabled={busyId === m.id}
                      >
                        {busyId === m.id ? "..." : m.is_active ? "Suspend" : "Activate"}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => onDelete(m)}
                        disabled={busyId === m.id}
                      >
                        Trash
                      </Button>
                    </div>
                  </td>
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
  );
}
