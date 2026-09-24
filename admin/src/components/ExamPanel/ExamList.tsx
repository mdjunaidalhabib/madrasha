import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  GraduationCap,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import api from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import Badge from "@madrasha/shared-ui/src/components/ui/Badge";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { ToggleSwitch } from "../settings/ToggleSwitch";
import DivisionScopePicker from "./DivisionScopePicker";
import { examCoversDivision, type ExamDivisionRef } from "./examDivisionScope";

type ExamItem = {
  id: string | number;
  name: string;
  isActive: boolean;
  examType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  /** Whether a পরীক্ষার ফি FeeStructure is linked to this exam - see
   * backend ExamRepository.findExams. Drives the "পরীক্ষা বন্ধ করলে ফি-ও বন্ধ হবে" confirmation
   * when switching the exam off. */
  has_fee_link?: boolean;
  /** বিভাগভিত্তিক scope - empty = সকল বিভাগ. */
  division_ids?: number[];
  divisions?: ExamDivisionRef[];
};

interface ExamListProps {
  exams: ExamItem[];
  reload: () => void;
  /** This madrasa's active divisions (GET /madrasa-divisions). */
  divisions?: ExamDivisionRef[];
  /** True while the parent's initial (or a full re-) fetch of the exam list
   * is in flight. Only used to render skeleton rows before the first list
   * ever arrives - once `exams` has data, a later reload() no longer blanks
   * the list, so this is intentionally ignored past first load. */
  loading?: boolean;
}

// শুধু YYYY-MM-DD অংশটুকু <input type="date"> এ বসাতে হয় - সার্ভার থেকে
// পুরো ISO datetime (টাইমজোন সহ) আসতে পারে।
const toDateInputValue = (v?: string | null) => (v ? String(v).slice(0, 10) : "");

const formatDateBn = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" });
};

