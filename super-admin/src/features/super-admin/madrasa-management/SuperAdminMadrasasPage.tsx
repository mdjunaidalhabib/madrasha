import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import {
  activateMadrasa,
  assignPlan,
  cleanMadrasaData,
  createMadrasa,
  getMadrasa,
  listMadrasas,
  listPlans,
  suspendMadrasa,
  trashMadrasa,
  updateMadrasa,
} from "../../../services/superAdminApi";
import SearchPaginationBar from "../../../components/super-admin/SearchPaginationBar";
import MadrasasTable from "../../../components/super-admin/MadrasasTable";
import CreateMadrasaModal from "../../../components/super-admin/create-madrasa/CreateMadrasaModal";
import CleanMadrasaModal from "../../../components/super-admin/CleanMadrasaModal";
import DivisionsSection from "../../../components/super-admin/create-madrasa/DivisionsSection";
import ToggleSection from "../../../components/super-admin/create-madrasa/ToggleSection";
import MadrasaUsersSection from "../../../components/super-admin/create-madrasa/MadrasaUsersSection";
import { Link } from "react-router-dom";
import { CreateMadrasaPayload } from "../../../components/super-admin/create-madrasa/types";
import api, { cachedGet } from "../../../services/adminApi";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import {
  INSTITUTION_TYPES,
  INSTITUTION_TYPE_LABELS,
  commonText,
  formatNumber,
  getLang,
  getText,
  useLang,
  useText,
  type InstitutionType,
  type Lang,
} from "@madrasha/shared-ui/src/i18n";
import InstitutionSection, {
  normalizeDefaultLanguage,
  type DefaultLanguageValue,
} from "../../../components/super-admin/create-madrasa/InstitutionSection";
import { createMadrasaText } from "../../../components/super-admin/create-madrasa/createMadrasa.text";
import { madrasasText } from "./madrasas.text";

export type Madrasa = {
  id: number;
  name: string;
  slug: string;
  is_active: number;
  plan_id?: number | null;
  plan_name: string | null;
  student_limit: number;
  user_limit: number;
  website_status?: string;
  custom_domain?: string | null;
  address?: string | null;
  phone?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  institution_type?: InstitutionType;
  /** Effective default language (list rows resolve the type default). */
  default_language?: Lang;
};

export type Plan = {
  id: number;
  name: string;
  studentLimit: number;
  userLimit: number;
  durationDays: number;
  /** Per-বিভাগ registration-number block size per class (see plan settings). */
  regBlocks?: { divisionId: number; blockSize: number }[];
  website_status?: string;
  address?: string | null;
  phone?: string | null;
};

/* ==============================
   Debounce Hook
================================ */

function useDebounce<T>(value: T, delay = 400) {
  const [v, setV] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return v;
}

