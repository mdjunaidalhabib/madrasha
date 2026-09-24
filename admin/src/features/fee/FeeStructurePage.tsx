import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList, Layers, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { cachedGet } from "../../services/api";
import {
  feeStructureApi,
  feeCategoryApi,
  invoiceApi,
  type FeeFrequency,
  type FeeType,
  type FeeCategoryItem,
} from "../../services/phase2Api";
import { type Session } from "../../services/sessionApi";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { Skeleton, SkeletonText } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { normalizeBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import ExamFeeTable from "./ExamFeeTable";

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
  class?: {
    nameBn?: string;
    sortOrder?: number;
    divisionId?: number | null;
    division?: { id?: number; nameBn?: string } | null;
  } | null;
  examId?: number | null;
  exam?: { id: number; name: string; year: string } | null;
};

const FREQUENCY_LABELS: Record<FeeFrequency, string> = {
  ONE_TIME: "একবার",
  MONTHLY: "মাসিক",
  YEARLY: "বাৎসরিক",
};

// Matches backend EXAM_FEE_CATEGORY_NAME (fee.constants.ts). পরীক্ষার ফি is
// not created from the generic form anymore - every exam gets one row per
// class of its বিভাগ automatically, edited in <ExamFeeTable /> (see backend
// ExamFeeService) - so this category is hidden from the form's picklist.
const EXAM_FEE_TYPE_NAME = "পরীক্ষার ফি";

// পেজের নিজস্ব সাইড মেনু - সেটিংস পেজের (SettingsLayout.tsx) মতো একই স্টাইল।
// "link" থাকা আইটেম অন্য পেজে যায়, বাকিগুলো ?tab= দিয়ে এই পেজেরই অংশ বদলায়।
type FeeSetupTab = "general" | "exam";
const FEE_SETUP_MENU: { key: string; label: string; hint: string; icon: typeof Layers; link?: string }[] = [
  { key: "general", label: "নিয়মিত ও অন্যান্য ফি", hint: "মাসিক, বাৎসরিক ও এককালীন ফি", icon: Layers },
  { key: "exam", label: "পরীক্ষার ফি", hint: "পরীক্ষা × শ্রেণি অনুযায়ী ফি", icon: ClipboardList },
  { key: "categories", label: "ফি ধরণ সেটিংস", hint: "ফি-র ধরণ যোগ/বদল", icon: Tags, link: "/ihtemam/fee-categories" },
];

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyStructureForm = {
  amount: "",
  frequency: "MONTHLY" as FeeFrequency,
  fee_type: "" as FeeType,
  session_id: "",
};

const FeeStructurePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: FeeSetupTab = searchParams.get("tab") === "exam" ? "exam" : "general";
  const selectTab = (tab: FeeSetupTab) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "general") next.delete("tab");
        else next.set("tab", tab);
        return next;
      },
      { replace: true },
    );

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [division, setDivision] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [classLoading, setClassLoading] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
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

  // তালিকা সবসময় পুরো মাদরাসার সব ফি কাঠামো দেখায় (তৈরির ফর্মে বিভাগ/শ্রেণি
  // বাছাই করলে তালিকা ছোট হয়ে যায় না) - বিভাগ অনুযায়ী ফিল্টার নিচের ট্যাব দিয়ে।
  const loadStructures = useCallback(async () => {
    try {
      setStructuresLoading(true);
      const res = await feeStructureApi.list();
      // পরীক্ষার ফি (কোনো পরীক্ষার সাথে যুক্ত সারি) এখানে না - সেগুলো নিচের
      // "পরীক্ষার ফি" টেবিল থেকে পরীক্ষার বিভাগ অনুযায়ী নিজে থেকে চলে।
      setStructures(normalizeArray(res).filter((row: FeeStructureRow) => row.examId == null));
    } catch (err) {
      logger.error("LOAD FEE STRUCTURES ERROR:", err);
      setStructures([]);
    } finally {
      setStructuresLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStructures();
  }, [loadStructures]);

  const handleCreateStructure = async () => {
    if (!structureForm.fee_type || !structureForm.amount || !structureForm.session_id) {
      useToastStore.getState().show("ফি ধরণ, পরিমাণ ও সেশন দিন", "error");
      return;
    }
    const structureClassId = classId ? Number(classId) : undefined;
    const structureSessionId = Number(structureForm.session_id);
    try {
      setSaving(true);
      await feeStructureApi.create({
        class_id: structureClassId,
        name: structureForm.fee_type,
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
    });
  };

  const handleUpdateStructure = async () => {
    if (!editTarget) return;
    if (!editForm.fee_type || !editForm.amount || !editForm.session_id) {
      useToastStore.getState().show("ফি ধরণ, পরিমাণ ও সেশন দিন", "error");
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
      });
      setEditTarget(null);
      loadStructures();

      // এডিট করার সাথে সাথেই যোগ্য বিদ্যমান ছাত্রদের বাকি থাকা ইনভয়েস তৈরি
      // হয়ে যায় - তৈরির সময়ের মতোই, যাতে কোনো ম্যানুয়াল "আবার সেট করুন" ধাপ
      // ছাড়াই পরিবর্তনটা সবার জন্য প্রযোজ্য হয়।
      try {
        const res = await invoiceApi.backfill({
          class_id: targetClassId,
          session_id: targetSessionId,
        });
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
      setStructures((prev) => prev.map((s) => (s.id === row.id ? { ...s, isActive: nextActive } : s)));

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

  // বিভাগ → শ্রেণি অনুযায়ী সাজানো। মাদরাসার প্রতিটা চালু বিভাগ (ফি না থাকলেও)
  // নিজের সেকশন পায়, ক্রম /madrasa-divisions এর ক্রম মেনে - যাতে এক নজরে বোঝা
  // যায় কোন বিভাগে ফি সেট করা বাকি। "সাধারণ" (শ্রেণি ছাড়া, সবার জন্য প্রযোজ্য)
  // সবসময় প্রথমে। শ্রেণিগুলো sortOrder অনুযায়ী (বর্ণানুক্রমে না, কারণ
  // "প্রথম/দ্বিতীয়..." বর্ণক্রমে উল্টাপাল্টা হয়ে যায়)।
  type ClassGroup = { key: string; label: string; sortOrder: number; items: FeeStructureRow[] };
  type DivisionGroup = {
    key: string;
    label: string;
    divisionId: number | null;
    classGroups: ClassGroup[];
    count: number;
  };

  const groupedStructures = useMemo<DivisionGroup[]>(() => {
    const divisionMap = new Map<
      string,
      { label: string; divisionId: number | null; classMap: Map<string, ClassGroup> }
    >();
    for (const d of divisions) {
      divisionMap.set(String(d.division_id), {
        label: d.division_name_bn,
        divisionId: d.division_id,
        classMap: new Map(),
      });
    }

    const genericItems: FeeStructureRow[] = [];
    for (const row of structures) {
      if (!row.classId) {
        genericItems.push(row);
        continue;
      }
      const divId = row.class?.division?.id ?? row.class?.divisionId ?? null;
      const divKey = divId != null ? String(divId) : "other";
      if (!divisionMap.has(divKey)) {
        divisionMap.set(divKey, {
          label: row.class?.division?.nameBn || "অন্যান্য",
          divisionId: divId,
          classMap: new Map(),
        });
      }
      const division = divisionMap.get(divKey)!;
      const classKey = String(row.classId);
      if (!division.classMap.has(classKey)) {
        division.classMap.set(classKey, {
          key: classKey,
          label: row.class?.nameBn || `শ্রেণি #${row.classId}`,
          sortOrder: row.class?.sortOrder ?? 0,
          items: [],
        });
      }
      division.classMap.get(classKey)!.items.push(row);
    }

    const divisionGroups: DivisionGroup[] = Array.from(divisionMap.entries()).map(([key, v]) => {
      const classGroups = Array.from(v.classMap.values()).sort(
        (a, b) => a.sortOrder - b.sortOrder || Number(a.key) - Number(b.key),
      );
      return {
        key,
        label: v.label,
        divisionId: v.divisionId,
        classGroups,
        count: classGroups.reduce((sum, g) => sum + g.items.length, 0),
      };
    });

    return [
      {
        key: "generic",
        label: "সাধারণ (সব বিভাগ ও শ্রেণির জন্য)",
        divisionId: null,
        classGroups: genericItems.length
          ? [{ key: "generic-items", label: "সব শ্রেণি", sortOrder: 0, items: genericItems }]
          : [],
        count: genericItems.length,
      },
      ...divisionGroups,
    ];
  }, [structures, divisions]);

  const [activeDivisionTab, setActiveDivisionTab] = useState("all");
  const formRef = useRef<HTMLDivElement>(null);

  const visibleGroups =
    activeDivisionTab === "all" ? groupedStructures : groupedStructures.filter((g) => g.key === activeDivisionTab);

  // কোনো বিভাগের সেকশন থেকে "ফি যোগ করুন" চাপলে তৈরির ফর্মে সেই বিভাগ আগে
  // থেকেই বাছাই হয়ে যায় - আবার উপরে গিয়ে বিভাগ খুঁজতে হয় না।
  const startAddForDivision = (divisionId: number | null) => {
    const value = divisionId != null ? String(divisionId) : "";
    setDivision(value);
    loadClasses(value);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const isCreateFormValid =
    structureForm.fee_type !== "" && structureForm.amount !== "" && structureForm.session_id !== "";

  const isEditFormValid = editForm.fee_type !== "" && editForm.amount !== "" && editForm.session_id !== "";

  return (
    <div>
      <div>
        {/* সেটিংস পেজের (SettingsLayout.tsx) মতো - মেনু সাইডবারের পাশেই বাম-উপরে,
            কোনো আলাদা প্যাডিং/মাঝে-সরানো কন্টেইনার ছাড়া; শিরোনাম কন্টেন্টের ভেতরে। */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
          <aside className="no-print self-start rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-4">
            <div className="mb-2 rounded-lg bg-blue-800 px-3 py-2 text-white">
              <h2 className="text-base font-bold">ফি মেনু</h2>
            </div>
            <nav className="space-y-1">
              {FEE_SETUP_MENU.map((item) => {
                const Icon = item.icon;
                const active = !item.link && item.key === activeTab;
                const itemClass = `flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition ${
                  active
                    ? "border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                }`;
                const body = (
                  <>
                    <span className="flex min-w-0 items-start gap-2">
                      <Icon size={15} className="mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.label}</span>
                        <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {item.hint}
                        </span>
                      </span>
                    </span>
                    <span
                      className={active ? "text-blue-700 dark:text-blue-400" : "text-slate-300 dark:text-slate-600"}
                    >
                      ›
                    </span>
                  </>
                );
                return item.link ? (
                  <Link key={item.key} to={item.link} className={itemClass}>
                    {body}
                  </Link>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectTab(item.key as FeeSetupTab)}
                    aria-current={active ? "page" : undefined}
                    className={itemClass}
                  >
                    {body}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">ফি সেটাপ</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                ফি নির্ধারণ করুন — নতুন ভর্তি হওয়া ছাত্রদের পাশাপাশি বিদ্যমান সব যোগ্য ছাত্রের জন্যও ইনভয়েস অটোমেটিক
                তৈরি হয়ে যায়
              </p>
            </div>
            {activeTab === "exam" ? (
              <ExamFeeTable />
            ) : (
              <>
                <div
                  ref={formRef}
                  className="mb-4 scroll-mt-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4"
                >
                  <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
                    নতুন ফি কাঠামো তৈরি করুন {classId ? "(নির্বাচিত শ্রেণির জন্য)" : "(সব শ্রেণির জন্য)"}
                  </h2>
                  <p className="mb-3 -mt-1 text-xs text-gray-500 dark:text-slate-400">
                    তৈরি করার সাথে সাথেই যোগ্য বিদ্যমান ছাত্রদের জন্য অটোমেটিক ইনভয়েস তৈরি হয়ে যাবে — এডিট করলে বা
                    নিষ্ক্রিয় থেকে আবার সক্রিয় করলেও একইভাবে হয়ে যায়, আলাদা কিছু চালাতে হয় না। পরীক্ষার ফি এখানে
                    নয় — বাম পাশের "পরীক্ষার ফি" মেনুতে প্রতিটি পরীক্ষার বিভাগ অনুযায়ী শ্রেণিগুলো নিজে থেকেই আসে।
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end">
                    <div className="w-full sm:w-auto">
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                        ফি ধরণ <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={structureForm.fee_type}
                        onChange={(e) => setStructureForm((p) => ({ ...p, fee_type: e.target.value as FeeType }))}
                        className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">নির্বাচন করুন</option>
                        {categories
                          .filter((c) => c.isActive && c.name !== EXAM_FEE_TYPE_NAME)
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
                        onChange={(e) => setStructureForm((p) => ({ ...p, frequency: e.target.value as FeeFrequency }))}
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
                  <div className="mb-4 flex items-center gap-2">
                    <Layers size={16} className="shrink-0 text-gray-400 dark:text-slate-500" />
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                      বিভাগ অনুযায়ী ফি কাঠামো
                    </h2>
                  </div>
                  {!structuresLoading && (
                    <div className="-mx-3 mb-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                      <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
                        {[
                          { key: "all", label: "সব বিভাগ", count: structures.length },
                          ...groupedStructures.map((g) => ({
                            key: g.key,
                            label: g.key === "generic" ? "সাধারণ" : g.label,
                            count: g.count,
                          })),
                        ].map((tab) => {
                          const active = activeDivisionTab === tab.key;
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setActiveDivisionTab(tab.key)}
                              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                active
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
                              }`}
                            >
                              {tab.label}
                              <span
                                className={`rounded-full px-1.5 text-[10px] ${
                                  active
                                    ? "bg-white/20 text-white"
                                    : tab.count === 0
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                      : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {tab.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                  ) : (
                    <div className="space-y-4">
                      {visibleGroups.map((division) => (
                        <section
                          key={division.key}
                          className="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`h-4 w-1 shrink-0 rounded-full ${
                                  division.key === "generic" ? "bg-emerald-500" : "bg-blue-500"
                                }`}
                              />
                              <h3 className="truncate text-sm font-bold text-gray-800 dark:text-slate-100">
                                {division.label}
                              </h3>
                              <span className="shrink-0 text-xs text-gray-500 dark:text-slate-400">
                                {division.count}টি ফি
                                {division.key !== "generic" && division.classGroups.length > 0
                                  ? ` · ${division.classGroups.length}টি শ্রেণি`
                                  : ""}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => startAddForDivision(division.divisionId)}
                              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                            >
                              <Plus size={14} />
                              ফি যোগ করুন
                            </button>
                          </div>
                          {division.classGroups.length === 0 ? (
                            <div className="px-3 py-5 text-center text-xs text-gray-400 dark:text-slate-500">
                              এই {division.key === "generic" ? "অংশে" : "বিভাগে"} এখনো কোনো ফি সেট করা হয়নি
                            </div>
                          ) : (
                            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
                              {division.classGroups.map((group) => (
                                <div
                                  key={group.key}
                                  className="rounded-xl border border-gray-200 p-3 dark:border-slate-700"
                                >
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <h4 className="truncate text-sm font-semibold text-gray-800 dark:text-slate-200">
                                      {group.label}
                                    </h4>
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
                                            {row.name}{" "}
                                            <span className="font-normal text-gray-500 dark:text-slate-400">
                                              ৳{row.amount}
                                            </span>
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
                          )}
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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
              onChange={(e) => setEditForm((p) => ({ ...p, fee_type: e.target.value as FeeType }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">নির্বাচন করুন</option>
              {categories
                .filter((c) => (c.isActive || c.name === editForm.fee_type) && c.name !== EXAM_FEE_TYPE_NAME)
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
              onChange={(e) => setEditForm((p) => ({ ...p, amount: normalizeBanglaDigits(e.target.value) }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
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
