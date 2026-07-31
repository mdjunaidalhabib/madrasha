import { useCallback, useEffect, useMemo, useState } from "react";
import { roleApi, type PermissionCatalogItem, type RoleItem } from "../../services/phase3Api";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";

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

  const handleDelete = async (role: RoleItem) => {
    try {
      await roleApi.remove(role.id);
      useToastStore.getState().show("রোল মুছে ফেলা হয়েছে", "success");
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">রোল ও পারমিশন</h1>
          <p className="mt-1 text-sm text-gray-500">
            নতুন রোল তৈরি করুন এবং প্রতিটা রোলের জন্য কোন কোন মডিউলে অ্যাক্সেস থাকবে তা নির্ধারণ
            করুন
          </p>
        </div>

        {/* Create role */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">নতুন রোল তৈরি করুন</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="রোলের নাম (যেমন: ক্লাস টিচার)"
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:max-w-xs"
            />
            <button
              type="button"
              disabled={creating}
              onClick={handleCreateRole}
              className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {creating ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
            </button>
          </div>
        </div>

        {/* Role list */}
        <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">লোড হচ্ছে...</div>
          ) : roles.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">কোনো রোল নেই</div>
          ) : (
            <div className="flex flex-col gap-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <span className="font-semibold text-gray-800">{role.name_bn}</span>{" "}
                    {role.is_protected && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        ডিফল্ট রোল
                      </span>
                    )}
                    <span className="text-gray-500"> · {role.permission_keys.length} টি পারমিশন</span>
                    <span className="text-gray-500"> · {role.user_count} জন ইউজার</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(role)}
                      className="h-8 rounded-md border border-blue-300 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                    >
                      পারমিশন সেট করুন
                    </button>
                    {!role.is_protected && (
                      <button
                        type="button"
                        disabled={role.user_count > 0}
                        onClick={() => handleDelete(role)}
                        title={
                          role.user_count > 0
                            ? "এই রোলে ইউজার আছে বলে মুছা যাবে না"
                            : undefined
                        }
                        className="h-8 rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
                <div key={moduleName} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize text-gray-800">
                      {moduleName}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleModuleAll(moduleKeys, allSelected)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {allSelected ? "সব বাদ দিন" : "সব সিলেক্ট করুন"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {modulePermissions.map((permission) => (
                      <label key={permission.id} className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(permission.keyName)}
                          onChange={() => toggleKey(permission.keyName)}
                          className="h-4 w-4 rounded border-gray-300"
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
          <button
            type="button"
            onClick={() => setEditingRole(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSavePermissions}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default RolesPermissionsPage;
