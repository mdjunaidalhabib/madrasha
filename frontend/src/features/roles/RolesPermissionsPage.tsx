import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { roleApi, type PermissionCatalogItem, type RoleItem } from "../../services/phase3Api";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";
import SectionCard from "../../components/settings/SectionCard";

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

/** Groups the flat permission catalog ("students.read", "students.create",
 * ...) by its module prefix, so the matrix can render one row per module. */
const groupByModule = (permissions: PermissionCatalogItem[]) => {
  const groups = new Map<string, PermissionCatalogItem[]>();
  for (const permission of permissions) {
    const [moduleName] = (permission.keyName || "").split(".");
    if (!moduleName) continue;
    if (!groups.has(moduleName)) groups.set(moduleName, []);
    groups.get(moduleName)!.push(permission);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
};

const RolesPermissionsPage = () => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([roleApi.list(), roleApi.listPermissions()]);
      setRoles(normalizeArray(rolesRes));
      setPermissions(normalizeArray(permsRes));
    } catch (err) {
      logger.error("LOAD ROLES/PERMISSIONS ERROR:", err);
      setRoles([]);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => groupByModule(permissions), [permissions]);

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      useToastStore.getState().show("রোলের নাম দিন", "error");
      return;
    }
    try {
      setCreating(true);
      await roleApi.create({ name_bn: newRoleName.trim() });
      useToastStore.getState().show("রোল তৈরি হয়েছে", "success");
      setNewRoleName("");
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "রোল তৈরি করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (role: RoleItem) => {
    setEditingRole(role);
    setSelectedKeys(new Set(role.permission_keys));
  };

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModuleAll = (moduleKeys: string[], allSelected: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const key of moduleKeys) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  };

  const handleSavePermissions = async () => {
    if (!editingRole) return;
    try {
      setSaving(true);
      await roleApi.update(editingRole.id, { permission_keys: Array.from(selectedKeys) });
      useToastStore.getState().show("পারমিশন সংরক্ষণ করা হয়েছে", "success");
      setEditingRole(null);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সংরক্ষণ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (role: RoleItem) => {
    useConfirmStore.getState().show({
      title: "রোল ডিলিট করুন",
      message: `"${role.name_bn}" রোলটি স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await roleApi.remove(role.id);
          useToastStore.getState().show("রোল মুছে ফেলা হয়েছে", "success");
          setRoles((prev) => prev.filter((r) => r.id !== role.id));
        } catch (err: any) {
          const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
          useToastStore.getState().show(msg, "error");
        }
      },
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="রোল ও পারমিশন"
        subtitle="নতুন রোল তৈরি করুন এবং প্রতিটা রোলের জন্য কোন কোন মডিউলে অ্যাক্সেস থাকবে তা নির্ধারণ করুন"
      />

      <SectionCard title="নতুন রোল তৈরি করুন">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="রোলের নাম (যেমন: ক্লাস টিচার)"
            className="sm:max-w-xs"
          />
          <Button disabled={creating} onClick={handleCreateRole} className="gap-1.5">
            {!creating && <Plus size={15} />}
            {creating ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="সব রোল">
        {loading ? (
          <SkeletonList items={6} />
        ) : roles.length === 0 ? (
          <EmptyState title="কোনো রোল নেই" />
        ) : (
          <div className="space-y-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="group flex flex-col gap-3 rounded-xl border border-gray-100 p-4 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-gray-900 dark:text-slate-100">{role.name_bn}</span>
                    {role.is_protected && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                        ডিফল্ট রোল
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                    {role.permission_keys.length} টি পারমিশন · {role.user_count} জন ইউজার
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(role)}
                    className="flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
                  >
                    <Pencil size={12} />
                    পারমিশন সেট করুন
                  </button>
                  {!role.is_protected && (
                    <button
                      type="button"
                      disabled={role.user_count > 0}
                      onClick={() => handleDelete(role)}
                      title={role.user_count > 0 ? "এই রোলে ইউজার আছে বলে মুছা যাবে না" : "মুছুন"}
                      className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-100 sm:disabled:opacity-0 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Permission matrix modal */}
      <Modal
        open={!!editingRole}
        title={`পারমিশন সেট করুন — ${editingRole?.name_bn || ""}`}
        onClose={() => setEditingRole(null)}
      >
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="flex flex-col gap-3">
            {grouped.map(([moduleName, modulePermissions]) => {
              const moduleKeys = modulePermissions.map((p) => p.keyName);
              const allSelected = moduleKeys.every((k) => selectedKeys.has(k));
              return (
                <div key={moduleName} className="rounded-lg border border-gray-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize text-gray-800 dark:text-slate-200">
                      {moduleName}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleModuleAll(moduleKeys, allSelected)}
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {allSelected ? "সব বাদ দিন" : "সব সিলেক্ট করুন"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {modulePermissions.map((permission) => (
                      <label key={permission.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(permission.keyName)}
                          onChange={() => toggleKey(permission.keyName)}
                          className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                        />
                        {permission.name}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditingRole(null)}>
            বাতিল
          </Button>
          <Button type="button" disabled={saving} onClick={handleSavePermissions}>
            {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default RolesPermissionsPage;
