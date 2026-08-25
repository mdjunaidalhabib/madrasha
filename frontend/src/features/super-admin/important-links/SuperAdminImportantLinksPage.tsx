import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Modal from "../../../components/ui/Modal";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { useToastStore } from "../../../store/toastStore";
import { importantLinkApi, type ImportantLinkDto } from "../../../services/superAdminCatalogApi";

type LinkFormValues = { label: string; sub_label: string; url: string };
const emptyForm: LinkFormValues = { label: "", sub_label: "", url: "" };

export default function SuperAdminImportantLinksPage() {
  const { show } = useToastStore();

  const [items, setItems] = useState<ImportantLinkDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [addForm, setAddForm] = useState<LinkFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<ImportantLinkDto | null>(null);
  const [editForm, setEditForm] = useState<LinkFormValues>(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ImportantLinkDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [reordering, setReordering] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await importantLinkApi.list();
      setItems(res.data?.data || []);
    } catch {
      show("লিংক লোড করা যায়নি", "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleAdd = async () => {
    if (!addForm.label.trim() || !addForm.url.trim()) {
      show("লেবেল ও লিংক (URL) দিন", "error");
      return;
    }
    try {
      setSaving(true);
      await importantLinkApi.create({
        label: addForm.label.trim(),
        sub_label: addForm.sub_label.trim() || null,
        url: addForm.url.trim(),
      });
      show("লিংক তৈরি হয়েছে", "success");
      setAddForm(emptyForm);
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || "লিংক তৈরি করতে সমস্যা হয়েছে", "error");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (item: ImportantLinkDto) => {
    setEditTarget(item);
    setEditForm({ label: item.label, sub_label: item.sub_label || "", url: item.url });
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    if (!editForm.label.trim() || !editForm.url.trim()) {
      show("লেবেল ও লিংক (URL) দিন", "error");
      return;
    }
    try {
      setEditSaving(true);
      await importantLinkApi.update(editTarget.id, {
        label: editForm.label.trim(),
        sub_label: editForm.sub_label.trim() || null,
        url: editForm.url.trim(),
      });
      show("লিংক আপডেট হয়েছে", "success");
      setEditTarget(null);
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || "লিংক আপডেট করতে সমস্যা হয়েছে", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleActive = async (item: ImportantLinkDto) => {
    try {
      await importantLinkApi.update(item.id, { is_active: !item.is_active });
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || "অবস্থা আপডেট করতে সমস্যা হয়েছে", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await importantLinkApi.remove(deleteTarget.id);
      show("লিংক মুছে ফেলা হয়েছে", "success");
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
      await importantLinkApi.reorder(reordered.map((r) => r.id));
    } catch {
      show("ক্রম সংরক্ষণ করা যায়নি", "error");
      await loadItems();
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
            গুরুত্বপূর্ণ লিংক
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            এখানে যোগ করা লিংকগুলো প্রতিটি মাদ্রাসার ড্যাশবোর্ডে "গুরুত্বপূর্ণ লিংক" কার্ডে দেখা
            যায়
          </p>
        </div>

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
            নতুন লিংক যোগ করুন
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <div className="w-full sm:w-[220px]">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                লেবেল
              </label>
              <input
                type="text"
                placeholder="যেমন: বেফাকুল মাদারিসিল আরাবিয়া"
                value={addForm.label}
                onChange={(e) => setAddForm((p) => ({ ...p, label: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="w-full sm:w-[160px]">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                সাব-লেবেল (ঐচ্ছিক)
              </label>
              <input
                type="text"
                placeholder="যেমন: বাংলাদেশ"
                value={addForm.sub_label}
                onChange={(e) => setAddForm((p) => ({ ...p, sub_label: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="w-full sm:w-[220px]">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                লিংক (URL)
              </label>
              <input
                type="text"
                placeholder="https://..."
                value={addForm.url}
                onChange={(e) => setAddForm((p) => ({ ...p, url: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleAdd}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              তৈরি করুন
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loading ? (
            <SkeletonList items={4} />
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              কোনো লিংক নেই
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-1 rounded-lg border border-gray-100 px-2.5 py-2 text-sm transition hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-800 ${
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
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-800 dark:text-slate-200">
                      {item.label}
                      {item.sub_label && (
                        <span className="font-normal text-gray-500 dark:text-slate-400">
                          {" "}
                          · {item.sub_label}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-gray-400 dark:text-slate-500">
                      {item.url}
                    </div>
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
        </div>
      </div>

      <Modal
        open={!!editTarget}
        title={`লিংক এডিট করুন — ${editTarget?.label || ""}`}
        onClose={() => setEditTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              লেবেল
            </label>
            <input
              type="text"
              value={editForm.label}
              onChange={(e) => setEditForm((p) => ({ ...p, label: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              সাব-লেবেল (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={editForm.sub_label}
              onChange={(e) => setEditForm((p) => ({ ...p, sub_label: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              লিংক (URL)
            </label>
            <input
              type="text"
              value={editForm.url}
              onChange={(e) => setEditForm((p) => ({ ...p, url: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
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
        message={`"${deleteTarget?.label ?? ""}" লিংকটি মুছে ফেলতে চান?`}
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
