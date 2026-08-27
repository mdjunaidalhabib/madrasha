import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { useToastStore } from "../../../store/toastStore";
import { logger } from "../../../utils/logger";
import {
  getVendorPromoConfig,
  saveVendorPromoConfig,
  VendorPromoConfig,
} from "../../../services/superAdminApi";
import { vendorServiceApi, VendorServiceDto } from "../../../services/superAdminCatalogApi";
import { VendorIcon, VENDOR_ICON_KEYS } from "../../vendor/vendorIcons";

const emptyConfig: VendorPromoConfig = {
  is_enabled: true,
  company_name: "",
  tagline: "",
  teaser_text: "",
  detail_link_text: "",
  hero_title: "",
  hero_text: "",
  founder_name: "",
  founder_title: "",
  founder_location: "",
  founder_bio: "",
  founder_skills: "",
  founder_photo_url: "",
  founder_facebook_url: "",
  phone_display: "",
  phone_intl: "",
  email: "",
  website: "",
  address: "",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  colSpan,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  colSpan?: boolean;
}) {
  return (
    <div className={colSpan ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{label}</label>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      )}
    </div>
  );
}

function ConfigForm() {
  const toast = useToastStore((s) => s.show);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<VendorPromoConfig>(emptyConfig);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof VendorPromoConfig>(key: K, value: VendorPromoConfig[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVendorPromoConfig()
      .then((data) => !cancelled && setForm(data))
      .catch((err) => {
        logger.error("LOAD VENDOR PROMO CONFIG ERROR:", err);
        toast("কনফিগারেশন লোড করা যায়নি", "error");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveVendorPromoConfig(form);
      toast("সংরক্ষণ করা হয়েছে", "success");
    } catch (err) {
      logger.error("SAVE VENDOR PROMO CONFIG ERROR:", err);
      toast("সংরক্ষণ করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-slate-400">লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">প্রোমো কার্ড চালু</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              বন্ধ থাকলে ড্যাশবোর্ড কার্ড ও বিস্তারিত পেজ — দুটোই কোনো মাদ্রাসাতেই দেখা যাবে না।
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_enabled}
            onClick={() => set("is_enabled", !form.is_enabled)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              form.is_enabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                form.is_enabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">ব্র্যান্ডিং টেক্সট</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="কোম্পানির নাম" value={form.company_name} onChange={(v) => set("company_name", v)} />
          <Field label="ট্যাগলাইন" value={form.tagline} onChange={(v) => set("tagline", v)} />
          <Field
            label="টিজার লাইন (ড্যাশবোর্ড কার্ডে)"
            value={form.teaser_text}
            onChange={(v) => set("teaser_text", v)}
            colSpan
          />
          <Field
            label="“বিস্তারিত” লিংক টেক্সট"
            value={form.detail_link_text}
            onChange={(v) => set("detail_link_text", v)}
          />
          <Field label="হিরো শিরোনাম (বিস্তারিত পেজে)" value={form.hero_title} onChange={(v) => set("hero_title", v)} />
          <Field
            label="হিরো লেখা"
            value={form.hero_text}
            onChange={(v) => set("hero_text", v)}
            textarea
            colSpan
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">প্রতিষ্ঠাতা / সিইও</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="নাম" value={form.founder_name} onChange={(v) => set("founder_name", v)} />
          <Field label="পদবি" value={form.founder_title} onChange={(v) => set("founder_title", v)} />
          <Field label="অবস্থান" value={form.founder_location} onChange={(v) => set("founder_location", v)} />
          <Field
            label="স্কিল (কমা দিয়ে আলাদা)"
            value={form.founder_skills}
            onChange={(v) => set("founder_skills", v)}
            placeholder="React, Next.js, SEO"
          />
          <Field
            label="বায়ো"
            value={form.founder_bio}
            onChange={(v) => set("founder_bio", v)}
            textarea
            colSpan
          />
          <Field
            label="ছবির URL (ঐচ্ছিক — না দিলে ইনিশিয়াল দেখাবে)"
            value={form.founder_photo_url}
            onChange={(v) => set("founder_photo_url", v)}
            placeholder="https://..."
          />
          <Field
            label="ফেসবুক প্রোফাইল লিংক (ঐচ্ছিক)"
            value={form.founder_facebook_url}
            onChange={(v) => set("founder_facebook_url", v)}
            placeholder="https://facebook.com/..."
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">যোগাযোগ</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ফোন (দেখানোর জন্য)" value={form.phone_display} onChange={(v) => set("phone_display", v)} placeholder="01624114405" />
          <Field
            label="WhatsApp নম্বর (দেশের কোড সহ, + ছাড়া)"
            value={form.phone_intl}
            onChange={(v) => set("phone_intl", v)}
            placeholder="8801624114405"
          />
          <Field label="ইমেইল" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="ওয়েবসাইট" value={form.website} onChange={(v) => set("website", v)} placeholder="https://..." />
          <Field label="ঠিকানা" value={form.address} onChange={(v) => set("address", v)} colSpan />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
        </Button>
      </div>
    </div>
  );
}

type ServiceFormValues = { label: string; desc: string; icon_key: string; is_current: boolean };
const emptyServiceForm: ServiceFormValues = { label: "", desc: "", icon_key: "Sparkles", is_current: false };

function ServicesList() {
  const { show } = useToastStore();

  const [items, setItems] = useState<VendorServiceDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [addForm, setAddForm] = useState<ServiceFormValues>(emptyServiceForm);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<VendorServiceDto | null>(null);
  const [editForm, setEditForm] = useState<ServiceFormValues>(emptyServiceForm);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<VendorServiceDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [reordering, setReordering] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vendorServiceApi.list();
      setItems(res.data?.data || []);
    } catch {
      show("সার্ভিস লোড করা যায়নি", "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleAdd = async () => {
    if (!addForm.label.trim()) {
      show("লেবেল দিন", "error");
      return;
    }
    try {
      setSaving(true);
      await vendorServiceApi.create({
        label: addForm.label.trim(),
        desc: addForm.desc.trim() || null,
        icon_key: addForm.icon_key,
        is_current: addForm.is_current,
      });
      show("সার্ভিস তৈরি হয়েছে", "success");
      setAddForm(emptyServiceForm);
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || "তৈরি করতে সমস্যা হয়েছে", "error");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (item: VendorServiceDto) => {
    setEditTarget(item);
    setEditForm({
      label: item.label,
      desc: item.desc || "",
      icon_key: item.icon_key,
      is_current: item.is_current,
    });
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    if (!editForm.label.trim()) {
      show("লেবেল দিন", "error");
      return;
    }
    try {
      setEditSaving(true);
      await vendorServiceApi.update(editTarget.id, {
        label: editForm.label.trim(),
        desc: editForm.desc.trim() || null,
        icon_key: editForm.icon_key,
        is_current: editForm.is_current,
      });
      show("সার্ভিস আপডেট হয়েছে", "success");
      setEditTarget(null);
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || "আপডেট করতে সমস্যা হয়েছে", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleActive = async (item: VendorServiceDto) => {
    try {
      await vendorServiceApi.update(item.id, { is_active: !item.is_active });
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || "অবস্থা আপডেট করতে সমস্যা হয়েছে", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await vendorServiceApi.remove(deleteTarget.id);
      show("সার্ভিস মুছে ফেলা হয়েছে", "success");
      setDeleteTarget(null);
      setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id));
    } catch (err: any) {
      show(err?.response?.data?.message || "মুছে ফেলা যায়নি", "error");
    } finally {
      setDeleting(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length || reordering) return;

    const reordered = [...items];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setItems(reordered);

    setReordering(true);
    try {
      await vendorServiceApi.reorder(reordered.map((r) => r.id));
    } catch {
      show("ক্রম সংরক্ষণ করা যায়নি", "error");
      await loadItems();
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">আমাদের সেবাসমূহ</h2>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        বিস্তারিত পেজে "আমাদের সেবাসমূহ" গ্রিডে যা দেখা যাবে। "বর্তমানে ব্যবহার করছে" চিহ্নিত
        সার্ভিসটি (সাধারণত QMS) ব্যাজসহ আলাদাভাবে দেখানো হয়।
      </p>

      <div className="mb-4 rounded-xl border border-dashed border-gray-300 p-3 dark:border-slate-700">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">নতুন সার্ভিস যোগ করুন</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="লেবেল, যেমন: ফুল ই-কমার্স ওয়েবসাইট"
            value={addForm.label}
            onChange={(e) => setAddForm((p) => ({ ...p, label: e.target.value }))}
            className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <select
            value={addForm.icon_key}
            onChange={(e) => setAddForm((p) => ({ ...p, icon_key: e.target.value }))}
            className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {VENDOR_ICON_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)"
            value={addForm.desc}
            onChange={(e) => setAddForm((p) => ({ ...p, desc: e.target.value }))}
            className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:col-span-2"
          />
          <label className="flex items-center gap-2 text-sm dark:text-slate-200">
            <input
              type="checkbox"
              checked={addForm.is_current}
              onChange={(e) => setAddForm((p) => ({ ...p, is_current: e.target.checked }))}
            />
            এটাই বর্তমানে ব্যবহার করছে (QMS)
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={handleAdd}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:justify-self-end"
          >
            তৈরি করুন
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonList items={3} />
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">কোনো সার্ভিস নেই</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-2 text-sm transition hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-800 ${
                !item.is_active ? "opacity-50" : ""
              }`}
            >
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  title="উপরে সরান"
                  disabled={index === 0 || reordering}
                  onClick={() => move(index, -1)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:text-slate-500 dark:hover:bg-slate-800"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  title="নিচে সরান"
                  disabled={index === items.length - 1 || reordering}
                  onClick={() => move(index, 1)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:text-slate-500 dark:hover:bg-slate-800"
                >
                  <ArrowDown size={13} />
                </button>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <VendorIcon iconKey={item.icon_key} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-800 dark:text-slate-200">
                  {item.label}
                  {item.is_current && (
                    <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      বর্তমান
                    </span>
                  )}
                </div>
                {item.desc && (
                  <div className="truncate text-xs text-gray-400 dark:text-slate-500">{item.desc}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleToggleActive(item)}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  item.is_active
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {item.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
              </button>
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  title="এডিট"
                  onClick={() => openEditModal(item)}
                  className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title="মুছুন"
                  onClick={() => setDeleteTarget(item)}
                  className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editTarget}
        title={`সার্ভিস এডিট করুন — ${editTarget?.label || ""}`}
        onClose={() => setEditTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">লেবেল</label>
            <input
              type="text"
              value={editForm.label}
              onChange={(e) => setEditForm((p) => ({ ...p, label: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">আইকন</label>
            <select
              value={editForm.icon_key}
              onChange={(e) => setEditForm((p) => ({ ...p, icon_key: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {VENDOR_ICON_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              সংক্ষিপ্ত বিবরণ
            </label>
            <input
              type="text"
              value={editForm.desc}
              onChange={(e) => setEditForm((p) => ({ ...p, desc: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm dark:text-slate-200">
            <input
              type="checkbox"
              checked={editForm.is_current}
              onChange={(e) => setEditForm((p) => ({ ...p, is_current: e.target.checked }))}
            />
            এটাই বর্তমানে ব্যবহার করছে (QMS)
          </label>
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
            disabled={editSaving}
            onClick={handleUpdate}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {editSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="মুছে ফেলুন?"
        message={`"${deleteTarget?.label ?? ""}" সার্ভিসটি মুছে ফেলতে চান?`}
        confirmText="মুছে ফেলুন"
        cancelText="বাতিল"
        danger
        loading={deleting}
        onClose={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function SuperAdminVendorPromoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hikmah IT প্রোমো"
        subtitle="প্রতিটি মাদ্রাসার ড্যাশবোর্ড ও বিস্তারিত পেজে যা দেখা যায় — সবটাই এখান থেকে সম্পাদনাযোগ্য"
      />
      <ConfigForm />
      <ServicesList />
    </div>
  );
}
