import PlanManagementCard from "./PlanManagementCard";
import {
  Package,
  Search,
  LayoutGrid,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import PlanCard from "@madrasha/shared-ui/src/components/plans/PlanCard";
import PlanEditorFields, {
  displayDraft,
  displayPayload,
  type PlanDisplayDraft,
} from "./PlanEditorFields";
import {
  getPlanDefaults,
  updatePlanDisplay,
  type PlanDisplayFields,
  type PlanDefaults,
} from "../../../services/subscriptionApi";
import { planToolsText } from "./plan-tools.text";
import { useEffect, useMemo, useState } from "react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import ConfirmModal from "@madrasha/shared-ui/src/components/ui/ConfirmModal";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";

import {
  listPlansAdmin as fetchPlans,
  listTrashPlans,
  createPlan,
  updatePlan,
  togglePlan,
  deletePlan, // ✅ moves to trash
  restorePlan,
  permanentDeletePlan,
} from "../../../services/superAdminApi";
import {
  catalogDivisionApi,
  type CatalogDivisionDto,
} from "../../../services/superAdminCatalogApi";
import {
  INSTITUTION_TYPE_LABELS,
  LOCALE_MAP,
  commonText,
  formatNumber,
  getLang,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { plansText } from "./plans.text";

type Plan = Partial<PlanDisplayFields> & {
  id: number;
  name: string;
  studentLimit: number;
  userLimit: number;
  durationDays: number;
  price: number;
  isActive: number | boolean;
  deletedAt?: string | null;
  regBlocks?: { divisionId: number; blockSize: number }[];
};

type PlanForm = PlanDisplayDraft & {
  name: string;
  student_limit: number;
  user_limit: number;
  duration_days: number;
  price: number;
  is_active: 0 | 1;
};

/** divisionId -> block size text, as typed (empty = no automatic block). */
type RegBlockDraft = Record<number, string>;

function formSignature(form: PlanForm, price: string, blocks: RegBlockDraft) {
  return JSON.stringify({
    ...form,
    ...displayPayload(form),
    name: form.name.trim(),
    price: Number(price || 0),
    blocks: Object.entries(blocks)
      .map(([id, size]) => [Number(id), Number(size || 0)])
      .filter(([, size]) => size !== 0)
      .sort(([a], [b]) => a - b),
  });
}

const emptyForm: PlanForm = {
  ...displayDraft(),
  name: "",
  student_limit: 100,
  user_limit: 0,
  duration_days: 365,
  price: 0,
  is_active: 1,
};

function fmtMoney(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString(LOCALE_MAP[getLang()], { maximumFractionDigits: 2 });
}

// allow digits + one dot, max 2 decimals
function sanitizePriceText(input: string) {
  const cleaned = input.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const intPart = (parts[0] || "0").replace(/^0+(?=\d)/, "");
  if (parts.length === 1) return intPart || "0";
  const dec = (parts[1] || "").replace(/[^\d]/g, "").slice(0, 2);
  return `${intPart || "0"}.${dec}`;
}

export default function SuperAdminPlansPage() {
  const { show } = useToastStore();
  const t = useText(plansText);
  const c = useText(commonText);
  const pt = useText(planToolsText);
  const [displayBusy, setDisplayBusy] = useState<number | null>(null);
  const [resetDraft, setResetDraft] = useState<PlanDefaults | null>(null);
  const lang = useLang();
  const n = (v: number) => formatNumber(v, lang);

  // tabs: "plans" | "trash"
  const [tab, setTab] = useState<"plans" | "trash">("plans");

  const [rows, setRows] = useState<Plan[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [trashRows, setTrashRows] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [active, setActive] = useState<"all" | "1" | "0">("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // price input as text (for formatting/sanitize)
  const [priceText, setPriceText] = useState("0");
  const [divisions, setDivisions] = useState<CatalogDivisionDto[]>([]);
  const [regBlocks, setRegBlocks] = useState<RegBlockDraft>({});
  const [initialForm, setInitialForm] = useState("");
  const isDirty =
    !editing || formSignature(form, priceText, regBlocks) !== initialForm;

  // confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMode, setConfirmMode] = useState<
    "trash" | "restore" | "permanent"
  >("trash");
  const [target, setTarget] = useState<Plan | null>(null);

  const modalTitle = useMemo(
    () => (editing ? t.editPlanTitle(String(editing.id)) : t.createPlanTitle),
    [editing, t],
  );

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await fetchPlans({ q, active });
      setOrderCount(
        res?.meta?.totalPlans ??
          Math.max(
            (res?.data || []).length,
            ...(res?.data || []).map((p: Plan) => p.sortOrder ?? 0),
          ),
      );
      setRows(
        ((res?.data || []) as Plan[]).sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id,
        ),
      );
    } catch (e: any) {
      show(e?.response?.data?.message || t.loadFailed, "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadTrash() {
    setLoading(true);
    try {
      const res = await listTrashPlans();
      setTrashRows((res?.data || []) as Plan[]);
    } catch (e: any) {
      show(e?.response?.data?.message || t.trashLoadFailed, "error");
    } finally {
      setLoading(false);
    }
  }

  async function load() {
    if (tab === "plans") await loadPlans();
    else await loadTrash();
  }

  useEffect(() => {
    catalogDivisionApi
      .list()
      .then((res) => setDivisions(res?.data?.data || []))
      .catch(() => setDivisions([]));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "plans") return;
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, active]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      sortOrder: orderCount + 1,
    });
    setPriceText("0");
    setRegBlocks({});
    setOpen(true);
  }

  function openEdit(p: Plan) {
    setEditing(p);
    const draft: PlanForm = {
      ...displayDraft(p),
      name: p.name ?? "",
      student_limit: Number(p.studentLimit ?? 0),
      user_limit: Number(p.userLimit ?? 0),
      duration_days: Number(p.durationDays ?? 0),
      price: Number(p.price ?? 0),
      is_active: p.isActive ? 1 : 0,
    };
    const price = String(Number(p.price ?? 0));
    const blocks = Object.fromEntries(
      (p.regBlocks || []).map((b) => [b.divisionId, String(b.blockSize)]),
    );
    setForm(draft);
    setPriceText(price);
    setRegBlocks(blocks);
    setInitialForm(formSignature(draft, price, blocks));
    setOpen(true);
  }

  function validate(): string | null {
    const priceNum = Number(priceText || 0);

    if (
      !Number.isInteger(form.sortOrder) ||
      form.sortOrder < 0 ||
      (form.accentColor &&
        !/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(form.accentColor.trim())) ||
      [
        form.renewalPrice,
        form.extraStudentPriceFirst,
        form.extraStudentPriceRenewal,
      ].some((v) => v !== null && (!Number.isFinite(v) || v < 0)) ||
      (form.renewalPrice !== null && form.renewalPrice > priceNum)
    )
      return pt.invalid;
    if (!form.name.trim()) return t.errName;
    if (form.student_limit < 0) return t.errStudentLimit;
    if (form.user_limit < 0) return t.errUserLimit;
    if (form.duration_days <= 0) return t.errDuration;
    if (Number.isNaN(priceNum) || priceNum < 0) return t.errPrice;
    for (const d of divisions) {
      const v = (regBlocks[d.id] || "").trim();
      if (v && (!/^\d+$/.test(v) || Number(v) > 100000)) return t.errRegBlock;
    }

    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || (editing && !isDirty)) return;
    const err = validate();
    if (err) {
      show(err, "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        ...displayPayload(form),
        price: Number(priceText || 0),
      };
      const reg_block_sizes = divisions.map((d) => ({
        division_id: d.id,
        block_size: Number((regBlocks[d.id] || "").trim() || 0),
      }));

      if (editing) {
        const response = await updatePlan(editing.id, {
          ...payload,
          reg_block_sizes,
        });
        response?.warnings?.forEach((warning: string) => show(warning, "info"));
        show(t.updated, "success");
      } else {
        const response = await createPlan({ ...payload, reg_block_sizes });
        response?.warnings?.forEach((warning: string) => show(warning, "info"));
        show(t.created, "success");
      }

      setOpen(false);
      await loadPlans();
    } catch (e2: any) {
      show(e2?.response?.data?.message || t.saveFailed, "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeDisplay(p: Plan, patch: Partial<PlanDisplayFields>) {
    setDisplayBusy(p.id);
    try {
      const response = await updatePlanDisplay(p.id, patch);
      response.warnings?.forEach((warning) => show(warning, "info"));
      await loadPlans();
      show(pt.visibilitySaved, "success");
    } catch {
      show(pt.failed, "error");
    } finally {
      setDisplayBusy(null);
    }
  }

  async function resetDefaults() {
    if (!editing) return;
    try {
      const defaults = await getPlanDefaults(editing.id);
      if (!defaults) {
        show(pt.noDefaults, "info");
        return;
      }
      setResetDraft(defaults);
    } catch {
      show(pt.failed, "error");
    }
  }

  async function onToggle(id: number) {
    try {
      await togglePlan(id);
      show(t.statusUpdated, "success");
      await loadPlans();
    } catch (e: any) {
      show(e?.response?.data?.message || t.toggleFailed, "error");
    }
  }

  function openConfirm(mode: "trash" | "restore" | "permanent", p: Plan) {
    setConfirmMode(mode);
    setTarget(p);
    setConfirmOpen(true);
  }

  async function runConfirmAction() {
    if (!target) return;
    setConfirmLoading(true);

    try {
      if (confirmMode === "trash") {
        await deletePlan(target.id);
        show(t.movedToTrash, "success");
        setConfirmOpen(false);
        await loadPlans();
      }

      if (confirmMode === "restore") {
        await restorePlan(target.id);
        show(t.restored, "success");
        setConfirmOpen(false);
        await loadTrash();
      }

      if (confirmMode === "permanent") {
        await permanentDeletePlan(target.id);
        show(t.permanentlyDeleted, "success");
        setConfirmOpen(false);
        await loadTrash();
      }
    } catch (e: any) {
      show(e?.response?.data?.message || t.actionFailed, "error");
    } finally {
      setConfirmLoading(false);
      setTarget(null);
    }
  }

  const confirmTitle =
    confirmMode === "trash"
      ? t.confirmTrashTitle
      : confirmMode === "restore"
        ? t.confirmRestoreTitle
        : t.confirmPermanentTitle;

  const confirmMessage =
    confirmMode === "trash"
      ? t.confirmTrashMessage(target?.name ?? "")
      : confirmMode === "restore"
        ? t.confirmRestoreMessage(target?.name ?? "")
        : t.confirmPermanentMessage(target?.name ?? "");

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold dark:text-slate-100">
            {t.title}
          </h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            {t.catalogHint}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("plans")}
            className={[
              "flex-1 rounded-xl px-4 py-2 text-sm font-medium sm:flex-none",
              tab === "plans"
                ? "bg-emerald-600 text-white"
                : "border bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")}
          >
            {t.tabPlans}
          </button>

          <button
            onClick={() => setTab("trash")}
            className={[
              "flex-1 rounded-xl px-4 py-2 text-sm font-medium sm:flex-none",
              tab === "trash"
                ? "bg-emerald-600 text-white"
                : "border bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")}
          >
            {t.tabTrash}
          </button>

          {tab === "plans" && (
            <button
              onClick={openCreate}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:flex-none"
            >
              {t.newPlan}
            </button>
          )}
        </div>
      </div>

      {/* Filters (Plans tab only) */}
      {tab === "plans" && (
        <div className="mt-5 grid gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="mb-1 block text-xs text-gray-600 dark:text-slate-400">
              {t.search}
            </label>
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <Search
                size={17}
                aria-hidden="true"
                className="shrink-0 text-slate-400"
              />
              <input
                className="w-full bg-transparent text-sm outline-none dark:text-slate-100"
                placeholder={t.searchPlaceholder}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs text-gray-600 dark:text-slate-400">
              {t.status}
            </label>
            <select
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={active}
              onChange={(e) => setActive(e.target.value as "all" | "1" | "0")}
            >
              <option value="all">{t.all}</option>
              <option value="1">{t.active}</option>
              <option value="0">{t.inactive}</option>
            </select>
          </div>

          <div className="md:col-span-4 flex items-end gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {loading ? c.loading : t.refresh}
            </button>

            <div className="text-xs text-gray-500 dark:text-slate-400">
              {t.total}:{" "}
              <span className="font-medium text-gray-800 dark:text-slate-100">
                {n(rows.length)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Trash summary */}
      {tab === "trash" && (
        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {loading ? c.loading : t.refreshTrash}
          </button>

          <div className="text-xs text-gray-500 dark:text-slate-400">
            {t.totalTrash}:{" "}
            <span className="font-medium text-gray-800 dark:text-slate-100">
              {n(trashRows.length)}
            </span>
          </div>
        </div>
      )}

      {tab === "plans" && (
        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
          {[
            {
              label: t.total,
              value: rows.length,
              icon: LayoutGrid,
              color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40",
            },
            {
              label: t.active,
              value: rows.filter((p) => !!p.isActive).length,
              icon: CheckCircle2,
              color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
            },
            {
              label: t.featuredCount,
              value: rows.filter((p) => !!p.isFeatured).length,
              icon: Sparkles,
              color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4"
            >
              <span className={"hidden rounded-xl p-2.5 sm:block " + color}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {loading ? "—" : n(value)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div
        className="mt-6 grid items-stretch gap-5 md:grid-cols-2 2xl:grid-cols-3"
        aria-busy={loading}
      >
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
              >
                <SkeletonList items={4} />
              </div>
            ))
          : (tab === "plans" ? rows : trashRows).map((p) => (
              <PlanManagementCard
                key={p.id}
                plan={p}
                divisions={divisions}
                trash={tab === "trash"}
                busy={displayBusy !== null}
                orderCount={orderCount}
                onEdit={() => openEdit(p)}
                onToggle={() => void onToggle(p.id)}
                onTrash={() => openConfirm("trash", p)}
                onRestore={() => openConfirm("restore", p)}
                onPermanent={() => openConfirm("permanent", p)}
                onDisplay={(patch) => void changeDisplay(p, patch)}
              />
            ))}
        {!loading && (tab === "plans" ? rows : trashRows).length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <Package
              size={32}
              className="mx-auto mb-4 text-slate-300"
              aria-hidden="true"
            />
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              {tab === "plans" ? t.noPlans : t.trashEmpty}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {tab === "plans" ? t.noPlansHint : t.trashEmptyHint}
            </p>
            {tab === "plans" && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {t.newPlan}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={open}
        title={modalTitle}
        onClose={() => {
          if (!saving) setOpen(false);
        }}
        maxWidthClassName="max-w-6xl"
      >
        <form
          onSubmit={onSubmit}
          className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]"
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="plan-name" className="text-xs text-gray-600">
                {t.planName}
              </label>
              <input
                id="plan-name"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                placeholder={t.planNamePlaceholder}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <label
                  htmlFor="plan-student-limit"
                  className="text-xs text-gray-600"
                >
                  {t.studentLimit}
                </label>
                <input
                  id="plan-student-limit"
                  type="number"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  value={form.student_limit}
                  onChange={(e) =>
                    setForm({ ...form, student_limit: Number(e.target.value) })
                  }
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="plan-duration"
                  className="text-xs text-gray-600"
                >
                  {t.durationDays}
                </label>
                <input
                  id="plan-duration"
                  type="number"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  value={form.duration_days}
                  onChange={(e) =>
                    setForm({ ...form, duration_days: Number(e.target.value) })
                  }
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="plan-first-price"
                  className="text-xs text-gray-600"
                >
                  {pt.firstPrice}{" "}
                  <span className="text-[11px] text-gray-400">
                    (৳ {fmtMoney(priceText)})
                  </span>
                </label>
                <input
                  id="plan-first-price"
                  inputMode="decimal"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  value={priceText}
                  onChange={(e) =>
                    setPriceText(sanitizePriceText(e.target.value))
                  }
                  onBlur={() => {
                    const n = Number(priceText || 0);
                    setPriceText(String(Number.isNaN(n) ? 0 : n));
                  }}
                />
              </div>
            </div>

            <PlanEditorFields
              orderCount={orderCount + (editing ? 0 : 1)}
              value={form}
              onChange={(patch) =>
                setForm((current) => ({ ...current, ...patch }))
              }
            />
            {editing && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void resetDefaults()}
                className="justify-self-start rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
              >
                {pt.reset}
              </button>
            )}
            {divisions.length > 0 && (
              <div className="grid gap-2 rounded-xl border p-3 dark:border-slate-700">
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-slate-200">
                    {t.regBlockTitle}
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-slate-400">
                    {t.regBlockHint}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {divisions.map((d) => (
                    <div key={d.id} className="grid gap-1">
                      <label className="truncate text-xs text-gray-600 dark:text-slate-400">
                        {d.label || d.name}
                        <span className="ms-1 text-[10px] text-gray-400 dark:text-slate-500">
                          (
                          {
                            INSTITUTION_TYPE_LABELS[
                              d.institution_type ?? "MADRASA"
                            ][lang]
                          }
                          )
                        </span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        placeholder="0"
                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                        value={regBlocks[d.id] ?? ""}
                        onChange={(e) =>
                          setRegBlocks({ ...regBlocks, [d.id]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked ? 1 : 0 })
                }
              />
              <span className="text-gray-700">{t.active}</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              >
                {c.cancel}
              </button>

              {isDirty && (
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? c.saving : editing ? c.update : c.create}
                </button>
              )}
            </div>
          </div>
          <aside className="min-w-0 space-y-3 lg:sticky lg:top-0">
            <h3 className="text-sm font-semibold dark:text-slate-100">
              {pt.preview}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {pt.previewHint}
            </p>
            <PlanCard
              preview
              plan={{
                ...form,
                studentLimit: form.student_limit,
                price: Number(priceText || 0),
              }}
            />
          </aside>
        </form>
      </Modal>

      <ConfirmModal
        open={!!resetDraft}
        title={pt.resetTitle}
        message={pt.resetMessage}
        confirmText={pt.reset}
        onClose={() => setResetDraft(null)}
        onConfirm={() => {
          if (!resetDraft) return;
          setForm({
            ...displayDraft(resetDraft),
            name: resetDraft.name,
            student_limit: resetDraft.studentLimit,
            user_limit: 0,
            duration_days: resetDraft.durationDays,
            price: Number(resetDraft.price),
            is_active: resetDraft.isActive ? 1 : 0,
          });
          setPriceText(String(resetDraft.price));
          setResetDraft(null);
        }}
      />
      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={
          confirmMode === "trash"
            ? t.moveToTrash
            : confirmMode === "restore"
              ? t.restore
              : t.permanentDelete
        }
        cancelText={c.cancel}
        danger={confirmMode === "permanent"}
        loading={confirmLoading}
        onClose={() => {
          if (confirmLoading) return;
          setConfirmOpen(false);
          setTarget(null);
        }}
        onConfirm={runConfirmAction}
      />
    </div>
  );
}
