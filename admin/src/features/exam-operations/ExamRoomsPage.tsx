import { useCallback, useEffect, useState } from "react";
import { examRoomApi, ExamRoomRow } from "../../services/examOperationsApi";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { commonText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { examOpsText } from "./examOperations.text";

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyForm = { name: "", code: "", capacity: "", floor: "", location: "", notes: "" };

const ExamRoomsPage = () => {
  const t = useText(examOpsText);
  const c = useText(commonText);
  const lang = useLang();
  const [rooms, setRooms] = useState<ExamRoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await examRoomApi.list();
      setRooms(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD EXAM ROOMS ERROR:", err);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const startEdit = (room: ExamRoomRow) => {
    setEditingId(room.id);
    setForm({
      name: room.name,
      code: room.code,
      capacity: String(room.capacity ?? ""),
      floor: room.floor || "",
      location: room.location || "",
      notes: room.notes || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      useToastStore.getState().show(t.roomNameCodeRequired, "error");
      return;
    }
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      capacity: form.capacity ? Number(form.capacity) : 0,
      floor: form.floor.trim() || undefined,
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      setSaving(true);
      if (editingId) {
        await examRoomApi.update(editingId, payload);
        useToastStore.getState().show(t.roomUpdated, "success");
      } else {
        await examRoomApi.create(payload);
        useToastStore.getState().show(t.roomAdded, "success");
      }
      cancelEdit();
      loadRooms();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.saveFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (room: ExamRoomRow) => {
    try {
      await examRoomApi.update(room.id, { is_active: !room.isActive });
      loadRooms();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.updateFailed;
      useToastStore.getState().show(msg, "error");
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await examRoomApi.deactivate(id);
      useToastStore.getState().show(t.roomDeactivated, "success");
      loadRooms();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.deleteFailed;
      useToastStore.getState().show(msg, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">{t.roomsTitle}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t.roomsSubtitle}</p>
        </div>

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
            {editingId ? t.editRoom : t.newRoom}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="text"
              placeholder={t.roomName}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            />
            <input
              type="text"
              placeholder={t.code}
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[110px]"
            />
            <input
              type="number"
              min={0}
              placeholder={t.capacity}
              value={form.capacity}
              onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[120px]"
            />
            <input
              type="text"
              placeholder={t.floorOptional}
              value={form.floor}
              onChange={(e) => setForm((p) => ({ ...p, floor: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[110px]"
            />
            <input
              type="text"
              placeholder={t.locationOptional}
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[150px]"
            />
            <input
              type="text"
              placeholder={t.noteOptional}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            />

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              {editingId ? c.update : c.add}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="h-9 w-full rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-600 dark:border-slate-700 dark:text-slate-300 sm:w-auto"
              >
                {c.cancel}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loading ? (
            <SkeletonList items={6} />
          ) : rooms.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">{t.noRooms}</div>
          ) : (
            <div className="flex flex-col gap-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex flex-col gap-1 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"
                >
                  <div className="text-sm">
                    <span className="font-semibold text-gray-800 dark:text-slate-100">{room.name}</span>{" "}
                    <span className="text-gray-500 dark:text-slate-400">({room.code})</span>{" "}
                    <span className="text-gray-600 dark:text-slate-400">{t.capacityN(localizeDigits(room.capacity, lang))}</span>
                    {room.floor && <span className="text-gray-500 dark:text-slate-400"> · {room.floor}</span>}
                    {!room.isActive && <span className="ms-2 text-xs text-red-600 dark:text-red-400">{t.inactiveParen}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(room)}
                      className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      {t.editShort}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(room)}
                      className="h-8 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400"
                    >
                      {room.isActive ? t.deactivate : t.activate}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeactivate(room.id)}
                      className="h-8 rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                    >
                      {c.delete}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamRoomsPage;
