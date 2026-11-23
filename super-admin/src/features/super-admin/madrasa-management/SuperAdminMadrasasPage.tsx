import { planToolsText } from "../subscriptions/plan-tools.text";
import type { AdminPlan, SubscriptionSnapshot } from "../../../services/subscriptionApi";
import MadrasaSubscriptionCard from "../subscriptions/MadrasaSubscriptionCard";
import DomainAddOnFields from "../subscriptions/DomainAddOnFields";
import ExpiredMadrasaList from "../subscriptions/ExpiredMadrasaList";
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
  type MadrasaCleanPayload,
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
import { madrasasProgressText } from "./madrasas.progress.text";
import ProgressOverlay from "@madrasha/shared-ui/src/components/ui/ProgressOverlay";
import { useProgressTask } from "@madrasha/shared-ui/src/components/ui/useProgressTask";
import { Building2, CheckCircle2, CirclePause, Layers, Hash, Trash2, X, Globe2, Settings2, CreditCard, Save } from "lucide-react";
import "./institutions.css";

export type Madrasa = {
  id: number;
  madrasa_no?: number | null;
  name: string;
  slug: string;
  is_active: number;
  plan_id?: number | null;
  plan_name: string | null;
  student_limit: number;
  user_limit: number;
  website_status?: string;
  custom_domain?: string | null;
  admin_domain?: string | null;
  address?: string | null;
  phone?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  institution_type?: InstitutionType;
  /** Effective default language (list rows resolve the type default). */
  default_language?: Lang;
};

