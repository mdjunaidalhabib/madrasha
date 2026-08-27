import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { SkeletonList, SkeletonTable } from "../../../components/ui/Skeleton";
import { useToastStore } from "../../../store/toastStore";
import {
  listPackages,
  createPackage,
  updatePackage,
  togglePackage,
  deletePackage,
  type BillingChannel,
  type MessagePackage,
  type PackageType,
} from "../../../services/superAdminBillingApi";
import { Badge, TypeBadge, IconButton, fmtMoney, fmtInt, sanitizeDecimalText } from "./billingHelpers";

type PackageForm = {
  name: string;
  description: string;
  currency: string;
  credit: number;
  validityDays: number;
  type: PackageType;
};

const emptyForm: PackageForm = {
  name: "",
  description: "",
  currency: "BDT",
  credit: 1000,
  validityDays: 30,
  type: "PACKAGE",
};

const creditLabel: Record<BillingChannel, string> = {
  SMS: "SMS Credit",
  EMAIL: "Email Credit",
};

export default function BillingPackagesPanel({ channel }: { channel: BillingChannel }) {
  const { show } = useToastStore();

  const [rows, setRows] = useState<MessagePackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "1" | "0">("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MessagePackage | null>(null);
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [priceText, setPriceText] = useState("0");
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [target, setTarget] = useState<MessagePackage | null>(null);

  const modalTitle = useMemo(
    () => (editing ? `Edit ${channel} Package — #${editing.id}` : `New ${channel} Package`),
    [editing, channel],
  );

  const visibleRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    const wantActive = statusFilter === "1";
    return rows.filter((r) => !!r.isActive === wantActive);
  }, [rows, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const res = await listPackages(channel);
      setRows((res?.data || []) as MessagePackage[]);
    } catch (e: any) {
      show(e?.response?.data?.message || "Load failed", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setPriceText("0");
    setOpen(true);
  }

  function openEdit(p: MessagePackage) {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      description: p.description ?? "",
      currency: p.currency ?? "BDT",
      credit: Number(p.credit ?? 0),
      validityDays: Number(p.validityDays ?? 0) || 30,
      type: p.type,
    });
    setPriceText(String(Number(p.price ?? 0)));
    setOpen(true);
  }

  function validate(): string | null {
    const priceNum = Number(priceText || 0);

    if (!form.name.trim()) return "প্যাকেজের নাম দিন";
    if (Number.isNaN(priceNum) || priceNum < 0) return "Price 0 বা তার বেশি হতে হবে";
    if (!Number.isFinite(form.credit) || form.credit <= 0) return "Credit 0 এর বেশি হতে হবে";
    if (form.type === "PACKAGE" && form.validityDays <= 0)
      return "Validity days 1 বা তার বেশি হতে হবে";

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
      const payload = {
        channel,
        type: form.type,
        name: form.name,
        description: form.description || undefined,
        price: Number(priceText || 0),
        currency: form.currency || "BDT",
        credit: Number(form.credit),
        validityDays: form.type === "RECHARGE" ? 0 : Number(form.validityDays),
      };

      if (editing) {
        await updatePackage(editing.id, payload);
        show("Package আপডেট হয়েছে", "success");
      } else {
        await createPackage(payload);
        show("Package তৈরি হয়েছে", "success");
      }

      setOpen(false);
      await load();
    } catch (e2: any) {
      show(e2?.response?.data?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(id: number) {
    try {
      await togglePackage(id);
      show("Status updated", "success");
      await load();
    } catch (e: any) {
      show(e?.response?.data?.message || "Toggle failed", "error");
    }
  }

  function openDeleteConfirm(p: MessagePackage) {
    setTarget(p);
    setConfirmOpen(true);
  }

  async function runDelete() {
    if (!target) return;
    setConfirmLoading(true);
    try {
      await deletePackage(target.id);
      show("Package delete হয়েছে", "success");
      setConfirmOpen(false);
      await load();
    } catch (e: any) {
      show(e?.response?.data?.message || "Delete failed — সম্ভবত এই package এখনও কোনো চলমান subscription এ ব্যবহৃত হচ্ছে", "error");
    } finally {
      setConfirmLoading(false);
      setTarget(null);
    }
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold dark:text-slate-100">{channel} Packages</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            মাদরাসাগুলোর জন্য {channel === "SMS" ? "SMS" : "Email"} credit প্যাকেজ ও রিচার্জ ম্যানেজ করুন।
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCreate}
            className="flex-1 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 sm:flex-none"
          >
            + New Package
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs text-gray-600 dark:text-slate-400">Status</label>
          <select
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "1" | "0")}
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
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <div className="text-xs text-gray-500 dark:text-slate-400">
            Total: <span className="font-medium text-gray-800 dark:text-slate-100">{visibleRows.length}</span>
          </div>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mt-5 space-y-3 md:hidden">
        {loading && <SkeletonList items={3} />}

        {!loading && visibleRows.length === 0 && (
          <div className="rounded-2xl border bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm font-medium text-gray-800 dark:text-slate-100">কোনো Package পাওয়া যায়নি</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">নতুন Package যোগ করতে "New Package" চাপুন</div>
          </div>
        )}

        {!loading &&
          visibleRows.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-gray-900 dark:text-slate-100">
                    #{p.id} — {p.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <TypeBadge type={p.type} />
                    {p.type === "PACKAGE" && (
                      <span className="text-xs text-gray-500 dark:text-slate-400">{p.validityDays} days</span>
                    )}
                  </div>
                </div>
                <Badge active={!!p.isActive} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-slate-300">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{creditLabel[channel]}</div>
                  {fmtInt(p.credit)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Price</div>৳ {fmtMoney(p.price)}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <IconButton title="Edit" onClick={() => openEdit(p)}>
                  ✏️ Edit
                </IconButton>
                <IconButton title="Toggle" onClick={() => onToggle(p.id)}>
                  🔁 Toggle
                </IconButton>
                <IconButton title="Delete" variant="danger" onClick={() => openDeleteConfirm(p)}>
                  🗑 Delete
                </IconButton>
              </div>
            </div>
          ))}
      </div>

      {/* Desktop table */}
      <div className="mt-5 hidden overflow-hidden rounded-2xl border bg-white md:block">
        {loading ? (
          <SkeletonTable rows={6} columns={7} className="rounded-none" bordered={false} shadowed={false} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">{creditLabel[channel]}</th>
                  <th className="px-4 py-3">Validity</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {visibleRows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-gray-700">{p.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      {p.description && <div className="text-xs text-gray-500">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={p.type} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmtInt(p.credit)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {p.type === "PACKAGE" ? `${p.validityDays} days` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      ৳ {fmtMoney(p.price)} {p.currency !== "BDT" ? p.currency : ""}
                    </td>
                    <td className="px-4 py-3">
                      <Badge active={!!p.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <IconButton title="Edit" onClick={() => openEdit(p)}>
                          ✏️ Edit
                        </IconButton>
                        <IconButton title="Toggle" onClick={() => onToggle(p.id)}>
                          🔁 Toggle
                        </IconButton>
                        <IconButton title="Delete" variant="danger" onClick={() => openDeleteConfirm(p)}>
                          🗑 Delete
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <div className="text-sm font-medium text-gray-800">কোনো Package পাওয়া যায়নি</div>
                      <div className="text-xs text-gray-500">নতুন Package যোগ করতে "New Package" চাপুন</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Package Name</label>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              placeholder={channel === "SMS" ? "e.g. 5,000 SMS / 90 days" : "e.g. 10,000 Emails / 30 days"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Description (optional)</label>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "PACKAGE" })}
                className={[
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-medium",
                  form.type === "PACKAGE"
                    ? "border-black bg-black text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                Package
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "RECHARGE" })}
                className={[
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-medium",
                  form.type === "RECHARGE"
                    ? "border-black bg-black text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                Recharge
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Package মেয়াদ সহ আসে (validity days); Recharge শুধু credit যোগ করে, মেয়াদ ছাড়া।
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-xs text-gray-600">{creditLabel[channel]}</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={form.credit}
                onChange={(e) => setForm({ ...form, credit: Number(e.target.value) })}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-gray-600">
                Validity Days {form.type === "RECHARGE" && <span className="text-gray-400">(N/A)</span>}
              </label>
              <input
                type="number"
                min={1}
                disabled={form.type === "RECHARGE"}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                value={form.type === "RECHARGE" ? "" : form.validityDays}
                onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-gray-600">
                Price (৳) <span className="text-[11px] text-gray-400">(৳ {fmtMoney(priceText)})</span>
              </label>
              <input
                inputMode="decimal"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={priceText}
                onChange={(e) => setPriceText(sanitizeDecimalText(e.target.value))}
                onBlur={() => {
                  const n = Number(priceText || 0);
                  setPriceText(String(Number.isNaN(n) ? 0 : n));
                }}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-gray-600">Currency</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

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

      {/* Delete Confirm */}
      <ConfirmModal
        open={confirmOpen}
        title="Delete Package?"
        message={`Package "${target?.name ?? ""}" স্থায়ীভাবে delete হবে। এটি কোনো চলমান subscription এ ব্যবহৃত থাকলে delete ব্যর্থ হবে।`}
        confirmText="Delete"
        cancelText="Cancel"
        danger
        loading={confirmLoading}
        onClose={() => {
          if (confirmLoading) return;
          setConfirmOpen(false);
          setTarget(null);
        }}
        onConfirm={runDelete}
      />
    </div>
  );
}
