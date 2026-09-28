import { useEffect, useMemo, useState } from "react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import ConfirmModal from "@madrasha/shared-ui/src/components/ui/ConfirmModal";
import { SkeletonList, SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
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
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { billingText } from "./billing.text";

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

export default function BillingPackagesPanel({ channel }: { channel: BillingChannel }) {
  const { show } = useToastStore();
  const t = useText(billingText);
  const c = useText(commonText);
  const creditLabel: Record<BillingChannel, string> = { SMS: t.smsCredit, EMAIL: t.emailCredit };

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
    () => (editing ? t.editPackageTitle(channel, String(editing.id)) : t.newPackageTitle(channel)),
    [editing, channel, t],
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
      show(e?.response?.data?.message || t.loadFailed, "error");
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

    if (!form.name.trim()) return t.errPackageName;
    if (Number.isNaN(priceNum) || priceNum < 0) return t.errPrice;
    if (!Number.isFinite(form.credit) || form.credit <= 0) return t.errCredit;
    if (form.type === "PACKAGE" && form.validityDays <= 0)
      return t.errValidity;

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
        show(t.packageUpdated, "success");
      } else {
        await createPackage(payload);
        show(t.packageCreated, "success");
      }

      setOpen(false);
      await load();
    } catch (e2: any) {
      show(e2?.response?.data?.message || t.saveFailed, "error");
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(id: number) {
    try {
      await togglePackage(id);
      show(t.statusUpdated, "success");
      await load();
    } catch (e: any) {
      show(e?.response?.data?.message || t.toggleFailed, "error");
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
      show(t.packageDeleted, "success");
      setConfirmOpen(false);
      await load();
    } catch (e: any) {
      show(e?.response?.data?.message || t.packageDeleteFailed, "error");
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
          <h1 className="text-2xl font-semibold dark:text-slate-100">{t.packagesTitle(channel)}</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            {t.packagesSubtitle(channel === "SMS" ? "SMS" : "Email")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCreate}
            className="flex-1 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 sm:flex-none"
          >
            {t.newPackage}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs text-gray-600 dark:text-slate-400">{t.status}</label>
          <select
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "1" | "0")}
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
            {t.total}: <span className="font-medium text-gray-800 dark:text-slate-100">{visibleRows.length}</span>
          </div>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mt-5 space-y-3 md:hidden">
        {loading && <SkeletonList items={3} />}

        {!loading && visibleRows.length === 0 && (
          <div className="rounded-2xl border bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm font-medium text-gray-800 dark:text-slate-100">{t.noPackages}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">{t.noPackagesHint}</div>
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
                      <span className="text-xs text-gray-500 dark:text-slate-400">{t.days(fmtInt(p.validityDays))}</span>
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
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.price}</div>৳ {fmtMoney(p.price)}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <IconButton title={t.edit} onClick={() => openEdit(p)}>
                  ✏️ {t.edit}
                </IconButton>
                <IconButton title={t.toggle} onClick={() => onToggle(p.id)}>
                  🔁 {t.toggle}
                </IconButton>
                <IconButton title={t.delete} variant="danger" onClick={() => openDeleteConfirm(p)}>
                  🗑 {t.delete}
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
            <table className="min-w-full text-start text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">{t.colName}</th>
                  <th className="px-4 py-3">{t.colType}</th>
                  <th className="px-4 py-3">{creditLabel[channel]}</th>
                  <th className="px-4 py-3">{t.colValidity}</th>
                  <th className="px-4 py-3">{t.price}</th>
                  <th className="px-4 py-3">{t.status}</th>
                  <th className="px-4 py-3 text-end">{t.colActions}</th>
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
                      {p.type === "PACKAGE" ? t.days(fmtInt(p.validityDays)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      ৳ {fmtMoney(p.price)} {p.currency !== "BDT" ? p.currency : ""}
                    </td>
                    <td className="px-4 py-3">
                      <Badge active={!!p.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <IconButton title={t.edit} onClick={() => openEdit(p)}>
                          ✏️ {t.edit}
                        </IconButton>
                        <IconButton title={t.toggle} onClick={() => onToggle(p.id)}>
                          🔁 {t.toggle}
                        </IconButton>
                        <IconButton title={t.delete} variant="danger" onClick={() => openDeleteConfirm(p)}>
                          🗑 {t.delete}
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <div className="text-sm font-medium text-gray-800">{t.noPackages}</div>
                      <div className="text-xs text-gray-500">{t.noPackagesHint}</div>
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
            <label className="text-xs text-gray-600">{t.packageName}</label>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              placeholder={channel === "SMS" ? t.smsNamePlaceholder : t.emailNamePlaceholder}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-gray-600">{t.descriptionOptional}</label>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-gray-600">{t.typeLabel}</label>
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
                {t.typePackage}
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
                {t.typeRecharge}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              {t.typeHint}
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
                {t.validityDays} {form.type === "RECHARGE" && <span className="text-gray-400">{t.notApplicable}</span>}
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
                {t.priceTaka} <span className="text-[11px] text-gray-400">(৳ {fmtMoney(priceText)})</span>
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
              <label className="text-xs text-gray-600">{t.currency}</label>
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
              {c.cancel}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
            >
              {saving ? c.saving : editing ? c.update : c.create}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={confirmOpen}
        title={t.deletePackageTitle}
        message={t.deletePackageMessage(target?.name ?? "")}
        confirmText={c.delete}
        cancelText={c.cancel}
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
