import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { cachedGet } from "../../services/api";
import {
  feeStructureApi,
  feeCategoryApi,
  invoiceApi,
  type FeeFrequency,
  type FeeType,
  type FeeLinkableExam,
  type FeeCategoryItem,
} from "../../services/phase2Api";
import { type Session } from "../../services/sessionApi";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { Skeleton, SkeletonText } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { normalizeBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";

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
  examId?: number | null;
  exam?: { id: number; name: string; year: string } | null;
};

const FREQUENCY_LABELS: Record<FeeFrequency, string> = {
  ONE_TIME: "একবার",
  MONTHLY: "মাসিক",
  YEARLY: "বাৎসরিক",
};

// Matches backend EXAM_FEE_CATEGORY_NAME (fee.constants.ts) - পরীক্ষার ফি is
// billed only once explicitly activated (see FeeStructure.examId), so
// exam_id must be picked for this category instead of staying optional.
const EXAM_FEE_TYPE_NAME = "পরীক্ষার ফি";

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyStructureForm = {
  amount: "",
  frequency: "MONTHLY" as FeeFrequency,
  fee_type: "" as FeeType,
  session_id: "",
  exam_id: "",
};

const FeeStructurePage = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [division, setDivision] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [classLoading, setClassLoading] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [exams, setExams] = useState<FeeLinkableExam[]>([]);
  const [categories, setCategories] = useState<FeeCategoryItem[]>([]);

  const [structures, setStructures] = useState<FeeStructureRow[]>([]);
  const [structuresLoading, setStructuresLoading] = useState(true);
  const [structureForm, setStructureForm] = useState(emptyStructureForm);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<FeeStructureRow | null>(null);
  const [editForm, setEditForm] = useState(emptyStructureForm);
  const [editSaving, setEditSaving] = useState(false);

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
      } catch (err) {
        logger.error("LOAD SESSIONS ERROR:", err);
        setSessions([]);
      }
    };
    loadSessions();
  }, []);

  // নির্বাচিত বিভাগ অনুযায়ী ডিফল্ট সেশন — সেই বিভাগের নিজস্ব চলমান সেশন থাকলে
  // সেটা, নাহলে "সাধারণ" (divisionId null) চলমান সেশন। ফিল্ড আগে থেকে খালি
  // থাকলেই কেবল বসানো হয় (existing prev.session_id ? prev : ... ধরন), যাতে
  // ব্যবহারকারীর ম্যানুয়াল বাছাই মুছে না যায়।
  useEffect(() => {
    if (sessions.length === 0) return;
    const divisionIdNum = division ? Number(division) : null;
    const current =
      (divisionIdNum !== null && sessions.find((s) => s.isActive && s.divisionId === divisionIdNum)) ||
      sessions.find((s) => s.isActive && s.divisionId === null);
    if (!current) return;
    setStructureForm((prev) => (prev.session_id ? prev : { ...prev, session_id: String(current.id) }));
  }, [division, sessions]);

  useEffect(() => {
    const loadExams = async () => {
      try {
        const res = await feeStructureApi.listExams();
        setExams(normalizeArray(res));
      } catch (err) {
        logger.error("LOAD EXAMS FOR FEE LINKING ERROR:", err);
        setExams([]);
      }
    };
    loadExams();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await feeCategoryApi.list();
        setCategories(normalizeArray(res));
      } catch (err) {
        logger.error("LOAD FEE CATEGORIES ERROR:", err);
        setCategories([]);
      }
    };
    loadCategories();
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
      setStructuresLoading(true);
      const res = await feeStructureApi.list(classId ? { class_id: Number(classId) } : undefined);
      setStructures(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD FEE STRUCTURES ERROR:", err);
      setStructures([]);
    } finally {
      setStructuresLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadStructures();
  }, [loadStructures]);

  const handleCreateStructure = async () => {
    if (!structureForm.fee_type || !structureForm.amount || !structureForm.session_id) {
      useToastStore.getState().show("ফি ধরণ, পরিমাণ ও সেশন দিন", "error");
      return;
    }
    if (structureForm.fee_type === EXAM_FEE_TYPE_NAME && !structureForm.exam_id) {
      useToastStore.getState().show("পরীক্ষার ফি এর জন্য যুক্ত পরীক্ষা নির্বাচন করুন", "error");
      return;
    }
    const structureClassId = classId ? Number(classId) : undefined;
    const structureSessionId = Number(structureForm.session_id);
    try {
      setSaving(true);
      const examId = structureForm.exam_id ? Number(structureForm.exam_id) : undefined;
      await feeStructureApi.create({
        class_id: structureClassId,
        name: structureForm.fee_type,
        amount: Number(structureForm.amount),
        frequency: structureForm.frequency,
        fee_type: structureForm.fee_type,
        session_id: structureSessionId,
        exam_id: examId,
      });
      setStructureForm(emptyStructureForm);
      loadStructures();

      // Immediately bill every already-enrolled student this structure
      // applies to, so nobody has to remember a separate manual step -
      // matches the auto-billing-at-admission behavior new students
      // already get. A billing hiccup here doesn't mean the structure
      // itself failed to save, so it's reported as its own toast. This is
      // also the ONLY moment a নির্দিষ্ট পরীক্ষার সাথে যুক্ত ফি gets billed at
      // all - future admission approvals skip it on purpose (see backend
      // FeeService.autoGenerateInvoicesForStudent) so a newly-admitted
      // student is never billed up front for an exam that hasn't happened
      // yet; editing this structure later (or toggling it back on) will
      // catch them up, since both re-run the same backfill below.
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
      amount: String(structure.amount),
      frequency: structure.frequency,
      fee_type: structure.feeType || "",
      session_id: structure.sessionId ? String(structure.sessionId) : "",
      exam_id: structure.examId ? String(structure.examId) : "",
    });
  };

  const handleUpdateStructure = async () => {
    if (!editTarget) return;
    if (!editForm.fee_type || !editForm.amount || !editForm.session_id) {
      useToastStore.getState().show("ফি ধরণ, পরিমাণ ও সেশন দিন", "error");
      return;
    }
    if (editForm.fee_type === EXAM_FEE_TYPE_NAME && !editForm.exam_id) {
      useToastStore.getState().show("পরীক্ষার ফি এর জন্য যুক্ত পরীক্ষা নির্বাচন করুন", "error");
      return;
    }
    const targetClassId = editTarget.classId ?? undefined;
    const targetSessionId = Number(editForm.session_id);
    try {
      setEditSaving(true);
      await feeStructureApi.update(editTarget.id, {
        name: editForm.fee_type,
        amount: Number(editForm.amount),
        frequency: editForm.frequency,
        fee_type: editForm.fee_type,
        session_id: targetSessionId,
        // সবসময় পাঠানো হয় (undefined না) যাতে "সাধারণ" নির্বাচন করে আগের যুক্ত
        // পরীক্ষা সরিয়ে ফেলা যায় - দেখুন backend resolveExamId, "" মানে null।
        exam_id: editForm.exam_id ? Number(editForm.exam_id) : "",
      });
      setEditTarget(null);
      loadStructures();

      // এডিট করার সাথে সাথেই যোগ্য বিদ্যমান ছাত্রদের বাকি থাকা ইনভয়েস তৈরি
      // হয়ে যায় - তৈরির সময়ের মতোই, যাতে কোনো ম্যানুয়াল "আবার সেট করুন" ধাপ
      // ছাড়াই পরিবর্তনটা সবার জন্য প্রযোজ্য হয়।
      try {
        const res = await invoiceApi.backfill({ class_id: targetClassId, session_id: targetSessionId });
        const data = (res.data as any)?.data;
        useToastStore
          .getState()
          .show(
            `ফি কাঠামো আপডেট হয়েছে — ${data?.invoicesCreated ?? 0}টি ইনভয়েস তৈরি হয়েছে (${data?.studentsProcessed ?? 0} জন ছাত্রের জন্য)`,
            "success",
          );
      } catch (err) {
        logger.error("AUTO BACKFILL ON UPDATE ERROR:", err);
        useToastStore
          .getState()
          .show("ফি কাঠামো আপডেট হয়েছে, তবে বিদ্যমান ছাত্রদের ইনভয়েস তৈরিতে সমস্যা হয়েছে", "error");
      }
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

  // ফি কাঠামো নিজে বন্ধ থাকলে ভর্তি-অনুমোদন/মাসিক অটো-বিলিং কোনোটাতেই এটা বিল
  // হয় না (দেখুন backend FeeRepository.findActiveStructuresForBilling) - তাই
  // এই টগলটাই একটা নির্দিষ্ট ফি কাঠামো বিলিং থেকে বাদ দেয়ার আসল উপায়।
  const handleToggleStructureActive = async (row: FeeStructureRow) => {
    const nextActive = !row.isActive;
    try {
      await feeStructureApi.update(row.id, { is_active: nextActive });
      setStructures((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, isActive: nextActive } : s)),
      );

      // আবার চালু করলে এই ফি কাঠামো যে সময় বন্ধ ছিল তখনকার যোগ্য ছাত্ররাও বাকি
      // থাকা ইনভয়েস পেয়ে যায় - বন্ধ করার সময় কিছু মোছা হয় না, তাই এখানে শুধু
      // create/edit-এর মতোই backfill চালালেই যথেষ্ট।
      if (nextActive) {
        try {
          const res = await invoiceApi.backfill({
            class_id: row.classId ?? undefined,
            session_id: row.sessionId ?? undefined,
          });
          const data = (res.data as any)?.data;
          useToastStore
            .getState()
            .show(
              `ফি কাঠামো চালু হয়েছে — ${data?.invoicesCreated ?? 0}টি ইনভয়েস তৈরি হয়েছে (${data?.studentsProcessed ?? 0} জন ছাত্রের জন্য)`,
              "success",
            );
        } catch (err) {
          logger.error("AUTO BACKFILL ON REACTIVATE ERROR:", err);
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "আপডেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
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

  const isCreateFormValid =
    structureForm.fee_type !== "" &&
    structureForm.amount !== "" &&
    structureForm.session_id !== "" &&
    (structureForm.fee_type !== EXAM_FEE_TYPE_NAME || structureForm.exam_id !== "");

  const isEditFormValid =
    editForm.fee_type !== "" &&
    editForm.amount !== "" &&
    editForm.session_id !== "" &&
    (editForm.fee_type !== EXAM_FEE_TYPE_NAME || editForm.exam_id !== "");

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">ফি সেটাপ</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            ফি কাঠামো তৈরি করুন — নতুন ভর্তি হওয়া ছাত্রদের পাশাপাশি বিদ্যমান সব যোগ্য ছাত্রের জন্যও
            ইনভয়েস অটোমেটিক তৈরি হয়ে যায়
          </p>
        </div>

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
            নতুন ফি কাঠামো তৈরি করুন {classId ? "(নির্বাচিত শ্রেণির জন্য)" : "(সব শ্রেণির জন্য)"}
          </h2>
          <p className="mb-3 -mt-1 text-xs text-gray-500 dark:text-slate-400">
            তৈরি করার সাথে সাথেই যোগ্য বিদ্যমান ছাত্রদের জন্য অটোমেটিক ইনভয়েস তৈরি হয়ে যাবে — এডিট করলে বা
            নিষ্ক্রিয় থেকে আবার সক্রিয় করলেও একইভাবে হয়ে যায়, আলাদা কিছু চালাতে হয় না। পরীক্ষার ফি হলে
            চাইলে নির্দিষ্ট একটি পরীক্ষার সাথে যুক্ত করে দিন — তাহলে সেই ফি নতুন ভর্তির সাথে সাথেই বিল হবে
            না, বরং শুধু তখনই বিল হবে যখন আপনি এটা তৈরি বা এডিট করবেন — অর্থাৎ যখন পরীক্ষাটা সত্যিই আসন্ন।
          </p>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <div className="w-full sm:w-auto">
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400">
                  ফি ধরণ <span className="text-rose-500">*</span>
                </label>
                <Link
                  to="/ihtemam/fee-categories"
                  className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  ফি ধরণ ম্যানেজ করুন
                </Link>
              </div>
              <select
                value={structureForm.fee_type}
                onChange={(e) =>
                  setStructureForm((p) => ({ ...p, fee_type: e.target.value as FeeType, exam_id: "" }))
                }
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">নির্বাচন করুন</option>
                {categories
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                ফ্রিকোয়েন্সি
              </label>
              <select
                value={structureForm.frequency}
                onChange={(e) =>
                  setStructureForm((p) => ({ ...p, frequency: e.target.value as FeeFrequency }))
                }
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {(Object.keys(FREQUENCY_LABELS) as FeeFrequency[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                পরিমাণ (৳) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="পরিমাণ"
                value={structureForm.amount}
                onChange={(e) =>
                  setStructureForm((p) => ({ ...p, amount: normalizeBanglaDigits(e.target.value) }))
                }
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-32"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">বিভাগ</label>
              <select
                value={division}
                onChange={(event) => {
                  const value = event.target.value;
                  setDivision(value);
                  loadClasses(value);
                }}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">সাধারণ (সব বিভাগ)</option>
                {divisions.map((d) => (
                  <option key={d.division_id} value={d.division_id}>
                    {d.division_name_bn}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">শ্রেণি</label>
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                disabled={!division || classLoading}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
              >
                <option value="">{classLoading ? "লোড হচ্ছে..." : "সাধারণ (সব শ্রেণি)"}</option>
                {classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name_bn}
                  </option>
                ))}
              </select>
            </div>
            {structureForm.fee_type === EXAM_FEE_TYPE_NAME && (
              <div className="w-full sm:w-auto sm:max-w-[220px]">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                  যুক্ত পরীক্ষা <span className="text-rose-500">*</span>
                </label>
                <select
                  value={structureForm.exam_id}
                  onChange={(e) => setStructureForm((p) => ({ ...p, exam_id: e.target.value }))}
                  disabled={exams.length === 0}
                  title="পরীক্ষার ফি ভর্তির সাথে সাথে বিল হয় না - বরং তৈরি/এডিট করার সাথে সাথেই বিদ্যমান ছাত্রদের বিল হয়"
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900"
                >
                  <option value="">নির্বাচন করুন</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.year})
                    </option>
                  ))}
                </select>
                {exams.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    এখনো কোনো পরীক্ষা তৈরি করা নেই - আগে একটি পরীক্ষা তৈরি করুন, তারপর এখানে যুক্ত করুন।
                  </p>
                )}
              </div>
            )}
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                সেশন <span className="text-rose-500">*</span>
              </label>
              <select
                value={structureForm.session_id}
                onChange={(e) => setStructureForm((p) => ({ ...p, session_id: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">সেশন নির্বাচন করুন</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isActive ? " (সক্রিয়)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={saving || !isCreateFormValid}
              onClick={handleCreateStructure}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {saving ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {structuresLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, groupIdx) => (
                <div key={groupIdx} className="rounded-xl border border-gray-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <SkeletonText width="w-24" />
                    <Skeleton className="h-4 w-8 rounded-full" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {Array.from({ length: 3 }).map((_, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-2 dark:border-slate-800"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <SkeletonText width="w-2/3" />
                          <div className="flex gap-1">
                            <Skeleton className="h-3.5 w-14 rounded" />
                            <Skeleton className="h-3.5 w-10 rounded" />
                          </div>
                        </div>
                        <Skeleton className="h-5 w-8 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : structures.length === 0 ? (
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
                                  {row.feeType && (
                                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                                      {row.feeType}
                                    </span>
                                  )}
                                  {row.exam && (
                                    <span
                                      title="নির্দিষ্ট এই পরীক্ষার সাথে যুক্ত - ভর্তির সাথে সাথে বিল হয় না, শুধু তৈরি/আবার-সেট করার সময় বিল হয়"
                                      className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                                    >
                                      {row.exam.name} ({row.exam.year})
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
                              <div className="flex shrink-0 items-center gap-1">
                                <ToggleSwitch
                                  checked={row.isActive}
                                  onChange={() => handleToggleStructureActive(row)}
                                  size="sm"
                                  title={
                                    row.isActive
                                      ? "বন্ধ করলে এই ফি কাঠামো আর কোনো ছাত্রের জন্য বিল হবে না"
                                      : "চালু করুন"
                                  }
                                />
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
      </div>

      {/* Edit fee structure modal */}
      <Modal
        open={!!editTarget}
        title={`ফি কাঠামো এডিট করুন — ${editTarget?.name || ""}`}
        onClose={() => setEditTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              ফি ধরণ <span className="text-rose-500">*</span>
            </label>
            <select
              value={editForm.fee_type}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, fee_type: e.target.value as FeeType, exam_id: "" }))
              }
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">নির্বাচন করুন</option>
              {categories
                .filter((c) => c.isActive || c.name === editForm.fee_type)
                .map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
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
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পরিমাণ (৳)</label>
            <input
              type="text"
              inputMode="decimal"
              value={editForm.amount}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, amount: normalizeBanglaDigits(e.target.value) }))
              }
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          {editForm.fee_type === EXAM_FEE_TYPE_NAME && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                যুক্ত পরীক্ষা <span className="text-rose-500">*</span>
              </label>
              <select
                value={editForm.exam_id}
                onChange={(e) => setEditForm((p) => ({ ...p, exam_id: e.target.value }))}
                disabled={exams.length === 0}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900"
              >
                <option value="">নির্বাচন করুন</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.year})
                  </option>
                ))}
              </select>
              {exams.length === 0 && (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  এখনো কোনো পরীক্ষা তৈরি করা নেই - আগে একটি পরীক্ষা তৈরি করুন, তারপর এখানে যুক্ত করুন।
                </p>
              )}
            </div>
          )}
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
                  {s.isActive ? " (সক্রিয়)" : ""}
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
            disabled={editSaving || !isEditFormValid}
            onClick={handleUpdateStructure}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default FeeStructurePage;