export type Plan = AdminPlan;

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
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const progressTask = useProgressTask();

  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
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
    setLoadError(false);

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
        // A deletion can empty the last page. Return to the last valid page.
        const lastPage = Math.max(1, Math.ceil(Number(data.meta.total) / limit));
        if (page > lastPage) setPage(lastPage);
      } else {
        setTotal(0);
      }
    } catch (err) {
      setLoadError(true);
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
        setPlans([...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
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
    const p = getText(madrasasProgressText);
    try {
      await progressTask.run(
        {
          title: p.createTitle,
          estimate: { msPerStep: 1300 },
          steps: [
            p.createStepValidate,
            p.createStepInstitution,
            p.createStepPlan,
            p.createStepSetup,
            p.createStepUsers,
          ],
        },
        () => createMadrasa(payload),
      );

      setOpenCreate(false);
      if (page === 1) {
        await fetchAll();
      } else {
        // The page effect fetches page 1 so the new institution appears first.
        setPage(1);
      }
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
          const p = getText(madrasasProgressText);
          await progressTask.run(
            { title: p.trashTitle, estimate: { msPerStep: 700 }, steps: [p.trashStepSuspend, p.trashStepMove] },
            () => trashMadrasa(m.id),
          );
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

  const onCleanConfirm = async (payload: MadrasaCleanPayload) => {
    if (!cleaningTarget) return;
    setCleanBusy(true);
    try {
      const p = getText(madrasasProgressText);
      await progressTask.run(
        {
          title: p.cleanTitle,
          estimate: { msPerStep: 1500 },
          steps: [p.cleanStepVerify, p.cleanStepWipe, p.cleanStepFinal],
        },
        () => cleanMadrasaData(cleaningTarget.id, payload),
      );
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
          const p = getText(madrasasProgressText);
          const lang = getLang();
          // Sequential so the counter is real: "3 / 8" means 3 are in the trash.
          await progressTask.run(
            {
              title: p.trashTitle,
              steps: ids.map((_, i) => p.trashItem(formatNumber(i + 1, lang), formatNumber(ids.length, lang))),
            },
            async ({ advance }) => {
              for (const id of ids) {
                try {
                  await trashMadrasa(id);
                } catch (err) {
                  logger.error("Bulk delete item failed:", err);
                }
                advance();
              }
            },
          );
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
    <div className="institutions-page space-y-5">
      {/* Header */}
      <div className="institutions-header flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300"><Building2 size={18} aria-hidden="true" />{t.directory}</p>
          <h1 className="text-xl font-bold dark:text-slate-100 sm:text-2xl">{t.title}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{t.subtitle}</p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link to="/madrasas/trash" className="flex-1 sm:flex-none">
            <Button variant="secondary" className="flex w-full items-center justify-center gap-2 sm:w-auto">
              <Trash2 size={16} aria-hidden="true" />
              {t.trash}
            </Button>
          </Link>

          <Button className="flex-1 sm:flex-none" onClick={() => setOpenCreate(true)}>
            {t.createInstitution}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: t.resultsTotal, value: total || items.length, icon: Building2, tone: "teal" },
          { label: t.pageActive, value: items.filter((m) => m.is_active).length, icon: CheckCircle2, tone: "green" },
          { label: t.pageInactive, value: items.filter((m) => !m.is_active).length, icon: CirclePause, tone: "amber" },
          { label: t.availablePlans, value: plans.length, icon: Layers, tone: "violet" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="institutions-stat flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" data-tone={tone}>
            <span className="institutions-stat-icon hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:flex"><Icon size={21} aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{loading ? "—" : formatNumber(value, lang)}</p></div>
          </div>
        ))}
      </div>
      <ExpiredMadrasaList />

      <section aria-label={t.filterByType} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {/* Institution type filter */}
      <div
        className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        role="group"
        aria-label={t.filterByType}
      >
        {([""] as (InstitutionType | "")[]).concat(INSTITUTION_TYPES).map((type) => {
          const active = typeFilter === type;
          return (
            <button
              key={type || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setTypeFilter(type);
                setPage(1);
              }}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
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
      </section>

      <p className="flex items-start gap-2 px-1 text-sm leading-6 text-slate-500 dark:text-slate-400"><Hash size={17} className="mt-1 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />{t.numberHint}</p>

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
      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <span>{t.loadFailed}</span><Button variant="secondary" onClick={fetchAll}>{t.retry}</Button>
        </div>
      ) : <MadrasasTable
        loading={loading}
        items={items}
        totalItems={total || items.length}
        serialOffset={(page - 1) * limit}
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
      />}

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

      <ProgressOverlay {...progressTask.overlayProps} />
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
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot>();
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);
  const [domainBusy, setDomainBusy] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);
  const tc = useText(createMadrasaText);
  const pt = useText(planToolsText);
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
    admin_domain: madrasa.admin_domain || "",
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
        user_limit: Number(plan.userLimit ?? 0),
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
  const [setupError, setSetupError] = useState(false);

  // Load master data + this madrasa's currently active divisions/modules
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingSetup(true);
      setSetupError(false);
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
        setSnapshot(detail.subscription);
        const detailType: InstitutionType = detail.institution_type || madrasa.institution_type || "MADRASA";
        setInstitutionType(detailType);
        setDefaultLanguage(normalizeDefaultLanguage(detailType, detail.default_language || ""));
        setDivisions((detail.divisions || []).map((id: number) => String(id)));
        setModules((detail.modules || []).map((id: number) => String(id)));
      } catch (err) {
        if (!cancelled) setSetupError(true);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-5">
      <div role="dialog" aria-modal="true" aria-labelledby="institution-edit-title" className="institution-edit-dialog flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="institution-edit-header flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:px-7">
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"><Building2 size={24} /></span>
            <div className="min-w-0">
              <h2 id="institution-edit-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">{t.editTitle}</h2>
              <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">#{madrasa.madrasa_no ?? madrasa.id} · {madrasa.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy || domainBusy || refundBusy} aria-label={c.cancel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"><X size={21} /></button>
        </div>
        <div className="institution-edit-body min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950/40 sm:p-6">
        {setupError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{t.setupFailed}</p>}
        <div className="institution-edit-section grid gap-5 md:grid-cols-2">
          <EditSectionHeading icon={<Building2 size={19} />} title={t.basicSection} hint={t.basicHint} />
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
          <EditSectionHeading icon={<CreditCard size={19} />} title={t.planSection} hint={t.planHint} divider />
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
            <p className="self-end rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{pt.unlimited}</p>
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
          <EditSectionHeading icon={<Globe2 size={19} />} title={t.webSection} hint={t.webHint} divider />
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
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-semibold dark:text-slate-200">{t.adminDomain}</label>
          <input className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="admin.example.com" value={form.admin_domain}
            onChange={(e) => update("admin_domain", e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{t.adminDomainHint}</p>
        </div>
        </div>

        <div className="institution-edit-section mt-5"><DomainAddOnFields madrasaId={madrasa.id} connectedDomain={form.custom_domain} prices={snapshot?.custom_domain_prices} onBusyChange={setDomainBusy} onConnectedChange={(domain) => { update("custom_domain", domain); setSubscriptionVersion((value) => value + 1); }} /></div>
        <div className="institution-edit-section mt-5"><MadrasaSubscriptionCard key={subscriptionVersion} madrasaId={madrasa.id} onBusyChange={setRefundBusy} /></div>

        {/* System Setup — same as Create Madrasa (Classes/Books stay hidden and auto-derive) */}
        <div className="institution-edit-section mt-5 space-y-4">
          <EditSectionHeading icon={<Settings2 size={19} />} title={t.setupSection} hint={t.setupHint} />
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
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:justify-end sm:px-6">
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose} disabled={busy || domainBusy || refundBusy}>
            {c.cancel}
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() =>
              onSubmit({
                ...form,
                institution_type: institutionType,
                default_language: defaultLanguage || null,
                plan_id: form.plan_id && form.plan_id !== String(madrasa.plan_id ?? "") ? Number(form.plan_id) : undefined,
                start_date: form.plan_id ? form.start_date : undefined,
                divisions: divisions.map(Number),
                modules: modules.map(Number),
                classes: classes.map(Number),
                books: books.map(Number),
              } as any)
            }
            disabled={busy || loadingSetup || setupError || domainBusy || refundBusy}
          >
            <Save size={17} aria-hidden="true" />
            {busy ? c.saving : t.saveChanges}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditSectionHeading({ icon, title, hint, divider = false }: { icon: React.ReactNode; title: string; hint: string; divider?: boolean }) {
  return (
    <div className={`flex items-start gap-3 md:col-span-2 ${divider ? "mt-2 border-t border-slate-200 pt-6 dark:border-slate-800" : ""}`}>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">{icon}</span>
      <div><h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p></div>
    </div>
  );
}
