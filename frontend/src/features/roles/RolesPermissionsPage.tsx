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
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

/** The real sidebar modules (see backend sidebar.constants.ts's
 * MODULE_PERMISSION_PREFIXES, mirrored here) - listed in the same order they
 * appear in the sidebar, each mapped to the permission-key prefixes that
 * belong to it. "dashboard" is intentionally omitted - it needs no
 * permission and is always visible. A permission can legitimately belong to
 * more than one module (e.g. "teachers.read" unlocks both শিক্ষক স্টাফ's
 * teacher list and তালিমাত's assignment screen), so it's shown - and independently
 * toggleable from - every module card it's relevant to. */
const MODULE_GROUPS: { key: string; label: string; prefixes: string[] }[] = [
  { key: "ihtemam", label: "ইহতিমাম", prefixes: ["students.approve_admission", "fee."] },
  { key: "teacher_staff", label: "শিক্ষক ও স্টাফ", prefixes: ["teachers.", "staff."] },
  { key: "reports", label: "রিপোর্ট সমূহ", prefixes: ["reports."] },
  {
    key: "talimat",
    label: "তালিমাত",
    prefixes: [
      "talimat.",
      "teachers.",
      "exam.",
      "result.",
      "routine.",
      "document_templates.",
      "students.session",
      "students.promote",
    ],
  },
  { key: "accounts", label: "হিসাব বিভাগ", prefixes: ["accounts.", "payroll."] },
  { key: "students", label: "শিক্ষার্থী", prefixes: ["students."] },
  { key: "fee", label: "ফি ব্যবস্থাপনা", prefixes: ["fee."] },
  { key: "attendance", label: "উপস্থিতি", prefixes: ["attendance.", "kiosk."] },
  { key: "communication", label: "SMS/ইমেইল", prefixes: ["notifications."] },
  { key: "library", label: "লাইব্রেরি", prefixes: ["library."] },
  { key: "settings", label: "সেটিং", prefixes: ["settings.", "roles.manage", "users.", "website.manage"] },
  { key: "activity", label: "অ্যাক্টিভিটি লগ", prefixes: ["activity."] },
  { key: "website", label: "ওয়েবসাইট সেটিংস", prefixes: ["website.manage"] },
];

const matchesPrefix = (keyName: string, prefixes: string[]) =>
  prefixes.some((prefix) => keyName === prefix || keyName.startsWith(prefix));

/** Groups the flat permission catalog by real sidebar module (see
 * MODULE_GROUPS above) instead of the raw "students.read" -> "students" key
 * prefix, so every module a staff member actually sees in the sidebar
 * (ইহতিমাম, উপস্থিতি, লাইব্রেরি, SMS/ইমেইল, ...) gets its own controllable
 * card here - not just the ones whose permission keys happen to share their
 * own name. Any catalog key that doesn't match a known module (e.g. a newly
 * added permission this list hasn't been updated for yet) still shows up
 * under a catch-all "অন্যান্য" group instead of silently disappearing. */
const groupByModule = (permissions: PermissionCatalogItem[]) => {
  const groups: [string, PermissionCatalogItem[]][] = MODULE_GROUPS.map((m) => [
    m.label,
    permissions.filter((p) => matchesPrefix(p.keyName || "", m.prefixes)),
  ]);

  const claimed = new Set(MODULE_GROUPS.flatMap((m) => permissions.filter((p) => matchesPrefix(p.keyName || "", m.prefixes)).map((p) => p.id)));
  const unclaimed = permissions.filter((p) => !claimed.has(p.id));
  if (unclaimed.length) groups.push(["অন্যান্য", unclaimed]);

  return groups.filter(([, perms]) => perms.length > 0);
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
            {roles.map((role) => {
              const isMuhtamim = (role.key_name || "").toUpperCase() === "MUHTAMIM";
              return (
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
                    {isMuhtamim
                      ? "সকল পারমিশন (সবসময়, পরিবর্তনযোগ্য নয়)"
                      : `${role.permission_keys.length} টি পারমিশন`}{" "}
                    · {role.user_count} জন ইউজার
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={isMuhtamim}
                    title={isMuhtamim ? "মুহতামিম সবসময় সম্পূর্ণ অ্যাক্সেস পাবেন — এটি পরিবর্তনযোগ্য নয়" : undefined}
                    onClick={() => openEditModal(role)}
                    className="flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
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
              );
            })}
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
              const someSelected = moduleKeys.some((k) => selectedKeys.has(k));
              return (
                <div
                  key={moduleName}
                  className={`rounded-lg border p-3 transition ${
                    allSelected
                      ? "border-blue-300 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20"
                      : someSelected
                        ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/10"
                        : "border-gray-200 dark:border-slate-700"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize text-gray-800 dark:text-slate-200">
                      {moduleName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-medium ${
                          allSelected
                            ? "text-blue-600 dark:text-blue-400"
                            : someSelected
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-gray-400 dark:text-slate-500"
                        }`}
                      >
                        {allSelected ? "পুরো মডিউল চালু" : someSelected ? "আংশিক চালু" : "বন্ধ"}
                      </span>
                      <ToggleSwitch
                        checked={allSelected}
                        onChange={() => toggleModuleAll(moduleKeys, allSelected)}
                        title={
                          allSelected
                            ? "পুরো মডিউলের সব পারমিশন বন্ধ করুন"
                            : "পুরো মডিউলের সব পারমিশন চালু করুন"
                        }
                      />
                    </div>
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
