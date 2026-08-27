import { useEffect, useRef, useState } from "react";
import { Check, GraduationCap, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import api from "../../services/api";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import Button from "../ui/Button";
import Input from "../ui/Input";
import EmptyState from "../ui/EmptyState";
import { ToggleSwitch } from "../settings/ToggleSwitch";

type ExamItem = { id: string | number; name: string; isActive: boolean };

interface ExamListProps {
  exams: ExamItem[];
  reload: () => void;
}

export default function ExamList({ exams, reload }: ExamListProps) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  // Local, optimistically-reorderable copy of the list, so dragging feels
  // instant instead of waiting on a round-trip to the server on every
  // dragOver. Resynced from props whenever the parent reloads.
  const [items, setItems] = useState<ExamItem[]>(exams);
  const [draggingId, setDraggingId] = useState<string | number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | number | null>(null);
  const savedOrderRef = useRef<string>("");

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(exams);
  }, [exams]);

  const addExam = async () => {
    if (!name.trim()) {
      return useToastStore.getState().show("পরীক্ষার নাম দিন", "error");
    }

    try {
      setAdding(true);
      await api.post("/exams", { name: name.trim() });
      setName("");
      reload();
    } catch (err: any) {
      useToastStore
        .getState()
        .show(err?.response?.data?.message || "পরীক্ষা যোগ করা যায়নি", "error");
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (exam: ExamItem) => {
    const nextActive = !exam.isActive;
    setItems((prev) => prev.map((it) => (it.id === exam.id ? { ...it, isActive: nextActive } : it)));

    try {
      await api.put(`/exams/${exam.id}`, { is_active: nextActive });
    } catch {
      useToastStore.getState().show("পরীক্ষার অবস্থা পরিবর্তন করা যায়নি", "error");
      reload();
    }
  };

  const deleteExam = (id: string | number, examName: string) => {
    useConfirmStore.getState().show({
      title: "পরীক্ষা মুছবেন?",
      message: `"${examName}" পরীক্ষাটি ট্র্যাশে সরাতে চান? পরে প্রয়োজনে ট্র্যাশ থেকে ফিরিয়ে আনা যাবে।`,
      confirmText: "ট্র্যাশে সরান",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/exams/${id}`);
        useToastStore.getState().show("ট্র্যাশে সরানো হয়েছে", "success");
        reload();
      },
    });
  };

  const startEdit = (exam: ExamItem) => {
    setEditingId(exam.id);
    setEditName(exam.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (id: string | number) => {
    if (!editName.trim()) {
      return useToastStore.getState().show("পরীক্ষার নাম দিন", "error");
    }

    try {
      setSaving(true);
      await api.put(`/exams/${id}`, { name: editName.trim() });
      useToastStore.getState().show("পরীক্ষা আপডেট হয়েছে", "success");
      cancelEdit();
      reload();
    } catch (err: any) {
      useToastStore
        .getState()
        .show(err?.response?.data?.message || "পরীক্ষা আপডেট করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  };

  const persistOrder = async (ordered: ExamItem[]) => {
    const snapshot = ordered.map((item) => item.id).join(",");
    if (snapshot === savedOrderRef.current) return;
    savedOrderRef.current = snapshot;

    try {
      await api.put("/exams/reorder", { ids: ordered.map((item) => item.id) });
    } catch {
      useToastStore.getState().show("ক্রম পরিবর্তন করা যায়নি", "error");
      reload();
    }
  };

  const handleDragStart = (id: string | number) => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, overId: string | number) => {
    e.preventDefault();
    if (overId === draggingId) return;
    setDragOverId(overId);

    const fromIndex = items.findIndex((item) => item.id === draggingId);
    const toIndex = items.findIndex((item) => item.id === overId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setItems(next);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
    persistOrder(items);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <GraduationCap className="text-blue-600" size={20} />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">পরীক্ষাসমূহ</h2>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="পরীক্ষার নাম (যেমনঃ প্রথম সাময়িক পরীক্ষা)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button onClick={addExam} disabled={adding} className="shrink-0 gap-1.5">
          <Plus size={16} />
          {adding ? "যোগ হচ্ছে..." : "যোগ করুন"}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title="কোনো পরীক্ষা যোগ করা হয়নি" hint="উপরে থেকে নতুন পরীক্ষা যোগ করুন" />
      ) : (
        <div className="space-y-2">
          {items.length > 1 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">টেনে (drag) ক্রম পরিবর্তন করা যাবে</p>
          )}

          {items.map((e) => {
            const isEditing = editingId === e.id;

            return (
              <div
                key={e.id}
                draggable={!isEditing}
                onDragStart={() => handleDragStart(e.id)}
                onDragOver={(ev) => handleDragOver(ev, e.id)}
                onDrop={(ev) => ev.preventDefault()}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition ${
                  draggingId === e.id
                    ? "border-blue-300 bg-blue-50 opacity-60 dark:border-blue-800 dark:bg-blue-950/40"
                    : dragOverId === e.id
                      ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40"
                      : isEditing
                        ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                }`}
              >
                {isEditing ? (
                  <>
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(ev) => setEditName(ev.target.value)}
                        placeholder="পরীক্ষার নাম"
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => saveEdit(e.id)}
                        disabled={saving}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-green-600 transition hover:bg-green-50 disabled:opacity-50 dark:hover:bg-green-950/40"
                        aria-label="সংরক্ষণ করুন"
                        title="সংরক্ষণ করুন"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
                        aria-label="বাতিল করুন"
                        title="বাতিল করুন"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="cursor-grab text-slate-400 active:cursor-grabbing dark:text-slate-500"
                        title="টেনে সরান"
                      >
                        <GripVertical size={18} />
                      </span>

                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{e.name}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <ToggleSwitch
                        checked={e.isActive}
                        onChange={() => toggleActive(e)}
                        title={e.isActive ? "একটিভ" : "ইনঅ্যাকটিভ"}
                      />
                      <button
                        onClick={() => startEdit(e)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        aria-label="সম্পাদনা করুন"
                        title="সম্পাদনা করুন"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => deleteExam(e.id, e.name)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                        aria-label="মুছে ফেলুন"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
