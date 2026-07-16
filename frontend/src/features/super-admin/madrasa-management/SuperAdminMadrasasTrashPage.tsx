import { useEffect, useState } from "react";
import adminApi from "../../../services/adminApi";
import Button from "../../../components/ui/Button";
import DeleteConfirmModal from "../../../components/super-admin/DeleteConfirmModal";
import { useToastStore } from "../../../store/toastStore";

export default function SuperAdminMadrasasTrashPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const toast = useToastStore();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminApi.get("/super/madrasas/trash");

      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);

      setItems(rows);
    } finally {
      setLoading(false);
    }
  };

  const restore = async (id: number) => {
    try {
      const res = await adminApi.post(`/super/madrasas/${id}/restore`);
      toast.push("success", res.data?.message || "Restored successfully");
      await load();
    } catch (err: any) {
      toast.push("error", err?.response?.data?.message || "Restore failed");
    }
  };

  // 🔥 Open delete modal + fetch stats
  const openDeleteModal = async (m: any) => {
    try {
      const res = await adminApi.get(`/super/madrasas/${m.id}/delete-stats`);
      setStats(res.data);
      setSelected(m);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to load delete stats");
    }
  };

  const confirmPermanentDelete = async () => {
    if (!selected) return;

    try {
      await adminApi.delete(`/super/madrasas/${selected.id}/permanent`);
      setSelected(null);
      setStats(null);
      load();
    } catch (err: any) {
      // Don't silently close the modal on failure — the row must stay in
      // trash so the admin knows the slug is NOT actually free yet.
      alert(err?.response?.data?.message || "Permanent delete failed. Slug is still in use.");
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-bold mb-4">Trash</h2>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !items.length ? (
        <p className="text-gray-500">Trash is empty</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Slug</th>
              <th className="text-left p-2">Deleted At</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{m.name}</td>
                <td className="p-2">{m.slug}</td>
                <td className="p-2 text-gray-500">
                  {m.deleted_at ? new Date(m.deleted_at).toLocaleString() : "-"}
                </td>
                <td className="p-2">
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => restore(m.id)}>Restore</Button>

                    <Button variant="danger" onClick={() => openDeleteModal(m)}>
                      Delete Permanently
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* 🔥 Double Confirm Modal */}
      {selected && stats && (
        <DeleteConfirmModal
          stats={stats}
          onClose={() => {
            setSelected(null);
            setStats(null);
          }}
          onConfirm={confirmPermanentDelete}
        />
      )}
    </div>
  );
}