export default function ExamList({
  exams,
  reload,
  divisions = [],
  loading = false,
}: ExamListProps) {
  const [name, setName] = useState("");
  const [divisionIds, setDivisionIds] = useState<number[]>([]);
  /** List filter: "" = সব পরীক্ষা, otherwise a division id. */
  const [filterDivision, setFilterDivision] = useState("");
  const [examType, setExamType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [showAddDetails, setShowAddDetails] = useState(false);
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
  const [editExamType, setEditExamType] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDivisionIds, setEditDivisionIds] = useState<number[]>([]);
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
      await api.post("/exams", {
        name: name.trim(),
        exam_type: examType.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        description: description.trim() || undefined,
        division_ids: divisionIds,
      });
      setName("");
      setDivisionIds([]);
      setExamType("");
      setStartDate("");
      setEndDate("");
      setDescription("");
      setShowAddDetails(false);
      reload();
    } catch (err: any) {
      useToastStore
        .getState()
        .show(err?.response?.data?.message || "পরীক্ষা যোগ করা যায়নি", "error");
    } finally {
      setAdding(false);
    }
  };

  // তা'লীমাত only switches the exam. Its পরীক্ষার ফি is ইহতেমাম's own switch
  // (ফি সেটাপ → পরীক্ষার ফি): switching the exam off stops that fee too,
  // switching it back on leaves the fee off until ইহতেমাম turns it on.
  const setExamActive = async (exam: ExamItem, nextActive: boolean) => {
    setItems((prev) =>
      prev.map((it) => (it.id === exam.id ? { ...it, isActive: nextActive } : it)),
    );

    try {
      await api.put(`/exams/${exam.id}`, { is_active: nextActive });
      if (nextActive && exam.has_fee_link) {
        useToastStore
          .getState()
          .show(
            `"${exam.name}" চালু হয়েছে — এর ফি ইহতেমাম (ফি সেটাপ) থেকে চালু করতে হবে`,
            "success",
          );
      }
    } catch {
      useToastStore.getState().show("পরীক্ষার অবস্থা পরিবর্তন করা যায়নি", "error");
      reload();
    }
  };

  const toggleActive = (exam: ExamItem) => {
    if (exam.isActive && exam.has_fee_link) {
      useConfirmStore.getState().show({
        title: "পরীক্ষা বন্ধ করবেন?",
        message: `"${exam.name}" পরীক্ষাটি বন্ধ হলে এর ফি-ও স্বয়ংক্রিয়ভাবে বন্ধ হবে এবং অপরিশোধিত ইনভয়েসগুলো বাতিল হবে। পরে পরীক্ষা চালু করলে ফি আবার ইহতেমাম থেকে চালু করতে হবে।`,
        confirmText: "বন্ধ করুন",
        danger: true,
        onConfirm: () => setExamActive(exam, false),
      });
      return;
    }
    return setExamActive(exam, !exam.isActive);
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
    setEditExamType(exam.examType || "");
    setEditStartDate(toDateInputValue(exam.startDate));
    setEditEndDate(toDateInputValue(exam.endDate));
    setEditDescription(exam.description || "");
    setEditDivisionIds(exam.division_ids ?? []);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditExamType("");
    setEditStartDate("");
    setEditEndDate("");
    setEditDescription("");
    setEditDivisionIds([]);
  };

  const saveEdit = async (id: string | number) => {
    if (!editName.trim()) {
      return useToastStore.getState().show("পরীক্ষার নাম দিন", "error");
    }

    try {
      setSaving(true);
      await api.put(`/exams/${id}`, {
        name: editName.trim(),
        exam_type: editExamType.trim() || undefined,
        start_date: editStartDate || undefined,
        end_date: editEndDate || undefined,
        description: editDescription.trim() || undefined,
        division_ids: editDivisionIds,
      });
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

  // Reordering a filtered subset would renumber only part of the list, so
  // drag-to-reorder is available on the unfiltered view only.
  const visibleItems = filterDivision
    ? items.filter((it) => examCoversDivision(it, filterDivision))
    : items;
  const canReorder = !filterDivision && items.length > 1;
  const filterOptions = [
    { id: "", label: "সব" },
    ...divisions.map((d) => ({ id: String(d.division_id), label: d.division_name_bn || "" })),
  ];

  const dateInputClass =
    "h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <GraduationCap className="text-blue-600" size={20} />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">পরীক্ষাসমূহ</h2>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="পরীক্ষার নাম (যেমনঃ প্রথম সাময়িক পরীক্ষা)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !adding) addExam();
            }}
          />
          <Button onClick={addExam} disabled={adding} className="shrink-0 gap-1.5">
            <Plus size={16} />
            {adding ? "যোগ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>

        {divisions.length > 0 && (
          <DivisionScopePicker
            divisions={divisions}
            value={divisionIds}
            onChange={setDivisionIds}
            disabled={adding}
          />
        )}

        <button
          type="button"
          onClick={() => setShowAddDetails((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {showAddDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showAddDetails ? "বিস্তারিত লুকান" : "বিস্তারিত যোগ করুন (ধরন, তারিখ, বিবরণ)"}
        </button>

        {showAddDetails && (
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-800/60">
            <Input
              placeholder="পরীক্ষার ধরন (যেমনঃ বার্ষিক)"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={dateInputClass}
                title="শুরুর তারিখ"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={dateInputClass}
                title="শেষের তারিখ"
              />
            </div>
            <textarea
              placeholder="বিবরণ (ঐচ্ছিক)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:col-span-2"
            />
          </div>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="কোনো পরীক্ষা যোগ করা হয়নি" hint="উপরে থেকে নতুন পরীক্ষা যোগ করুন" />
      ) : (
        <div className="space-y-2">
          {divisions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <span className="mr-1 text-xs text-slate-500 dark:text-slate-400">
                বিভাগ অনুযায়ী দেখুন:
              </span>
              {filterOptions.map((opt) => {
                const on = filterDivision === opt.id;
                const count = opt.id
                  ? items.filter((it) => examCoversDivision(it, opt.id)).length
                  : items.length;
                return (
                  <button
                    key={opt.id || "all"}
                    type="button"
                    onClick={() => setFilterDivision(opt.id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      on
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {opt.label}
                    <span className={on ? "opacity-70" : "text-slate-400"}>
                      ({count.toLocaleString("bn-BD")})
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {canReorder && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              টেনে (drag) ক্রম পরিবর্তন করা যাবে
            </p>
          )}

          {visibleItems.length === 0 && (
            <EmptyState
              title="এই বিভাগের কোনো পরীক্ষা নেই"
              hint="উপরে বিভাগ নির্বাচন করে নতুন পরীক্ষা যোগ করুন"
            />
          )}

          {visibleItems.map((e) => {
            const isEditing = editingId === e.id;
            const scopedDivisions = e.divisions ?? [];

            return (
              <div
                key={e.id}
                draggable={canReorder && !isEditing}
                onDragStart={() => handleDragStart(e.id)}
                onDragOver={(ev) => handleDragOver(ev, e.id)}
                onDrop={(ev) => ev.preventDefault()}
                onDragEnd={handleDragEnd}
                className={`flex flex-col gap-3 rounded-xl border px-3 py-2.5 transition ${
                  draggingId === e.id
                    ? "border-blue-300 bg-blue-50 opacity-60 dark:border-blue-800 dark:bg-blue-950/40"
                    : dragOverId === e.id
                      ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40"
                      : isEditing
                        ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
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
                        {canReorder && (
                          <span
                            className="cursor-grab text-slate-400 active:cursor-grabbing dark:text-slate-500"
                            title="টেনে সরান"
                          >
                            <GripVertical size={18} />
                          </span>
                        )}

                        {/* ক্রমিক নম্বর = the exam's madrasa-wide serial (position in
                            the full sortOrder list), so it stays the same under a
                            division filter. */}
                        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 px-1 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {(items.indexOf(e) + 1).toLocaleString("bn-BD")}
                        </span>

                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {e.name}
                          </p>
                          {divisions.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {scopedDivisions.length === 0 ? (
                                <Badge tone="slate">সকল বিভাগ</Badge>
                              ) : (
                                scopedDivisions.map((d) => (
                                  <Badge key={d.division_id} tone="blue">
                                    {d.division_name_bn}
                                  </Badge>
                                ))
                              )}
                            </div>
                          )}
                          {(e.examType || e.startDate || e.endDate || e.description) && (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {[
                                e.examType,
                                e.startDate || e.endDate
                                  ? `${formatDateBn(e.startDate)}${e.endDate ? ` – ${formatDateBn(e.endDate)}` : ""}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                              {e.description ? (
                                <span className="block truncate">{e.description}</span>
                              ) : null}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <Badge tone={e.isActive ? "green" : "slate"}>
                          {e.isActive ? "সক্রিয়" : "নিষ্ক্রিয়"}
                        </Badge>
                        <ToggleSwitch
                          checked={e.isActive}
                          onChange={() => toggleActive(e)}
                          title={e.isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
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

                {isEditing && divisions.length > 0 && (
                  <DivisionScopePicker
                    divisions={divisions}
                    value={editDivisionIds}
                    onChange={setEditDivisionIds}
                    disabled={saving}
                  />
                )}

                {isEditing && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="পরীক্ষার ধরন (যেমনঃ বার্ষিক)"
                      value={editExamType}
                      onChange={(ev) => setEditExamType(ev.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(ev) => setEditStartDate(ev.target.value)}
                        className={dateInputClass}
                        title="শুরুর তারিখ"
                      />
                      <input
                        type="date"
                        value={editEndDate}
                        onChange={(ev) => setEditEndDate(ev.target.value)}
                        className={dateInputClass}
                        title="শেষের তারিখ"
                      />
                    </div>
                    <textarea
                      placeholder="বিবরণ (ঐচ্ছিক)"
                      value={editDescription}
                      onChange={(ev) => setEditDescription(ev.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:col-span-2"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
