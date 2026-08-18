import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  accountFundApi,
  type AccountCategoryItem,
  type AccountFundItem,
  type AccountFundType,
} from "../../services/accountFundApi";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import SectionCard from "../../components/settings/SectionCard";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";

type SectionConfig = {
  type: AccountFundType;
  title: string;
  hint: string;
  addPlaceholder: string;
  addButtonLabel: string;
  emptyTitle: string;
  emptyHint: string;
  deleteWarningNoun: string;
};

const SECTIONS: SectionConfig[] = [
  {
    type: "income",
    title: "আয়ের ফান্ড",
    hint: "প্রতিটা ফান্ডের নিচে তার খাতগুলো যোগ করুন",
    addPlaceholder: "নতুন ফান্ডের নাম",
    addButtonLabel: "ফান্ড যোগ করুন",
    emptyTitle: "এখনো কোনো আয়ের ফান্ড যোগ করা হয়নি",
    emptyHint: "উপরের ফর্ম থেকে প্রথম ফান্ডটি যোগ করুন।",
    deleteWarningNoun: "ফান্ডটি",
  },
  {
    type: "expense",
    title: "ব্যয়ের বিভাগ",
    hint: "প্রতিটা বিভাগের নিচে তার খাতগুলো যোগ করুন",
    addPlaceholder: "নতুন বিভাগের নাম",
    addButtonLabel: "বিভাগ যোগ করুন",
    emptyTitle: "এখনো কোনো ব্যয়ের বিভাগ যোগ করা হয়নি",
    emptyHint: "উপরের ফর্ম থেকে প্রথম বিভাগটি যোগ করুন।",
    deleteWarningNoun: "বিভাগটি",
  },
];

const getErrorMessage = (err: any, fallback: string) => err?.response?.data?.message || fallback;

