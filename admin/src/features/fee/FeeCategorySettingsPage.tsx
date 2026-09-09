import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { feeCategoryApi, type FeeCategoryItem } from "../../services/phase2Api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import SectionCard from "../../components/settings/SectionCard";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";

const getErrorMessage = (err: any, fallback: string) => err?.response?.data?.message || fallback;

const normalizeArray = (payload: any): FeeCategoryItem[] => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const FeeCategorySettingsPage = () => {
  const [categories, setCategories] = useState<FeeCategoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await feeCategoryApi.list();
      setCategories(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD FEE CATEGORIES ERROR:", err);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      useToastStore.getState().show("একটা নাম দিন", "error");
      return;
    }
    try {
      setCreating(true);
      await feeCategoryApi.create({ name });
      useToastStore.getState().show("ফি ধরণ যোগ করা হয়েছে", "success");
      setNewName("");
      await loadCategories();
    } catch (err: any) {
      useToastStore.getState().show(getErrorMessage(err, "সংরক্ষণ করতে সমস্যা হয়েছে"), "error");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (category: FeeCategoryItem) => {
    setEditingId(category.id);
    setEditName(category.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (category: FeeCategoryItem) => {
    const name = editName.trim();
    if (!name) {
      useToastStore.getState().show("একটা নাম দিন", "error");
      return;
    }
    try {
      setSavingEdit(true);
      await feeCategoryApi.update(category.id, { name });
      useToastStore.getState().show("সংরক্ষণ করা হয়েছে", "success");
      cancelEdit();
      await loadCategories();
    } catch (err: any) {
      useToastStore.getState().show(getErrorMessage(err, "সংরক্ষণ করতে সমস্যা হয়েছে"), "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const applyToggleActive = async (category: FeeCategoryItem) => {
    try {
      await feeCategoryApi.update(category.id, { is_active: !category.isActive });
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, isActive: !c.isActive } : c)),
      );
    } catch (err: any) {
      useToastStore.getState().show(getErrorMessage(err, "আপডেট করতে সমস্যা হয়েছে"), "error");
    }
  };

  // বন্ধ/চালু করলে শুধু ড্রপডাউন থেকে লুকায় না - এই নামের সব বিদ্যমান ফি কাঠামোও
  // একসাথে বন্ধ/চালু হয়ে যায় (দেখুন backend FeeService.updateCategory), তাই
  // একাধিক কাঠামো প্রভাবিত হওয়ার আগে নিশ্চিত করে নেওয়া হচ্ছে।
  const handleToggleActive = (category: FeeCategoryItem) => {
    if (category.isActive) {
      useConfirmStore.getState().show({
        title: "ফি ধরণ বন্ধ করুন",
        message: `"${category.name}" বন্ধ করলে এই ধরণ ব্যবহার করা সব ফি কাঠামোও (Fee Structure পেজে) বন্ধ হয়ে যাবে - সেগুলো আর কোনো ছাত্রের জন্য বিল হবে না। এগিয়ে যেতে চান?`,
        confirmText: "বন্ধ করুন",
        danger: true,
        onConfirm: () => applyToggleActive(category),
      });
      return;
    }
    applyToggleActive(category);
  };

  const handleDelete = (category: FeeCategoryItem) => {
    useConfirmStore.getState().show({
      title: "ফি ধরণ ডিলিট করুন",
      message: `"${category.name}" ফি ধরণটি স্থায়ীভাবে মুছে ফেলতে চান? যেসব ফি কাঠামো ইতিমধ্যে এই ধরণ ব্যবহার করছে সেগুলো প্রভাবিত হবে না — সেগুলোতে নামটা শুধু টেক্সট হিসেবে থেকে যাবে।`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await feeCategoryApi.remove(category.id);
          useToastStore.getState().show("মুছে ফেলা হয়েছে", "success");
          setCategories((prev) => prev.filter((c) => c.id !== category.id));
          if (editingId === category.id) cancelEdit();
        } catch (err: any) {
          useToastStore.getState().show(getErrorMessage(err, "মুছতে সমস্যা হয়েছে"), "error");
        }
      },
    });
  };

  const renderCategoryRow = (category: FeeCategoryItem) => {
    if (editingId === category.id) {
      return (
        <div
          key={category.id}
          className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/40 p-1.5 dark:border-blue-900/50 dark:bg-blue-950/20"
        >
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8 flex-1 text-sm"
            autoFocus
          />
          <button
            type="button"
            disabled={savingEdit}
            onClick={() => saveEdit(category)}
            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-60 dark:hover:bg-emerald-950/40"
            title="সংরক্ষণ করুন"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            disabled={savingEdit}
            onClick={cancelEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-60 dark:hover:bg-slate-800"
            title="বাতিল"
          >
            <X size={16} />
          </button>
        </div>
      );
    }

    return (
      <div
        key={category.id}
        className="group flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-gray-800 dark:text-slate-200">{category.name}</span>
          {!category.isActive && (
            <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-slate-700 dark:text-slate-300">
              নিষ্ক্রিয়
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <ToggleSwitch
            checked={category.isActive}
            onChange={() => handleToggleActive(category)}
            size="sm"
            title="বন্ধ করলে এই ধরণের সব ফি কাঠামোও বন্ধ (আর বিল হবে না) হয়ে যাবে"
          />
          <button
            type="button"
            onClick={() => startEdit(category)}
            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 sm:opacity-0 sm:group-hover:opacity-100"
            title="সম্পাদনা"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(category)}
            className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
            title="মুছুন"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="ফি ধরণ সেটিংস"
        subtitle={
          'ফি কাঠামো তৈরি করার সময় যেসব ধরণ (যেমন: ভর্তি ফি, মাসিক বেতন, পরীক্ষার ফি) ব্যবহার করা যায় সেগুলো এখান থেকে যোগ/এডিট/ডিলিট করুন। সব ধরণের ফি মুহতামিম ভর্তি অনুমোদন করার পরই বিল হয় (আবেদন জমা দেওয়ার সময় কোনো বিল হয় না)। মাসিক বেতন-খাবার খরচের মতো মাসিক ফি-তে অনুমোদনের সাথে সাথে শুধু চলতি মাসেরটা বিল হয়, পরের মাসগুলো নিজে থেকেই প্রতি মাসের শুরুতে তৈরি হয়।'
        }
      />

      <SectionCard title="ফি ধরণসমূহ" hint="নতুন একটি ফি ধরণ যোগ করুন">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="নতুন ফি ধরণের নাম"
            className="h-9 min-w-[200px] flex-1 text-sm"
          />
          <Button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="h-9 shrink-0 gap-1 px-3 text-sm"
          >
            <Plus size={14} />
            {creating ? "সংরক্ষণ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-slate-800">
          {loading ? (
            <SkeletonList items={4} />
          ) : sortedCategories.length === 0 ? (
            <EmptyState
              title="এখনো কোনো ফি ধরণ যোগ করা হয়নি"
              hint="উপরের ফর্ম থেকে প্রথম ফি ধরণটি যোগ করুন।"
            />
          ) : (
            <div className="space-y-2">{sortedCategories.map((category) => renderCategoryRow(category))}</div>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

export default FeeCategorySettingsPage;
