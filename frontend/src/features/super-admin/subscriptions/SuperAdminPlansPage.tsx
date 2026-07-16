import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { useToastStore } from "../../../store/toastStore";

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

type Plan = {
  id: number;
  name: string;
  student_limit: number;
  user_limit: number;
  duration_days: number;
  price: number;
  is_active: number | boolean;
  deleted_at?: string | null;
};

type PlanForm = {
  name: string;
  student_limit: number;
  user_limit: number;
  duration_days: number;
  price: number;
  is_active: 0 | 1;
};

const emptyForm: PlanForm = {
  name: "",
  student_limit: 100,
  user_limit: 5,
  duration_days: 365,
  price: 0,
  is_active: 1,
};

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700",
      ].join(" ")}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function fmtMoney(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-BD", { maximumFractionDigits: 2 });
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

function IconButton({
  children,
  onClick,
  title,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  variant?: "default" | "danger" | "warn";
}) {
  const cls =
    variant === "danger"
      ? "rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
      : variant === "warn"
        ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100"
        : "rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 active:scale-[0.99]";

  return (
    <button type="button" onClick={onClick} title={title} className={cls}>
      {children}
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 w-full rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  );
}

export default function SuperAdminPlansPage() {
  const { show } = useToastStore();

  // tabs: "plans" | "trash"
  const [tab, setTab] = useState<"plans" | "trash">("plans");

  const [rows, setRows] = useState<Plan[]>([]);
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

  // confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"trash" | "restore" | "permanent">("trash");
  const [target, setTarget] = useState<Plan | null>(null);

  const modalTitle = useMemo(
    () => (editing ? `Edit Plan — #${editing.id}` : "Create New Plan"),
    [editing],
  );

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await fetchPlans({ q, active });
      setRows((res?.data || []) as Plan[]);
    } catch (e: any) {
      show(e?.response?.data?.message || "Load failed", "error");
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
      show(e?.response?.data?.message || "Trash load failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function load() {
    if (tab === "plans") await loadPlans();
    else await loadTrash();
  }

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
    setForm(emptyForm);
    setPriceText("0");
    setOpen(true);
  }

  function openEdit(p: Plan) {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      student_limit: Number(p.student_limit ?? 0),
      user_limit: Number(p.user_limit ?? 0),
      duration_days: Number(p.duration_days ?? 0),
      price: Number(p.price ?? 0),
      is_active: p.is_active ? 1 : 0,
    });
    setPriceText(String(Number(p.price ?? 0)));
    setOpen(true);
  }

  function validate(): string | null {
    const priceNum = Number(priceText || 0);

    if (!form.name.trim()) return "Plan নাম দিন";
    if (form.student_limit < 0) return "Student limit 0 বা তার বেশি হতে হবে";
    if (form.user_limit < 0) return "User limit 0 বা তার বেশি হতে হবে";
    if (form.duration_days <= 0) return "Duration days 1 বা তার বেশি হতে হবে";
    if (Number.isNaN(priceNum) || priceNum < 0) return "Price 0 বা তার বেশি হতে পারবে না";

    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      show(err, "error");
      return;
    }

    setSaving(true);
    try {
      const payload: PlanForm = {
        ...form,
        price: Number(priceText || 0),
      };

      if (editing) {
        await updatePlan(editing.id, payload);
        show("Plan আপডেট হয়েছে", "success");
      } else {
        await createPlan(payload);
        show("Plan তৈরি হয়েছে", "success");
      }

      setOpen(false);
      await loadPlans();
    } catch (e2: any) {
      show(e2?.response?.data?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(id: number) {
    try {
      await togglePlan(id);
      show("Status updated", "success");
      await loadPlans();
    } catch (e: any) {
      show(e?.response?.data?.message || "Toggle failed", "error");
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
        show("Plan trash এ পাঠানো হয়েছে", "success");
        setConfirmOpen(false);
        await loadPlans();
      }

      if (confirmMode === "restore") {
        await restorePlan(target.id);
        show("Plan restore হয়েছে", "success");
        setConfirmOpen(false);
        await loadTrash();
      }

      if (confirmMode === "permanent") {
        await permanentDeletePlan(target.id);
        show("Plan permanently deleted", "success");
        setConfirmOpen(false);
        await loadTrash();
      }
    } catch (e: any) {
      show(e?.response?.data?.message || "Action failed", "error");
    } finally {
      setConfirmLoading(false);
      setTarget(null);
    }
  }

  const confirmTitle =
    confirmMode === "trash"
      ? "Move to Trash?"
      : confirmMode === "restore"
        ? "Restore Plan?"
        : "Permanent Delete?";

  const confirmMessage =
    confirmMode === "trash"
      ? `Plan "${target?.name ?? ""}" trash এ যাবে (restore করা যাবে)।`
      : confirmMode === "restore"
        ? `Plan "${target?.name ?? ""}" আবার active list এ ফিরে আসবে।`
        : `Plan "${target?.name ?? ""}" permanently delete হবে (ফিরিয়ে আনা যাবে না)।`;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Plans</h1>
          <p className="text-sm text-gray-600">Super Admin এখান থেকে pricing/limits manage করবে।</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab("plans")}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium",
              tab === "plans"
                ? "bg-black text-white"
                : "border bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            Plans
          </button>

          <button
            onClick={() => setTab("trash")}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium",
              tab === "trash"
                ? "bg-black text-white"
                : "border bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            Trash
          </button>

          {tab === "plans" && (
            <button
              onClick={openCreate}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
            >
              + New Plan
            </button>
          )}
        </div>
      </div>

      {/* Filters (Plans tab only) */}
      {tab === "plans" && (
        <div className="mt-5 grid gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="mb-1 block text-xs text-gray-600">Search</label>
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
              <span className="text-gray-400">🔎</span>
              <input
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Plan name দিয়ে খুঁজুন..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs text-gray-600">Status</label>
            <select
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none"
              value={active}
              onChange={(e) => setActive(e.target.value as "all" | "1" | "0")}
            >
              <option value="all">All</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>

          <div className="md:col-span-4 flex items-end gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>

            <div className="text-xs text-gray-500">
              Total: <span className="font-medium text-gray-800">{rows.length}</span>
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
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh Trash"}
          </button>

          <div className="text-xs text-gray-500">
            Total Trash: <span className="font-medium text-gray-800">{trashRows.length}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading && (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </>
              )}

              {!loading &&
                tab === "plans" &&
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-gray-700">{p.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-500">Duration: {p.duration_days} days</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.student_limit}</td>
                    <td className="px-4 py-3 text-gray-700">{p.user_limit}</td>
                    <td className="px-4 py-3 text-gray-700">{p.duration_days}</td>
                    <td className="px-4 py-3 text-gray-700">৳ {fmtMoney(p.price)}</td>
                    <td className="px-4 py-3">
                      <Badge active={!!p.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <IconButton title="Edit" onClick={() => openEdit(p)}>
                          ✏️ Edit
                        </IconButton>

                        <IconButton title="Toggle" onClick={() => onToggle(p.id)}>
                          🔁 Toggle
                        </IconButton>

                        <IconButton
                          title="Move to Trash"
                          variant="danger"
                          onClick={() => openConfirm("trash", p)}
                        >
                          🗑 Trash
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading &&
                tab === "trash" &&
                trashRows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-gray-700">{p.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        Deleted: {p.deleted_at ? new Date(p.deleted_at).toLocaleString() : "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.student_limit}</td>
                    <td className="px-4 py-3 text-gray-700">{p.user_limit}</td>
                    <td className="px-4 py-3 text-gray-700">{p.duration_days}</td>
                    <td className="px-4 py-3 text-gray-700">৳ {fmtMoney(p.price)}</td>
                    <td className="px-4 py-3">
                      <Badge active={!!p.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <IconButton
                          title="Restore"
                          variant="warn"
                          onClick={() => openConfirm("restore", p)}
                        >
                          ♻️ Restore
                        </IconButton>

                        <IconButton
                          title="Permanent Delete"
                          variant="danger"
                          onClick={() => openConfirm("permanent", p)}
                        >
                          ❌ Permanent
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && tab === "plans" && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <div className="text-sm font-medium text-gray-800">কোনো Plan পাওয়া যায়নি</div>
                    <div className="text-xs text-gray-500">নতুন Plan যোগ করতে “New Plan” চাপুন</div>
                  </td>
                </tr>
              )}

              {!loading && tab === "trash" && trashRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <div className="text-sm font-medium text-gray-800">Trash খালি</div>
                    <div className="text-xs text-gray-500">কোনো Plan trash এ নেই</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Plan Name</label>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              placeholder="e.g. Basic / Standard"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-xs text-gray-600">Student Limit</label>
              <input
                type="number"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={form.student_limit}
                onChange={(e) => setForm({ ...form, student_limit: Number(e.target.value) })}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-gray-600">User Limit</label>
              <input
                type="number"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={form.user_limit}
                onChange={(e) => setForm({ ...form, user_limit: Number(e.target.value) })}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-gray-600">Duration Days</label>
              <input
                type="number"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-gray-600">
                Price (৳){" "}
                <span className="text-[11px] text-gray-400">(৳ {fmtMoney(priceText)})</span>
              </label>
              <input
                inputMode="decimal"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={priceText}
                onChange={(e) => setPriceText(sanitizePriceText(e.target.value))}
                onBlur={() => {
                  const n = Number(priceText || 0);
                  setPriceText(String(Number.isNaN(n) ? 0 : n));
                }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
            />
            <span className="text-gray-700">Active</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
            >
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={
          confirmMode === "trash"
            ? "Move to Trash"
            : confirmMode === "restore"
              ? "Restore"
              : "Permanent Delete"
        }
        cancelText="Cancel"
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
