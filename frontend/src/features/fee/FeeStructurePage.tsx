import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cachedGet } from "../../services/api";
import { feeStructureApi, invoiceApi, type FeeFrequency, type FeeType } from "../../services/phase2Api";
import { type Session } from "../../services/sessionApi";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string };

type FeeStructureRow = {
  id: number;
  name: string;
  amount: string | number;
  frequency: FeeFrequency;
  feeType?: FeeType;
  academicYear: string;
  sessionId?: number | null;
  isActive: boolean;
  classId?: number | null;
  class?: { nameBn?: string; division?: { nameBn?: string } | null } | null;
};

const FREQUENCY_LABELS: Record<FeeFrequency, string> = {
  ONE_TIME: "একবার",
  MONTHLY: "মাসিক",
  YEARLY: "বাৎসরিক",
};

const FEE_TYPE_LABELS: Record<FeeType, string> = {
  ADMISSION: "ভর্তি ফি",
  TUITION: "মাসিক বেতন",
  EXAM: "পরীক্ষার ফি",
  BOARDING: "বোর্ডিং ফি",
  OTHER: "অন্যান্য",
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyStructureForm = {
  name: "",
  amount: "",
  frequency: "MONTHLY" as FeeFrequency,
  fee_type: "OTHER" as FeeType,
  session_id: "",
};

const FeeStructurePage = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [division, setDivision] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [classLoading, setClassLoading] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);

  const [structures, setStructures] = useState<FeeStructureRow[]>([]);
  const [structureForm, setStructureForm] = useState(emptyStructureForm);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<FeeStructureRow | null>(null);
  const [editForm, setEditForm] = useState(emptyStructureForm);
  const [editSaving, setEditSaving] = useState(false);

  // "সব ইনভয়েস মুছুন" - অপরিবর্তনীয় বলে সাধারণ কনফার্ম ডায়ালগের বদলে টাইপ-করে-
  // নিশ্চিত-করুন মোডাল, যেন ভুলবশত ক্লিক করলেও কিছু মোছা না যায়।
  const [dangerModalOpen, setDangerModalOpen] = useState(false);
  const [dangerConfirmText, setDangerConfirmText] = useState("");
  const [deletingAllInvoices, setDeletingAllInvoices] = useState(false);

  // "বিদ্যমান সব ছাত্রের ফি আবার সেট করুন" - backfillInvoicesForAllStudents
  // idempotent (ইতিমধ্যে বিল হওয়া কিছু আবার তৈরি করে না, unique constraint
  // নিরবে স্কিপ করে দেয়) - তাই ডেঞ্জার জোনের বাইরে সাধারণ অ্যাকশন হিসেবে রাখা।
  const [backfillingAll, setBackfillingAll] = useState(false);
  const handleBackfillAll = () => {
    useConfirmStore.getState().show({
      title: "বিদ্যমান সব ছাত্রের ফি আবার সেট করুন",
      message:
        "প্রতিটি সক্রিয় ছাত্রের জন্য, তার ক্লাস/সেশনের বর্তমান ফি স্ট্রাকচার অনুযায়ী যেসব ইনভয়েস এখনো তৈরি হয়নি সেগুলো তৈরি হবে। আগে থেকে তৈরি থাকা ইনভয়েস আবার ডুপ্লিকেট হবে না। চালাতে চান?",
      confirmText: "চালান",
      onConfirm: async () => {
        try {
          setBackfillingAll(true);
          const res = await invoiceApi.backfill();
          const data = (res.data as any)?.data;
          useToastStore
            .getState()
            .show(
              `${data?.invoicesCreated ?? 0}টি ইনভয়েস তৈরি হয়েছে (${data?.studentsProcessed ?? 0} জন ছাত্রের জন্য)`,
              "success",
            );
        } catch (err: any) {
          const msg = err?.response?.data?.message || "ফি সেট করতে সমস্যা হয়েছে";
          useToastStore.getState().show(msg, "error");
        } finally {
          setBackfillingAll(false);
        }
      },
    });
  };

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD DIVISIONS ERROR:", err);
      setDivisions([]);
    }
  }, []);

  useEffect(() => {
    loadDivisions();
  }, [loadDivisions]);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await cachedGet("/sessions?active_only=true");
        const list = normalizeArray(res) as unknown as Session[];
        setSessions(list);
        const current = list.find((s) => s.isCurrent);
        if (current) {
          setStructureForm((prev) => (prev.session_id ? prev : { ...prev, session_id: String(current.id) }));
        }
      } catch (err) {
        logger.error("LOAD SESSIONS ERROR:", err);
        setSessions([]);
      }
    };
    loadSessions();
  }, []);

  const loadClasses = async (divisionId: string) => {
    setClassId("");
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      setClassLoading(true);
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("CLASS LOAD ERROR:", err);
      setClasses([]);
    } finally {
      setClassLoading(false);
    }
  };

  const loadStructures = useCallback(async () => {
    try {
      const res = await feeStructureApi.list(classId ? { class_id: Number(classId) } : undefined);
      setStructures(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD FEE STRUCTURES ERROR:", err);
      setStructures([]);
    }
  }, [classId]);

  useEffect(() => {
    loadStructures();
  }, [loadStructures]);

  const handleCreateStructure = async () => {
    if (!structureForm.name.trim() || !structureForm.amount || !structureForm.session_id) {
      useToastStore.getState().show("নাম, পরিমাণ ও সেশন দিন", "error");
      return;
    }
    const structureClassId = classId ? Number(classId) : undefined;
    const structureSessionId = Number(structureForm.session_id);
    try {
      setSaving(true);
      await feeStructureApi.create({
        class_id: structureClassId,
        name: structureForm.name.trim(),
        amount: Number(structureForm.amount),
        frequency: structureForm.frequency,
        fee_type: structureForm.fee_type,
        session_id: structureSessionId,
      });
      setStructureForm(emptyStructureForm);
      loadStructures();

      // Immediately bill every already-enrolled student this structure
      // applies to, so nobody has to remember a separate manual step -
      // matches the auto-billing-at-admission behavior new students
      // already get. A billing hiccup here doesn't mean the structure
      // itself failed to save, so it's reported as its own toast.
      try {
        const res = await invoiceApi.backfill({
          class_id: structureClassId,
          session_id: structureSessionId,
        });
        const data = (res.data as any)?.data;
        useToastStore
          .getState()
          .show(
            `ফি কাঠামো তৈরি হয়েছে — ${data?.invoicesCreated ?? 0}টি ইনভয়েস তৈরি হয়েছে (${data?.studentsProcessed ?? 0} জন ছাত্রের জন্য)`,
            "success",
          );
      } catch (err) {
        logger.error("AUTO BACKFILL ERROR:", err);
        useToastStore
          .getState()
          .show("ফি কাঠামো তৈরি হয়েছে, তবে বিদ্যমান ছাত্রদের ইনভয়েস তৈরিতে সমস্যা হয়েছে", "error");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "ফি কাঠামো তৈরি করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (structure: FeeStructureRow) => {
    setEditTarget(structure);
    setEditForm({
      name: structure.name,
      amount: String(structure.amount),
      frequency: structure.frequency,
      fee_type: structure.feeType || "OTHER",
      session_id: structure.sessionId ? String(structure.sessionId) : "",
    });
  };

  const handleUpdateStructure = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim() || !editForm.amount || !editForm.session_id) {
      useToastStore.getState().show("নাম, পরিমাণ ও সেশন দিন", "error");
      return;
    }
    try {
      setEditSaving(true);
      await feeStructureApi.update(editTarget.id, {
        name: editForm.name.trim(),
        amount: Number(editForm.amount),
        frequency: editForm.frequency,
        fee_type: editForm.fee_type,
        session_id: Number(editForm.session_id),
      });
      useToastStore.getState().show("ফি কাঠামো আপডেট হয়েছে", "success");
      setEditTarget(null);
      loadStructures();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "ফি কাঠামো আপডেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteStructure = async (id: number) => {
    try {
      await feeStructureApi.remove(id);
      useToastStore.getState().show("ফি কাঠামো মুছে ফেলা হয়েছে", "success");
      setStructures((prev) => prev.filter((row) => row.id !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  const closeDangerModal = () => {
    setDangerModalOpen(false);
    setDangerConfirmText("");
  };

  const handleDeleteAllInvoices = async () => {
    if (dangerConfirmText !== "DELETE") return;
    try {
      setDeletingAllInvoices(true);
      const res = await invoiceApi.deleteAll(dangerConfirmText);
      const data = (res.data as any)?.data;
      useToastStore.getState().show(`${data?.deleted ?? 0} টি ইনভয়েস মুছে ফেলা হয়েছে`, "success");
      closeDangerModal();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setDeletingAllInvoices(false);
    }
  };

  // Grouped division → class so a long flat list (one row per fee, per
  // class, across every division) reads as sections instead — "সাধারণ" (no
  // class, applies to every class) always pinned first as its own section,
  // then each division's classes alphabetical inside that division.
  const groupedStructures = useMemo(() => {
    type ClassGroup = { key: string; label: string; items: FeeStructureRow[] };
    type DivisionGroup = { key: string; label: string; classGroups: ClassGroup[] };

    const genericItems = structures.filter((r) => !r.classId);
    const divisionMap = new Map<string, { label: string; classMap: Map<string, ClassGroup> }>();

    for (const row of structures) {
      if (!row.classId) continue;
      const divisionLabel = row.class?.division?.nameBn || "অন্যান্য";
      if (!divisionMap.has(divisionLabel)) {
        divisionMap.set(divisionLabel, { label: divisionLabel, classMap: new Map() });
      }
      const division = divisionMap.get(divisionLabel)!;
      const classKey = String(row.classId);
      const classLabel = row.class?.nameBn || `শ্রেণি #${row.classId}`;
      if (!division.classMap.has(classKey)) {
        division.classMap.set(classKey, { key: classKey, label: classLabel, items: [] });
      }
      division.classMap.get(classKey)!.items.push(row);
    }

    const divisionGroups: DivisionGroup[] = Array.from(divisionMap.entries())
      .map(([key, v]) => ({
        key,
        label: v.label,
        classGroups: Array.from(v.classMap.values()).sort((a, b) => a.label.localeCompare(b.label, "bn")),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "bn"));

    const result: DivisionGroup[] = [];
    if (genericItems.length) {
      result.push({
        key: "generic",
        label: "সাধারণ (সব শ্রেণির জন্য)",
        classGroups: [{ key: "generic-items", label: "সাধারণ", items: genericItems }],
      });
    }
    return [...result, ...divisionGroups];
  }, [structures]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">ফি সেটাপ</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              ফি কাঠামো তৈরি করুন — নতুন ভর্তি হওয়া ছাত্রদের ইনভয়েস অটোমেটিক তৈরি হয়ে যায়
            </p>
          </div>
          <button
            type="button"
            disabled={backfillingAll}
            onClick={handleBackfillAll}
            title="প্রতিটি সক্রিয় ছাত্রের জন্য বর্তমান ফি স্ট্রাকচার অনুযায়ী বাকি থাকা ইনভয়েস তৈরি করুন"
            className="h-9 shrink-0 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {backfillingAll ? "চলছে..." : "বিদ্যমান সব ছাত্রের ফি আবার সেট করুন"}
          </button>
        </div>

        {/* Division/Class picker */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={division}
              onChange={(event) => {
                const value = event.target.value;
                setDivision(value);
                loadClasses(value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">বিভাগ (ফিল্টার)</option>
              {divisions.map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={!division || classLoading}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 sm:w-[180px]"
            >
              <option value="">{classLoading ? "লোড হচ্ছে..." : "শ্রেণি (ফিল্টার)"}</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
            নতুন ফি কাঠামো তৈরি করুন {classId ? "(নির্বাচিত শ্রেণির জন্য)" : "(সব শ্রেণির জন্য)"}
          </h2>
          <p className="mb-3 -mt-1 text-xs text-gray-500 dark:text-slate-400">
            তৈরি করার সাথে সাথেই যোগ্য বিদ্যমান ছাত্রদের জন্য অটোমেটিক ইনভয়েস তৈরি হয়ে যাবে।
          </p>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="text"
              placeholder="নাম (যেমন: মাসিক বেতন)"
              value={structureForm.name}
              onChange={(e) => setStructureForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[200px]"
            />
            <input
              type="number"
              placeholder="পরিমাণ (৳)"
              value={structureForm.amount}
              onChange={(e) => setStructureForm((p) => ({ ...p, amount: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[130px]"
            />
            <select
              value={structureForm.frequency}
              onChange={(e) =>
                setStructureForm((p) => ({ ...p, frequency: e.target.value as FeeFrequency }))
              }
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[130px]"
            >
              {(Object.keys(FREQUENCY_LABELS) as FeeFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
            <select
              value={structureForm.fee_type}
              onChange={(e) => setStructureForm((p) => ({ ...p, fee_type: e.target.value as FeeType }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[140px]"
            >
              {(Object.keys(FEE_TYPE_LABELS) as FeeType[]).map((t) => (
                <option key={t} value={t}>
                  {FEE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              value={structureForm.session_id}
              onChange={(e) => setStructureForm((p) => ({ ...p, session_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[140px]"
            >
              <option value="">সেশন</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isCurrent ? " (চলমান)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving}
              onClick={handleCreateStructure}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              {saving ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {structures.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">কোনো ফি কাঠামো নেই</div>
          ) : (
            <div className="space-y-5">
              {groupedStructures.map((division) => (
                <div key={division.key}>
                  {division.key !== "generic" && (
                    <h3 className="mb-2 text-sm font-bold text-gray-700 dark:text-slate-300">{division.label}</h3>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {division.classGroups.map((group) => (
                      <div key={group.key} className="rounded-xl border border-gray-200 p-3 dark:border-slate-700">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 className="truncate text-sm font-semibold text-gray-800 dark:text-slate-200">{group.label}</h4>
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                            {group.items.length}টি
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {group.items.map((row) => (
                            <div
                              key={row.id}
                              className="flex items-center gap-1 rounded-lg border border-gray-100 px-2.5 py-2 text-sm transition hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-800"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-gray-800 dark:text-slate-200">
                                  {row.name} <span className="font-normal text-gray-500 dark:text-slate-400">৳{row.amount}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {row.feeType && row.feeType !== "OTHER" && (
                                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                                      {FEE_TYPE_LABELS[row.feeType]}
                                    </span>
                                  )}
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                                    {FREQUENCY_LABELS[row.frequency]}
                                  </span>
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                                    {row.academicYear}
                                  </span>
                                  {!row.isActive && (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                                      নিষ্ক্রিয়
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  title="এডিট"
                                  onClick={() => openEditModal(row)}
                                  className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  title="মুছুন"
                                  onClick={() => handleDeleteStructure(row.id)}
                                  className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* বিপজ্জনক অ্যাকশন - শুধু টেস্ট/ডেমো ডেটা পরিষ্কার করার জন্য */}
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
          <h2 className="text-sm font-bold text-rose-700 dark:text-rose-400">বিপজ্জনক এলাকা</h2>
          <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">
            এই ট্যানেন্টের সব ইনভয়েস (ও তার সব পেমেন্ট) স্থায়ীভাবে মুছে ফেলুন। শুধু টেস্ট/ডেমো ডেটা
            পরিষ্কার করার জন্য ব্যবহার করুন — এই কাজ আর ফিরিয়ে নেওয়া যাবে না।
          </p>
          <button
            type="button"
            onClick={() => setDangerModalOpen(true)}
            className="mt-3 h-9 rounded-md border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            সব ইনভয়েস মুছুন
          </button>
        </div>
      </div>

      {/* সব ইনভয়েস মুছে ফেলার নিশ্চিতকরণ - সাধারণ কনফার্ম ডায়ালগ নয়, কারণ এটা
          অপরিবর্তনীয় ও পুরো ট্যানেন্টের সব ইনভয়েস প্রভাবিত করে। */}
      <Modal open={dangerModalOpen} title="সব ইনভয়েস মুছে ফেলুন" onClose={closeDangerModal}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-700 dark:text-slate-300">
            এই ট্যানেন্টের <strong>সব ইনভয়েস ও পেমেন্ট স্থায়ীভাবে মুছে যাবে</strong> — এই কাজ আর ফিরিয়ে
            নেওয়া যাবে না। নিশ্চিত হলে নিচের বক্সে <strong>DELETE</strong> লিখুন।
          </p>
          <input
            type="text"
            value={dangerConfirmText}
            onChange={(e) => setDangerConfirmText(e.target.value)}
            placeholder="DELETE লিখুন"
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-base outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDangerModal}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={dangerConfirmText !== "DELETE" || deletingAllInvoices}
            onClick={handleDeleteAllInvoices}
            className="h-9 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {deletingAllInvoices ? "মুছে ফেলা হচ্ছে..." : "স্থায়ীভাবে মুছুন"}
          </button>
        </div>
      </Modal>

      {/* Edit fee structure modal */}
      <Modal
        open={!!editTarget}
        title={`ফি কাঠামো এডিট করুন — ${editTarget?.name || ""}`}
        onClose={() => setEditTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">নাম</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পরিমাণ (৳)</label>
            <input
              type="number"
              value={editForm.amount}
              onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">ফ্রিকোয়েন্সি</label>
            <select
              value={editForm.frequency}
              onChange={(e) => setEditForm((p) => ({ ...p, frequency: e.target.value as FeeFrequency }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {(Object.keys(FREQUENCY_LABELS) as FeeFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">ফি ধরণ</label>
            <select
              value={editForm.fee_type}
              onChange={(e) => setEditForm((p) => ({ ...p, fee_type: e.target.value as FeeType }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {(Object.keys(FEE_TYPE_LABELS) as FeeType[]).map((t) => (
                <option key={t} value={t}>
                  {FEE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">সেশন</label>
            <select
              value={editForm.session_id}
              onChange={(e) => setEditForm((p) => ({ ...p, session_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">সেশন নির্বাচন করুন</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isCurrent ? " (চলমান)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={editSaving}
            onClick={handleUpdateStructure}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {editSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default FeeStructurePage;
