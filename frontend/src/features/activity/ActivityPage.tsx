import { useEffect, useState } from "react";
import api from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import TableSkeleton from "../../components/ui/TableSkeleton";

export default function ActivityPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/activity");
      setRows(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Activity Logs" subtitle="Audit trail (latest 200)" />
      {loading ? (
        <TableSkeleton rows={10} />
      ) : (
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.action}</td>
                  <td className="px-4 py-3">{r.entity}</td>
                  <td className="px-4 py-3">{r.details}</td>
                  <td className="px-4 py-3">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
