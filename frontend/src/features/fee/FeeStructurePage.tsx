import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Receipt, Trash2, Users } from "lucide-react";
import { cachedGet } from "../../services/api";
import { feeStructureApi, invoiceApi, type FeeFrequency } from "../../services/phase2Api";
import { type Session } from "../../services/sessionApi";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string };

type FeeStructureRow = {
  id: number;
  name: string;
  amount: string | number;
  frequency: FeeFrequency;
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

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyStructureForm = { name: "", amount: "", frequency: "MONTHLY" as FeeFrequency, session_id: "" };
const emptyGenerateForm = { due_date: "", month: "" };

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

  const [generateTarget, setGenerateTarget] = useState<FeeStructureRow | null>(null);
  const [generateForm, setGenerateForm] = useState(emptyGenerateForm);
  const [generating, setGenerating] = useState(false);

  const [editTarget, setEditTarget] = useState<FeeStructureRow | null>(null);
  const [editForm, setEditForm] = useState(emptyStructureForm);
  const [editSaving, setEditSaving] = useState(false);

  const [backfilling, setBackfilling] = useState(false);

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
    try {
      setSaving(true);
      await feeStructureApi.create({
        class_id: classId ? Number(classId) : undefined,
        name: structureForm.name.trim(),
        amount: Number(structureForm.amount),
        frequency: structureForm.frequency,
        session_id: Number(structureForm.session_id),
      });
      useToastStore.getState().show("ফি কাঠামো তৈরি হয়েছে", "success");
      setStructureForm(emptyStructureForm);
      loadStructures();
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

  const openGenerateModal = (structure: FeeStructureRow) => {
    setGenerateTarget(structure);
    setGenerateForm(emptyGenerateForm);
  };

  const handleGenerate = async () => {
    if (!generateTarget || !generateForm.due_date) {
      useToastStore.getState().show("ডিউ তারিখ দিন", "error");
      return;
    }
    if (generateTarget.frequency === "MONTHLY" && !generateForm.month) {
      useToastStore.getState().show("মাসিক ফির জন্য মাস (YYYY-MM) দিন", "error");
      return;
    }

    try {
      setGenerating(true);
      const res = await invoiceApi.generate({
        fee_structure_id: generateTarget.id,
        due_date: generateForm.due_date,
        month: generateForm.month || undefined,
        class_id: classId ? Number(classId) : undefined,
      });
      const data = (res.data as any)?.data;
      useToastStore
        .getState()
        .show(
          `ইনভয়েস তৈরি হয়েছে: ${data?.created ?? 0} জনের (আগে থেকে বিল করা ছিল: ${data?.skipped ?? 0} জন)`,
          "success",
        );
      setGenerateTarget(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "ইনভয়েস তৈরি করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setGenerating(false);
    }
  };

  // Bills every currently-enrolled student (not just newly admitted ones)
  // against whatever active fee structures apply to them - for
  // installations/classes that already had students before auto-billing-at
  // -admission existed.
  const handleBackfill = async () => {
    const scopeLabel = classId
      ? classes.find((c) => String(c.class_id) === classId)?.class_name_bn || "নির্বাচিত শ্রেণি"
      : "সব শ্রেণির";
    if (
      !window.confirm(
        `${scopeLabel} সব বিদ্যমান ছাত্রের জন্য বকেয়া ফি ইনভয়েস তৈরি করা হবে (যাদের এখনো নেই)। এগিয়ে যাবেন?`,
      )
    ) {
      return;
    }

    try {
      setBackfilling(true);
      const res = await invoiceApi.backfill(classId ? { class_id: Number(classId) } : undefined);
      const data = (res.data as any)?.data;
      useToastStore
        .getState()
        .show(
          `${data?.studentsProcessed ?? 0} জন ছাত্রের জন্য ${data?.invoicesCreated ?? 0}টি নতুন ইনভয়েস তৈরি হয়েছে`,
          "success",
        );
    } catch (err: any) {
      const msg = err?.response?.data?.message || "ফি সেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setBackfilling(false);
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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">ফি সেটাপ</h1>
            <p className="mt-1 text-sm text-gray-500">
              ফি কাঠামো তৈরি করুন এবং ইনভয়েস জেনারেট করুন
            </p>
          </div>
          <button
            type="button"
            disabled={backfilling}
            onClick={handleBackfill}
            className="flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:text-sm"
          >
            <Users size={14} />
            {backfilling ? "সেট হচ্ছে..." : "বিদ্যমান সব ছাত্রের ফি সেট করুন"}
          </button>
        </div>

        {/* Division/Class picker */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={division}
              onChange={(event) => {
                const value = event.target.value;
                setDivision(value);
                loadClasses(value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[160px]"
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
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 sm:w-[180px]"
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

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            নতুন ফি কাঠামো তৈরি করুন {classId ? "(নির্বাচিত শ্রেণির জন্য)" : "(সব শ্রেণির জন্য)"}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="text"
              placeholder="নাম (যেমন: মাসিক বেতন)"
              value={structureForm.name}
              onChange={(e) => setStructureForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[200px]"
            />
            <input
              type="number"
              placeholder="পরিমাণ (৳)"
              value={structureForm.amount}
              onChange={(e) => setStructureForm((p) => ({ ...p, amount: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[130px]"
            />
            <select
              value={structureForm.frequency}
              onChange={(e) =>
                setStructureForm((p) => ({ ...p, frequency: e.target.value as FeeFrequency }))
              }
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[130px]"
            >
              {(Object.keys(FREQUENCY_LABELS) as FeeFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
            <select
              value={structureForm.session_id}
              onChange={(e) => setStructureForm((p) => ({ ...p, session_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[140px]"
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
              তৈরি করুন
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
          {structures.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">কোনো ফি কাঠামো নেই</div>
          ) : (
            <div className="space-y-5">
              {groupedStructures.map((division) => (
                <div key={division.key}>
                  {division.key !== "generic" && (
                    <h3 className="mb-2 text-sm font-bold text-gray-700">{division.label}</h3>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {division.classGroups.map((group) => (
                      <div key={group.key} className="rounded-xl border border-gray-200 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 className="truncate text-sm font-semibold text-gray-800">{group.label}</h4>
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                            {group.items.length}টি
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {group.items.map((row) => (
                            <div
                              key={row.id}
                              className="flex items-center gap-1 rounded-lg border border-gray-100 px-2.5 py-2 text-sm transition hover:border-blue-200"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-gray-800">
                                  {row.name} <span className="font-normal text-gray-500">৳{row.amount}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                                    {FREQUENCY_LABELS[row.frequency]}
                                  </span>
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                                    {row.academicYear}
                                  </span>
                                  {!row.isActive && (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                      নিষ্ক্রিয়
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  title="ইনভয়েস জেনারেট করুন"
                                  onClick={() => openGenerateModal(row)}
                                  className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                                >
                                  <Receipt size={14} />
                                </button>
                                <button
                                  type="button"
                                  title="এডিট"
                                  onClick={() => openEditModal(row)}
                                  className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  title="মুছুন"
                                  onClick={() => handleDeleteStructure(row.id)}
                                  className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
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
      </div>

      {/* Edit fee structure modal */}
      <Modal
        open={!!editTarget}
        title={`ফি কাঠামো এডিট করুন — ${editTarget?.name || ""}`}
        onClose={() => setEditTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">নাম</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">পরিমাণ (৳)</label>
            <input
              type="number"
              value={editForm.amount}
              onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">ফ্রিকোয়েন্সি</label>
            <select
              value={editForm.frequency}
              onChange={(e) => setEditForm((p) => ({ ...p, frequency: e.target.value as FeeFrequency }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            >
              {(Object.keys(FREQUENCY_LABELS) as FeeFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">সেশন</label>
            <select
              value={editForm.session_id}
              onChange={(e) => setEditForm((p) => ({ ...p, session_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
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
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
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

      {/* Generate invoices modal */}
      <Modal
        open={!!generateTarget}
        title={`ইনভয়েস জেনারেট করুন — ${generateTarget?.name || ""}`}
        onClose={() => setGenerateTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">ডিউ তারিখ</label>
            <input
              type="date"
              value={generateForm.due_date}
              onChange={(e) => setGenerateForm((p) => ({ ...p, due_date: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>
          {generateTarget?.frequency === "MONTHLY" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                মাস (YYYY-MM)
              </label>
              <input
                type="month"
                value={generateForm.month}
                onChange={(e) => setGenerateForm((p) => ({ ...p, month: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
              />
            </div>
          )}
          {!classId && (
            <p className="text-xs text-amber-600">
              কোনো শ্রেণি ফিল্টার নির্বাচন করা নেই — ফি কাঠামোর সাথে যুক্ত শ্রেণির সব ছাত্রের জন্য
              ইনভয়েস তৈরি হবে।
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setGenerateTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerate}
            className="h-9 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {generating ? "তৈরি হচ্ছে..." : "জেনারেট করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default FeeStructurePage;