const AccountFundSettingsPage = () => {
  const [funds, setFunds] = useState<AccountFundItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [newFundName, setNewFundName] = useState<Record<AccountFundType, string>>({
    income: "",
    expense: "",
  });
  const [creatingFundType, setCreatingFundType] = useState<AccountFundType | null>(null);

  const [editingFundId, setEditingFundId] = useState<number | null>(null);
  const [editFundName, setEditFundName] = useState("");
  const [savingFundEdit, setSavingFundEdit] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState<Record<number, string>>({});
  const [creatingCategoryFundId, setCreatingCategoryFundId] = useState<number | null>(null);

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [savingCategoryEdit, setSavingCategoryEdit] = useState(false);

  const loadFunds = useCallback(async () => {
    try {
      setLoading(true);
      const [incomeRes, expenseRes] = await Promise.all([
        accountFundApi.list("income"),
        accountFundApi.list("expense"),
      ]);
      const income = Array.isArray(incomeRes.data) ? incomeRes.data : [];
      const expense = Array.isArray(expenseRes.data) ? expenseRes.data : [];
      setFunds([...income, ...expense]);
    } catch (err) {
      logger.error("LOAD ACCOUNT FUNDS ERROR:", err);
      setFunds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFunds();
  }, [loadFunds]);

  const reloadType = useCallback(async (type: AccountFundType) => {
    try {
      const res = await accountFundApi.list(type);
      const list = Array.isArray(res.data) ? res.data : [];
      setFunds((prev) => [...prev.filter((f) => f.type !== type), ...list]);
    } catch (err) {
      logger.error("RELOAD ACCOUNT FUNDS ERROR:", err);
    }
  }, []);

  // ---- fund handlers ----

  const handleCreateFund = async (config: SectionConfig) => {
    const name = newFundName[config.type].trim();
    if (!name) {
      useToastStore.getState().show("একটা নাম দিন", "error");
      return;
    }
    try {
      setCreatingFundType(config.type);
      await accountFundApi.create({ type: config.type, name });
      useToastStore.getState().show(`${config.title} যোগ করা হয়েছে`, "success");
      setNewFundName((p) => ({ ...p, [config.type]: "" }));
      await reloadType(config.type);
    } catch (err: any) {
      useToastStore.getState().show(getErrorMessage(err, "সংরক্ষণ করতে সমস্যা হয়েছে"), "error");
    } finally {
      setCreatingFundType(null);
    }
  };

  const startEditFund = (fund: AccountFundItem) => {
    setEditingFundId(fund.id);
    setEditFundName(fund.name);
  };

  const cancelEditFund = () => {
    setEditingFundId(null);
    setEditFundName("");
  };

  const saveEditFund = async (fund: AccountFundItem) => {
    const name = editFundName.trim();
    if (!name) {
      useToastStore.getState().show("একটা নাম দিন", "error");
      return;
    }
    try {
      setSavingFundEdit(true);
      await accountFundApi.update(fund.id, { name });
      useToastStore.getState().show("সংরক্ষণ করা হয়েছে", "success");
      cancelEditFund();
      await reloadType(fund.type);
    } catch (err: any) {
      useToastStore.getState().show(getErrorMessage(err, "সংরক্ষণ করতে সমস্যা হয়েছে"), "error");
    } finally {
      setSavingFundEdit(false);
    }
  };

  const handleToggleFundActive = async (fund: AccountFundItem) => {
    try {
      await accountFundApi.update(fund.id, { is_active: !fund.isActive });
      setFunds((prev) =>
        prev.map((f) => (f.id === fund.id ? { ...f, isActive: !f.isActive } : f)),
      );
    } catch (err: any) {
      useToastStore.getState().show(getErrorMessage(err, "আপডেট করতে সমস্যা হয়েছে"), "error");
    }
  };

  const handleDeleteFund = (fund: AccountFundItem, config: SectionConfig) => {
    useConfirmStore.getState().show({
      title: `${config.title} ডিলিট করুন`,
      message: `"${fund.name}" ${config.deleteWarningNoun} স্থায়ীভাবে মুছে ফেলতে চান? এর ভেতরের সব খাতও (${fund.categories.length}টি) একসাথে মুছে যাবে।`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await accountFundApi.remove(fund.id);
          useToastStore.getState().show("মুছে ফেলা হয়েছে", "success");
          setFunds((prev) => prev.filter((f) => f.id !== fund.id));
          if (editingFundId === fund.id) cancelEditFund();
        } catch (err: any) {
          useToastStore.getState().show(getErrorMessage(err, "মুছতে সমস্যা হয়েছে"), "error");
        }
      },
    });
  };

  // ---- category handlers ----

  const handleCreateCategory = async (fund: AccountFundItem) => {
    const name = (newCategoryName[fund.id] || "").trim();
    if (!name) {
      useToastStore.getState().show("একটা খাতের নাম দিন", "error");
      return;
    }
    try {
      setCreatingCategoryFundId(fund.id);
      await accountFundApi.createCategory(fund.id, { name });
      useToastStore.getState().show("খাত যোগ করা হয়েছে", "success");
      setNewCategoryName((p) => ({ ...p, [fund.id]: "" }));
      await reloadType(fund.type);
    } catch (err: any) {
      useToastStore.getState().show(getErrorMessage(err, "সংরক্ষণ করতে সমস্যা হয়েছে"), "error");
    } finally {
      setCreatingCategoryFundId(null);
    }
  };

  const startEditCategory = (category: AccountCategoryItem) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName("");
  };

  const saveEditCategory = async (fund: AccountFundItem, category: AccountCategoryItem) => {
    const name = editCategoryName.trim();
    if (!name) {
      useToastStore.getState().show("একটা নাম দিন", "error");
      return;
    }
    try {
      setSavingCategoryEdit(true);
      await accountFundApi.updateCategory(category.id, { name });
      useToastStore.getState().show("সংরক্ষণ করা হয়েছে", "success");
      cancelEditCategory();
      await reloadType(fund.type);
    } catch (err: any) {
      useToastStore.getState().show(getErrorMessage(err, "সংরক্ষণ করতে সমস্যা হয়েছে"), "error");
    } finally {
      setSavingCategoryEdit(false);
    }
  };

  const handleToggleCategoryActive = async (fund: AccountFundItem, category: AccountCategoryItem) => {
    try {
      await accountFundApi.updateCategory(category.id, { is_active: !category.isActive });
      setFunds((prev) =>
        prev.map((f) =>
          f.id === fund.id
            ? {
                ...f,
                categories: f.categories.map((c) =>
                  c.id === category.id ? { ...c, isActive: !c.isActive } : c,
                ),
              }
            : f,
        ),
      );
    } catch (err: any) {
      useToastStore.getState().show(getErrorMessage(err, "আপডেট করতে সমস্যা হয়েছে"), "error");
    }
  };

  const handleDeleteCategory = (fund: AccountFundItem, category: AccountCategoryItem) => {
    useConfirmStore.getState().show({
      title: "খাত ডিলিট করুন",
      message: `"${category.name}" খাতটি স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await accountFundApi.removeCategory(category.id);
          useToastStore.getState().show("খাত মুছে ফেলা হয়েছে", "success");
          setFunds((prev) =>
            prev.map((f) =>
              f.id === fund.id
                ? { ...f, categories: f.categories.filter((c) => c.id !== category.id) }
                : f,
            ),
          );
          if (editingCategoryId === category.id) cancelEditCategory();
        } catch (err: any) {
          useToastStore.getState().show(getErrorMessage(err, "মুছতে সমস্যা হয়েছে"), "error");
        }
      },
    });
  };

  const renderCategoryRow = (fund: AccountFundItem, category: AccountCategoryItem) => {
    if (editingCategoryId === category.id) {
      return (
        <div
          key={category.id}
          className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/40 p-1 dark:border-blue-900/50 dark:bg-blue-950/20"
        >
          <Input
            value={editCategoryName}
            onChange={(e) => setEditCategoryName(e.target.value)}
            className="h-7 flex-1 text-xs"
            autoFocus
          />
          <button
            type="button"
            disabled={savingCategoryEdit}
            onClick={() => saveEditCategory(fund, category)}
            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-60 dark:hover:bg-emerald-950/40"
            title="সংরক্ষণ করুন"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            disabled={savingCategoryEdit}
            onClick={cancelEditCategory}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-60 dark:hover:bg-slate-800"
            title="বাতিল"
          >
            <X size={14} />
          </button>
        </div>
      );
    }

    return (
      <div
        key={category.id}
        className="group flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-2 py-1 text-xs transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-gray-700 dark:text-slate-300">{category.name}</span>
          {!category.isActive && (
            <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-slate-700 dark:text-slate-300">
              নিষ্ক্রিয়
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ToggleSwitch
            checked={category.isActive}
            onChange={() => handleToggleCategoryActive(fund, category)}
          />
          <button
            type="button"
            onClick={() => startEditCategory(category)}
            className="rounded-lg p-1 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 sm:opacity-0 sm:group-hover:opacity-100"
            title="সম্পাদনা"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteCategory(fund, category)}
            className="rounded-lg p-1 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
            title="মুছুন"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  const renderFundCard = (fund: AccountFundItem, config: SectionConfig) => (
    <div key={fund.id} className="rounded-xl border border-gray-100 p-3 dark:border-slate-800">
      {editingFundId === fund.id ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={editFundName}
            onChange={(e) => setEditFundName(e.target.value)}
            className="h-8 flex-1 text-sm"
            autoFocus
          />
          <button
            type="button"
            disabled={savingFundEdit}
            onClick={() => saveEditFund(fund)}
            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-60 dark:hover:bg-emerald-950/40"
            title="সংরক্ষণ করুন"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            disabled={savingFundEdit}
            onClick={cancelEditFund}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-60 dark:hover:bg-slate-800"
            title="বাতিল"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="group flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold text-gray-900 dark:text-slate-100">
              {fund.name}
            </span>
            {!fund.isActive && (
              <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                নিষ্ক্রিয়
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ToggleSwitch checked={fund.isActive} onChange={() => handleToggleFundActive(fund)} />
            <button
              type="button"
              onClick={() => startEditFund(fund)}
              className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 sm:opacity-0 sm:group-hover:opacity-100"
              title="সম্পাদনা"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteFund(fund, config)}
              className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
              title="মুছুন"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 dark:border-slate-800">
        {fund.categories.map((category) => renderCategoryRow(fund, category))}
        <div className="flex gap-1.5 pt-1">
          <Input
            value={newCategoryName[fund.id] || ""}
            onChange={(e) => setNewCategoryName((p) => ({ ...p, [fund.id]: e.target.value }))}
            placeholder="নতুন খাতের নাম"
            className="h-7 flex-1 text-xs"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={creatingCategoryFundId === fund.id}
            onClick={() => handleCreateCategory(fund)}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Plus size={12} />
            খাত যোগ করুন
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="ফান্ড ও খাত সেটিংস"
        subtitle="আয়ের ফান্ড ও ব্যয়ের বিভাগ, এবং তাদের খাত এখান থেকে যোগ/এডিট/ডিলিট করুন"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {SECTIONS.map((config) => {
          const list = funds
            .filter((f) => f.type === config.type)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          return (
            <SectionCard key={config.type} title={config.title} hint={config.hint}>
              <div className="flex gap-2">
                <Input
                  value={newFundName[config.type]}
                  onChange={(e) =>
                    setNewFundName((p) => ({ ...p, [config.type]: e.target.value }))
                  }
                  placeholder={config.addPlaceholder}
                  className="h-9 flex-1 text-sm"
                />
                <Button
                  type="button"
                  disabled={creatingFundType === config.type}
                  onClick={() => handleCreateFund(config)}
                  className="h-9 shrink-0 gap-1 px-3 text-sm"
                >
                  <Plus size={14} />
                  {creatingFundType === config.type ? "সংরক্ষণ হচ্ছে..." : config.addButtonLabel}
                </Button>
              </div>

              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-slate-800">
                {loading ? (
                  <SkeletonList items={3} />
                ) : list.length === 0 ? (
                  <EmptyState title={config.emptyTitle} hint={config.emptyHint} />
                ) : (
                  <div className="space-y-2">{list.map((fund) => renderFundCard(fund, config))}</div>
                )}
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
};

export default AccountFundSettingsPage;
