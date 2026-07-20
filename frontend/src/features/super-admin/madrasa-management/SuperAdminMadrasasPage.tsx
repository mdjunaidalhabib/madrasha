import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "../../../components/ui/Button";
import {
  activateMadrasa,
  assignPlan,
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
import DivisionsSection from "../../../components/super-admin/create-madrasa/DivisionsSection";
import ToggleSection from "../../../components/super-admin/create-madrasa/ToggleSection";
import MadrasaUsersSection from "../../../components/super-admin/create-madrasa/MadrasaUsersSection";
import { Link } from "react-router-dom";
import { CreateMadrasaPayload } from "../../../components/super-admin/create-madrasa/types";
import api, { cachedGet } from "../../../services/adminApi";
import { logger } from "../../../utils/logger";
import { useConfirmStore } from "../../../store/confirmStore";

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
  address?: string | null;
  phone?: string | null;
};

export type Plan = {
  id: number;
  name: string;
  student_limit: number;
  user_limit: number;
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
  const [items, setItems] = useState<Madrasa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [q, setQ] = useState("");
  const dq = useDebounce(q, 350);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [total, setTotal] = useState<number>(0);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Madrasa | null>(null);

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
      });

      const rows = Array.isArray(data) ? data : (data.data ?? []);
      setItems(rows);

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
  }, [dq, page, limit]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
    useConfirmStore.getState().show({
      title: "Move to Trash",
      message: `Move "${m.name}" to Trash?`,
      confirmText: "Move to Trash",
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
        <div>
          <h1 className="text-2xl font-bold">All Madrasas</h1>
          <p className="text-sm text-gray-600">Platform-wide madrasa list</p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link to="/admin/madrasas/trash" className="flex-1 sm:flex-none">
            <Button variant="secondary" className="w-full sm:w-auto">
              Trash
            </Button>
          </Link>

          <Button className="flex-1 sm:flex-none" onClick={() => setOpenCreate(true)}>
            + Create Madrasa
          </Button>
        </div>
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
    </div>
  );
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
  const [form, setForm] = useState({
    name: madrasa.name || "",
    slug: madrasa.slug || "",
    address: madrasa.address || "",
    phone: madrasa.phone || "",
    student_limit: Number(madrasa.student_limit || 0),
    user_limit: Number(madrasa.user_limit || 0),
    is_active: Number(madrasa.is_active || 0),
    website_status: madrasa.website_status || "active",
    plan_id: madrasa.plan_id ? String(madrasa.plan_id) : "",
  });

  const update = (key: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /* =========================
  System Setup (same fields as Create Madrasa)
  ========================= */
  type Item = { key: string; label: string };

  const [divisionItems, setDivisionItems] = useState<Item[]>([]);
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

        const divData = (divRes.data?.data || []).map((r: any) => ({
          key: String(r.id),
          label: r.label || r.name,
        }));
        const modData = (modRes.data?.data || []).map((r: any) => ({
          key: String(r.id),
          label: r.label || r.name,
        }));

        setDivisionItems(divData);
        setModuleItems(modData);
        setAllClasses(classRes.data?.data || []);
        setAllBooks(bookRes.data?.data || []);

        const detail = detailRes?.data || {};
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-900">Edit Madrasa</h2>
          <p className="text-sm text-slate-500">
            মাদ্রাসার basic info, limit, status, website status এবং plan update করুন।
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">Name</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Slug</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Phone</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.phone || ""}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Plan</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={form.plan_id}
              onChange={(e) => update("plan_id", e.target.value)}
            >
              <option value="">No change</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Student Limit</label>
            <input
              type="number"
              className="w-full rounded border px-3 py-2"
              value={form.student_limit}
              onChange={(e) => update("student_limit", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">User Limit</label>
            <input
              type="number"
              className="w-full rounded border px-3 py-2"
              value={form.user_limit}
              onChange={(e) => update("user_limit", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Madrasa Status</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={form.is_active}
              onChange={(e) => update("is_active", Number(e.target.value))}
            >
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Website Status</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={form.website_status}
              onChange={(e) => update("website_status", e.target.value)}
            >
              <option value="active">Active</option>
              <option value="limited">Limited</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold">Address</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.address || ""}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
        </div>

        {/* System Setup — same as Create Madrasa (Classes/Books stay hidden and auto-derive) */}
        <div className="mt-6 space-y-4">
          {loadingSetup ? (
            <p className="text-sm text-gray-500">Loading divisions & modules...</p>
          ) : (
            <>
              <DivisionsSection items={divisionItems} divisions={divisions} setDivisions={setDivisions} />

              <ToggleSection
                title="Modules"
                items={moduleItems}
                selected={modules}
                setSelected={setModules}
              />

              <MadrasaUsersSection madrasaId={madrasa.id} />
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                ...form,
                plan_id: form.plan_id ? Number(form.plan_id) : undefined,
                divisions: divisions.map(Number),
                modules: modules.map(Number),
                classes: classes.map(Number),
                books: books.map(Number),
              } as any)
            }
            disabled={busy || loadingSetup}
          >
            {busy ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