export default function SuperAdminMadrasasPage() {
  const t = useText(madrasasText);
  const c = useText(commonText);
  const lang = useLang();
  const [items, setItems] = useState<Madrasa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [q, setQ] = useState("");
  const dq = useDebounce(q, 350);
  const [typeFilter, setTypeFilter] = useState<InstitutionType | "">("");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [total, setTotal] = useState<number>(0);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Madrasa | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [cleaningTarget, setCleaningTarget] = useState<Madrasa | null>(null);
  const [cleanBusy, setCleanBusy] = useState(false);

  /* ==============================
     Pagination
  ============================== */

  const totalPages = useMemo(() => {
    const t = total || items.length;
    return Math.max(1, Math.ceil(t / limit));
  }, [total, items.length, limit]);

  /* ==============================
     FETCH MADRASAS
  ============================== */

  const fetchAll = useCallback(async () => {
    setLoading(true);

    try {
      const data = await listMadrasas({
        q: dq || undefined,
        page,
        limit,
        institution_type: typeFilter || undefined,
      });

      const rows: Madrasa[] = Array.isArray(data) ? data : (data.data ?? []);
      // The type filter is also applied here so the list stays correct even
      // where the API ignores the institution_type query param.
      setItems(typeFilter ? rows.filter((m) => (m.institution_type ?? "MADRASA") === typeFilter) : rows);

      if (!Array.isArray(data) && data.meta?.total != null) {
        setTotal(Number(data.meta.total));
      } else {
        setTotal(0);
      }
    } catch (err) {
      logger.error("Failed to fetch madrasas:", err);
    } finally {
      setLoading(false);
    }
  }, [dq, page, limit, typeFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Selection is page/search scoped — clear it whenever the visible set changes.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [dq, page, typeFilter]);

  /* ==============================
     FETCH PLANS
  ============================== */

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await listPlans();
        const rows = Array.isArray(data) ? data : (data.data ?? []);
        setPlans(rows);
      } catch (err) {
        logger.error("Failed to fetch plans:", err);
      }
    };

    fetchPlans();
  }, []);

  /* ==============================
     CREATE MADRASA
  ============================== */

  const onCreate = async (payload: CreateMadrasaPayload) => {
    try {
      await createMadrasa(payload);

      setOpenCreate(false);
      setPage(1);

      await fetchAll();
    } catch (err) {
      logger.error("Create madrasa failed:", err);
    }
  };

  /* ==============================
     ACTIVATE / SUSPEND
  ============================== */

  const onToggleActive = async (m: Madrasa) => {
    setBusyId(m.id);

    try {
      if (m.is_active) {
        await suspendMadrasa(m.id);
      } else {
        await activateMadrasa(m.id);
      }

      await fetchAll();
    } catch (err) {
      logger.error("Toggle active failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  /* ==============================
     CHANGE PLAN
  ============================== */

  const onPlanChange = async (m: Madrasa, planId: number) => {
    setBusyId(m.id);

    try {
      await assignPlan(m.id, planId);
      await fetchAll();
    } catch (err) {
      logger.error("Assign plan failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  const onEditSave = async (payload: Partial<Madrasa> & Record<string, unknown>) => {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      await updateMadrasa(editing.id, payload);
      setEditing(null);
      await fetchAll();
    } finally {
      setBusyId(null);
    }
  };

  /* ==============================
     MOVE TO TRASH
  ============================== */

  const onDelete = (m: Madrasa) => {
    const tx = getText(madrasasText);
    useConfirmStore.getState().show({
      title: tx.moveToTrash,
      message: tx.moveOneToTrash(m.name),
      confirmText: tx.moveToTrash,
      danger: true,
      onConfirm: async () => {
        setBusyId(m.id);

        try {
          await trashMadrasa(m.id);
          await fetchAll();
        } catch (err) {
          logger.error("Delete madrasa failed:", err);
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  /* ==============================
     CLEAN MADRASA DATA (super-admin-only, password-verified wipe)
  ============================== */

  const onCleanConfirm = async (payload: {
    mode: "operational" | "full";
    confirm_name: string;
    password: string;
  }) => {
    if (!cleaningTarget) return;
    setCleanBusy(true);
    try {
      await cleanMadrasaData(cleaningTarget.id, payload);
      useToastStore.getState().show(getText(madrasasText).cleanSuccess, "success");
      setCleaningTarget(null);
      await fetchAll();
    } catch (err: any) {
      logger.error("Clean madrasa data failed:", err);
      const msg = err?.response?.data?.message || getText(madrasasText).cleanFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setCleanBusy(false);
    }
  };

  /* ==============================
     SELECTION + BULK TRASH
  ============================== */

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const allSelected = items.length > 0 && items.every((m) => prev.has(m.id));
      return allSelected ? new Set() : new Set(items.map((m) => m.id));
    });
  };

  const onBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const tx = getText(madrasasText);
    useConfirmStore.getState().show({
      title: tx.moveToTrash,
      message: tx.moveManyToTrash(formatNumber(ids.length, getLang())),
      confirmText: tx.moveToTrash,
      danger: true,
      onConfirm: async () => {
        setBulkBusy(true);

        try {
          await Promise.allSettled(ids.map((id) => trashMadrasa(id)));
          setSelectedIds(new Set());
          await fetchAll();
        } catch (err) {
          logger.error("Bulk delete failed:", err);
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  /* ==============================
     PAGINATION CONTROL
  ============================== */

  const disablePrev = page <= 1 || loading;
  const disableNext = page >= totalPages || loading;

  /* ==============================
     UI
  ============================== */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold dark:text-slate-100 sm:text-2xl">{t.title}</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">{t.subtitle}</p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link to="/admin/madrasas/trash" className="flex-1 sm:flex-none">
            <Button variant="secondary" className="w-full sm:w-auto">
              {t.trash}
            </Button>
          </Link>

          <Button className="flex-1 sm:flex-none" onClick={() => setOpenCreate(true)}>
            {t.createInstitution}
          </Button>
        </div>
      </div>

      {/* Institution type filter */}
      <div
        className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        role="tablist"
        aria-label={t.filterByType}
      >
        {([""] as (InstitutionType | "")[]).concat(INSTITUTION_TYPES).map((type) => {
          const active = typeFilter === type;
          return (
            <button
              key={type || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTypeFilter(type);
                setPage(1);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition ${
                active
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {type ? INSTITUTION_TYPE_LABELS[type][lang] : t.allTypes}
            </button>
          );
        })}
      </div>

      {/* Search + Pagination */}
      <SearchPaginationBar
        q={q}
        setQ={(val) => {
          setQ(val);
          setPage(1);
        }}
        clear={() => {
          setQ("");
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        total={total}
        disablePrev={disablePrev}
        disableNext={disableNext}
        prev={() => setPage((p) => Math.max(1, p - 1))}
        next={() => setPage((p) => p + 1)}
      />

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/40">
          <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
            {t.selectedCount(formatNumber(selectedIds.size, lang))}
          </span>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkBusy}
            >
              {c.clear}
            </Button>
            <Button variant="danger" className="flex-1 sm:flex-none" onClick={onBulkDelete} disabled={bulkBusy}>
              {bulkBusy ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {t.deleting}
                </span>
              ) : (
                t.moveNToTrash(formatNumber(selectedIds.size, lang))
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <MadrasasTable
        loading={loading}
        items={items}
        plans={plans}
        busyId={busyId}
        onPlanChange={onPlanChange}
        onToggleActive={onToggleActive}
        onDelete={onDelete}
        onEdit={setEditing}
        onClean={setCleaningTarget}
        selectedIds={selectedIds}
        onToggleOne={toggleOne}
        onToggleAll={toggleAll}
      />

      {editing && (
        <EditMadrasaModal
          madrasa={editing}
          plans={plans}
          busy={busyId === editing.id}
          onClose={() => setEditing(null)}
          onSubmit={onEditSave}
        />
      )}

      {/* Create Modal */}
      {openCreate && (
        <CreateMadrasaModal
          plans={plans}
          onClose={() => setOpenCreate(false)}
          onSubmit={onCreate}
        />
      )}

      {cleaningTarget && (
        <CleanMadrasaModal
          madrasaId={cleaningTarget.id}
          madrasaName={cleaningTarget.name}
          busy={cleanBusy}
          onClose={() => {
            if (cleanBusy) return;
            setCleaningTarget(null);
          }}
          onConfirm={onCleanConfirm}
        />
      )}

    </div>
  );
}

/** yyyy-mm-dd for a <input type="date">, defaulting to today when the
 * madrasa has no subscription yet (e.g. plan not assigned). */
function toDateInputValue(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  return base.toISOString().slice(0, 10);
}

function EditMadrasaModal({
  madrasa,
  plans,
  busy,
  onClose,
  onSubmit,
}: {
  madrasa: Madrasa;
  plans: Plan[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Madrasa> & Record<string, unknown>) => Promise<void>;
}) {
  const t = useText(madrasasText);
  const tc = useText(createMadrasaText);
  const c = useText(commonText);

  // Institution type + raw default-language override (detail endpoint; "" = type default).
  const [institutionType, setInstitutionType] = useState<InstitutionType>(madrasa.institution_type ?? "MADRASA");
  const [defaultLanguage, setDefaultLanguage] = useState<DefaultLanguageValue>("");

  const [form, setForm] = useState({
    name: madrasa.name || "",
    slug: madrasa.slug || "",
    address: madrasa.address || "",
    phone: madrasa.phone || "",
    student_limit: Number(madrasa.student_limit || 0),
    user_limit: Number(madrasa.user_limit || 0),
    is_active: Number(madrasa.is_active || 0),
    website_status: madrasa.website_status || "active",
    custom_domain: madrasa.custom_domain || "",
    plan_id: madrasa.plan_id ? String(madrasa.plan_id) : "",
    start_date: toDateInputValue(madrasa.start_date),
  });

  const update = (key: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // প্ল্যান বাছলে সেই প্ল্যানের নিজের student/user limit দিয়ে ফিল্ড সাথে সাথে
  // ওভাররাইট হবে (Create Madrasa-র handlePlanChange-এর সাথে consistent) - এতে
  // সেভ করার আগেই সুপার অ্যাডমিন আসল ভ্যালু দেখতে পান, ব্যাকএন্ড এমনিতেও প্ল্যান
  // পাঠানো হলে limit ওভাররাইট করে দেয় (updateMadrasaLimitsOnTx)। "No change"
  // বাছলে আগের/ম্যানুয়াল ভ্যালুই থাকে, editable থাকে।
  const handlePlanChange = (id: string) => {
    setForm((prev) => {
      if (!id) return { ...prev, plan_id: id };
      const plan = plans.find((p) => String(p.id) === id);
      if (!plan) return { ...prev, plan_id: id };
      return {
        ...prev,
        plan_id: id,
        student_limit: plan.studentLimit,
        user_limit: plan.userLimit,
      };
    });
  };

  /* =========================
  System Setup (same fields as Create Madrasa)
  ========================= */
  type Item = { key: string; label: string };
  type DivisionItem = Item & { institutionType: InstitutionType };

  const [allDivisionItems, setAllDivisionItems] = useState<DivisionItem[]>([]);
  const [moduleItems, setModuleItems] = useState<Item[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allBooks, setAllBooks] = useState<any[]>([]);

  const [divisions, setDivisions] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [books, setBooks] = useState<string[]>([]);

  const [loadingSetup, setLoadingSetup] = useState(true);

  // Load master data + this madrasa's currently active divisions/modules
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingSetup(true);
      try {
        const [divRes, modRes, classRes, bookRes, detailRes] = await Promise.all([
          cachedGet("/super/divisions"),
          cachedGet("/super/modules"),
          cachedGet("/super/classes"),
          cachedGet("/super/books"),
          getMadrasa(madrasa.id),
        ]);

        if (cancelled) return;

        const divData: DivisionItem[] = (divRes.data?.data || []).map((r: any) => ({
          key: String(r.id),
          label: r.label || r.name,
          institutionType: (r.institution_type || "MADRASA") as InstitutionType,
        }));
        const modData = (modRes.data?.data || []).map((r: any) => ({
          key: String(r.id),
          label: r.label || r.name,
        }));

        setAllDivisionItems(divData);
        setModuleItems(modData);
        setAllClasses(classRes.data?.data || []);
        setAllBooks(bookRes.data?.data || []);

        const detail = detailRes?.data || {};
        const detailType: InstitutionType = detail.institution_type || madrasa.institution_type || "MADRASA";
        setInstitutionType(detailType);
        setDefaultLanguage(normalizeDefaultLanguage(detailType, detail.default_language || ""));
        setDivisions((detail.divisions || []).map((id: number) => String(id)));
        setModules((detail.modules || []).map((id: number) => String(id)));
      } catch (err) {
        logger.error("Failed to load madrasa setup data:", err);
      } finally {
        if (!cancelled) setLoadingSetup(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [madrasa.id]);

  // Only the catalogue divisions of the selected institution type are offered.
  const divisionItems = useMemo<Item[]>(
    () => allDivisionItems.filter((d) => d.institutionType === institutionType),
    [allDivisionItems, institutionType],
  );

  // Changing the type drops selected divisions (and, via the effects below,
  // their classes/books) that belong to another type's catalogue.
  const handleTypeChange = (type: InstitutionType) => {
    setInstitutionType(type);
    setDefaultLanguage((prev) => normalizeDefaultLanguage(type, prev));
    const allowed = new Set(allDivisionItems.filter((d) => d.institutionType === type).map((d) => d.key));
    setDivisions((prev) => prev.filter((id) => allowed.has(id)));
  };

  // Classes are hidden from the UI (same as Create) — auto-select ALL
  // classes under the selected divisions.
  useEffect(() => {
    if (!divisions.length) {
      setClasses([]);
      return;
    }
    const validKeys = allClasses
      .filter((c) => divisions.includes(String(c.division_id)))
      .map((c) => String(c.id));
    setClasses(validKeys);
  }, [divisions, allClasses]);

  // Books are hidden too — auto-select ALL books under the auto-selected classes.
  useEffect(() => {
    if (!classes.length) {
      setBooks([]);
      return;
    }
    const validKeys = allBooks
      .filter((b) => classes.includes(String(b.class_id)))
      .map((b) => String(b.id));
    setBooks(validKeys);
  }, [classes, allBooks]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900 sm:max-h-[90vh] sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t.editTitle}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.editSubtitle}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.name}</label>
            <input
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.slug}</label>
            <input
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.address}</label>
            <input
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.address || ""}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.phone}</label>
            <input
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.phone || ""}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <InstitutionSection
              institutionType={institutionType}
              defaultLanguage={defaultLanguage}
              onTypeChange={handleTypeChange}
              onLanguageChange={setDefaultLanguage}
              labelClassName="mb-1 block text-sm font-semibold dark:text-slate-200"
              selectClassName="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:col-span-2">
            <div>
              <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.plan}</label>
              <select
                className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.plan_id}
                onChange={(e) => handlePlanChange(e.target.value)}
              >
                <option value="">{t.noChange}</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.studentLimit}</label>
              <input
                type="number"
                disabled={!!form.plan_id}
                className="w-full rounded border px-3 py-2 disabled:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60"
                value={form.student_limit}
                onChange={(e) => update("student_limit", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.userLimit}</label>
              <input
                type="number"
                disabled={!!form.plan_id}
                className="w-full rounded border px-3 py-2 disabled:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60"
                value={form.user_limit}
                onChange={(e) => update("user_limit", Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">
              {t.planStartDate}
            </label>
            <input
              type="date"
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.start_date}
              disabled={!form.plan_id}
              onChange={(e) => update("start_date", e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {t.startDateHint}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.institutionStatus}</label>
            <select
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.is_active}
              onChange={(e) => update("is_active", Number(e.target.value))}
            >
              <option value={1}>{c.active}</option>
              <option value={0}>{c.inactive}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.websiteStatus}</label>
            <select
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.website_status}
              onChange={(e) => update("website_status", e.target.value)}
            >
              <option value="active">{t.websiteActive}</option>
              <option value="limited">{t.websiteLimited}</option>
              <option value="disabled">{t.websiteDisabled}</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold dark:text-slate-200">
              {t.customDomain}
            </label>
            <input
              className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="www.example.com"
              value={form.custom_domain}
              onChange={(e) => update("custom_domain", e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {t.customDomainHint}
            </p>
          </div>
        </div>

        {/* System Setup — same as Create Madrasa (Classes/Books stay hidden and auto-derive) */}
        <div className="mt-6 space-y-4">
          {loadingSetup ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">{t.loadingSetup}</p>
          ) : (
            <>
              <DivisionsSection items={divisionItems} divisions={divisions} setDivisions={setDivisions} />
              {!divisionItems.length && allDivisionItems.length > 0 && (
                <p className="-mt-2 text-xs text-amber-600 dark:text-amber-400">{tc.noDivisionsForType}</p>
              )}

              <ToggleSection
                title={tc.modules}
                items={moduleItems}
                selected={modules}
                setSelected={setModules}
              />

              <MadrasaUsersSection madrasaId={madrasa.id} />
            </>
          )}
        </div>

        <div className="mt-6 flex gap-2 sm:justify-end">
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose} disabled={busy}>
            {c.cancel}
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() =>
              onSubmit({
                ...form,
                institution_type: institutionType,
                default_language: defaultLanguage || null,
                plan_id: form.plan_id ? Number(form.plan_id) : undefined,
                start_date: form.plan_id ? form.start_date : undefined,
                divisions: divisions.map(Number),
                modules: modules.map(Number),
                classes: classes.map(Number),
                books: books.map(Number),
              } as any)
            }
            disabled={busy || loadingSetup}
          >
            {busy ? c.saving : t.saveChanges}
          </Button>
        </div>
      </div>
    </div>
  );
}
