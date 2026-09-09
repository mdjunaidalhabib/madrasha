import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import {
  getMadrasa,
  listMadrasaUsers,
  createMadrasaUser,
  deleteMadrasaUser,
  updateMadrasaUserCredentials,
  updateMadrasaUserRoleStatus,
  listMadrasaPermissionCatalog,
  listMadrasaRolePermissions,
  createMadrasaRole,
  updateMadrasaRole,
  deleteMadrasaRole,
  type MadrasaUserItem,
  type PermissionCatalogItem,
  type MadrasaRolePermissionItem,
} from "../../../services/superAdminApi";

const MUHTAMIM_KEY = "MUHTAMIM";

/* =========================
Small local building blocks (super-admin has no SectionCard/ToggleSwitch of
its own - the tenant admin app's versions live in admin/src/components and
aren't shared, so equivalents are kept local to this file).
========================= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {children}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      title={title}
      aria-pressed={checked}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${
        checked ? "bg-blue-600" : "bg-gray-300 dark:bg-slate-700"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* =========================
Permission grouping - ported from admin/src/features/roles/RolesPermissionsPage.tsx
(MODULE_GROUPS mirrors the real sidebar modules / backend
MODULE_PERMISSION_PREFIXES) so the permission matrix reads exactly the same
way here as it does in the tenant's own Roles & Permissions page.
========================= */

const MODULE_GROUPS: { key: string; label: string; prefixes: string[] }[] = [
  { key: "ihtemam", label: "ইহতিমাম", prefixes: ["students.approve_admission", "fee.", "activity."] },
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
  { key: "website", label: "ওয়েবসাইট সেটিংস", prefixes: ["website.manage"] },
];

const matchesPrefix = (keyName: string, prefixes: string[]) =>
  prefixes.some((prefix) => keyName === prefix || keyName.startsWith(prefix));

const groupByModule = (permissions: PermissionCatalogItem[]) => {
  const groups: [string, PermissionCatalogItem[]][] = MODULE_GROUPS.map((m) => [
    m.label,
    permissions.filter((p) => matchesPrefix(p.keyName || "", m.prefixes)),
  ]);
  const claimed = new Set(
    MODULE_GROUPS.flatMap((m) =>
      permissions.filter((p) => matchesPrefix(p.keyName || "", m.prefixes)).map((p) => p.id),
    ),
  );
  const unclaimed = permissions.filter((p) => !claimed.has(p.id));
  if (unclaimed.length) groups.push(["অন্যান্য", unclaimed]);
  return groups.filter(([, perms]) => perms.length > 0);
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

export default function SuperAdminMadrasaStaffPage() {
  const { id } = useParams<{ id: string }>();
  const madrasaId = Number(id);
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.show);

  const [madrasaName, setMadrasaName] = useState("");
  const [tab, setTab] = useState<"staff" | "roles">("staff");

  useEffect(() => {
    getMadrasa(madrasaId)
      .then((res) => setMadrasaName(res?.data?.name || ""))
      .catch((err) => logger.error("LOAD MADRASA NAME ERROR:", err));
  }, [madrasaId]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/madrasas")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          title="মাদ্রাসা লিস্টে ফিরে যান"
        >
          <ArrowLeft size={18} />
        </button>
        <PageHeader
          title="স্টাফ, রোল ও পারমিশন"
          subtitle={madrasaName ? `মাদ্রাসা: ${madrasaName}` : undefined}
        />
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {[
          { key: "staff", label: "স্টাফ" },
          { key: "roles", label: "রোল ও পারমিশন" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as "staff" | "roles")}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.key
                ? "border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "staff" ? (
        <StaffTab madrasaId={madrasaId} toast={toast} />
      ) : (
        <RolesTab madrasaId={madrasaId} toast={toast} />
      )}
    </div>
  );
}

/* =========================
স্টাফ ট্যাব - admin/src/features/users/UsersPage.tsx-এর সমমান, সুপার অ্যাডমিন
এন্ডপয়েন্ট দিয়ে - মুহতামিম রো-তে রোল/ডিলিট ব্লকড কিন্তু স্ট্যাটাস-টগল allowed।
========================= */

const emptyUserForm = { name: "", email: "", password: "", role_id: "" };

function StaffTab({ madrasaId, toast }: { madrasaId: number; toast: (msg: string, type?: any) => void }) {
  const [users, setUsers] = useState<MadrasaUserItem[]>([]);
  const [roles, setRoles] = useState<MadrasaRolePermissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(emptyUserForm);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordVisible, setEditPasswordVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        listMadrasaUsers(madrasaId),
        listMadrasaRolePermissions(madrasaId),
      ]);
      setUsers(normalizeArray(usersRes));
      setRoles(normalizeArray(rolesRes));
    } catch (err) {
      logger.error("LOAD MADRASA STAFF ERROR:", err);
      toast("স্টাফ লোড করা যায়নি", "error");
    } finally {
      setLoading(false);
    }
  }, [madrasaId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const roleName = (roleId: number) => roles.find((r) => r.id === roleId)?.name_bn || `#${roleId}`;
  // মুহতামিম রোল এখান থেকে দেওয়া যায় না - প্রতি মাদ্রাসায় ঠিক একজন মুহতামিম
  // থাকা আবশ্যক, সেই স্লট createMadrasa/updateMadrasaUserCredentials দিয়ে
  // নির্ধারিত।
  const assignableRoles = roles.filter((r) => r.key_name !== MUHTAMIM_KEY);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.role_id) {
      toast("নাম, ইমেইল, পাসওয়ার্ড ও রোল দিন", "error");
      return;
    }
    setCreating(true);
    try {
      await createMadrasaUser(madrasaId, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: Number(form.role_id),
      });
      toast("স্টাফ তৈরি হয়েছে", "success");
      setForm(emptyUserForm);
      setShowPassword(false);
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || "তৈরি করতে সমস্যা হয়েছে", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (user: MadrasaUserItem, roleId: number) => {
    try {
      await updateMadrasaUserRoleStatus(madrasaId, user.id, { role_id: roleId });
      toast("রোল পরিবর্তন করা হয়েছে", "success");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role_id: roleId } : u)));
    } catch (err: any) {
      toast(err?.response?.data?.message || "রোল পরিবর্তন করতে সমস্যা হয়েছে", "error");
    }
  };

  const handleToggleActive = async (user: MadrasaUserItem) => {
    const nextActive = !user.is_active;
    try {
      await updateMadrasaUserRoleStatus(madrasaId, user.id, { is_active: nextActive });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: nextActive ? 1 : 0 } : u)));
    } catch (err: any) {
      toast(err?.response?.data?.message || "আপডেট করতে সমস্যা হয়েছে", "error");
    }
  };

  const startEdit = (user: MadrasaUserItem) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword("");
    setEditPasswordVisible(false);
  };

  const saveEdit = async (user: MadrasaUserItem) => {
    const name = editName.trim();
    const email = editEmail.trim();
    if (!name) return toast("নাম দিন", "error");
    if (!email) return toast("Email দিন", "error");
    if (editPassword && editPassword.length < 6) {
      return toast("Password কমপক্ষে ৬ অক্ষরের হতে হবে", "error");
    }
    setSavingEdit(true);
    try {
      await updateMadrasaUserCredentials(madrasaId, user.id, {
        name,
        email,
        ...(editPassword ? { password: editPassword } : {}),
      });
      toast("তথ্য আপডেট হয়েছে", "success");
      setEditingUserId(null);
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || "আপডেট করা যায়নি", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (user: MadrasaUserItem) => {
    useConfirmStore.getState().show({
      title: "স্টাফ ডিলিট করুন",
      message: `"${user.name}" (${user.email}) কে স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        setBusyUserId(user.id);
        try {
          await deleteMadrasaUser(madrasaId, user.id);
          toast("স্টাফ মুছে ফেলা হয়েছে", "success");
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
        } catch (err: any) {
          toast(err?.response?.data?.message || "মুছতে সমস্যা হয়েছে", "error");
        } finally {
          setBusyUserId(null);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <Section title="নতুন স্টাফ যুক্ত করুন">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">নাম</label>
            <Input
              type="text"
              placeholder="স্টাফের নাম"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-10"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">ইমেইল</label>
            <Input
              type="email"
              placeholder="লগইন ইমেইল"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="h-10"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পাসওয়ার্ড</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="কমপক্ষে ৬ অক্ষর"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="h-10 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">রোল</label>
            <select
              value={form.role_id}
              onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">রোল নির্বাচন করুন</option>
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name_bn}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4 dark:border-slate-800">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            মুহতামিম রোল এখান থেকে দেওয়া যায় না — প্রতিটি মাদ্রাসার একজনই ডিফল্ট মুহতামিম থাকতে পারেন।
          </p>
          <Button disabled={creating} onClick={handleCreate} className="gap-1.5">
            {!creating && <Plus size={15} />}
            {creating ? "তৈরি হচ্ছে..." : "যুক্ত করুন"}
          </Button>
        </div>
      </Section>

      <Section title="সব স্টাফ">
        {loading ? (
          <SkeletonList items={6} />
        ) : users.length === 0 ? (
          <EmptyState title="কোনো স্টাফ নেই" />
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const isMuhtamim = user.role_key === MUHTAMIM_KEY;
              return (
                <div
                  key={user.id}
                  className="group flex flex-col gap-3 rounded-xl border border-gray-100 p-4 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-900 dark:text-slate-100">{user.name}</span>
                        <span className="text-gray-500 dark:text-slate-400">({user.email})</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                          {roleName(user.role_id)}
                        </span>
                        {isMuhtamim && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                            ডিফল্ট মুহতামিম
                          </span>
                        )}
                        {!user.is_active && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            নিষ্ক্রিয়
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={user.role_id}
                        onChange={(e) => handleRoleChange(user, Number(e.target.value))}
                        disabled={isMuhtamim}
                        title={isMuhtamim ? "মুহতামিমের রোল পরিবর্তনযোগ্য নয়" : undefined}
                        className="h-9 rounded-lg border border-gray-300 px-2 text-xs outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
                      >
                        {isMuhtamim && (
                          <option key={user.role_id} value={user.role_id}>
                            {roleName(user.role_id)}
                          </option>
                        )}
                        {assignableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name_bn}
                          </option>
                        ))}
                      </select>
                      <ToggleSwitch
                        checked={Boolean(user.is_active)}
                        onChange={() => handleToggleActive(user)}
                        title={user.is_active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                      />
                      <button
                        type="button"
                        onClick={() => startEdit(user)}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                        title="নাম/ইমেইল/পাসওয়ার্ড পরিবর্তন"
                      >
                        <KeyRound size={16} />
                      </button>
                      {!isMuhtamim && (
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          disabled={busyUserId === user.id}
                          className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                          title="মুছুন"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {editingUserId === user.id && (
                    <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
                      <Input
                        type="text"
                        placeholder="নাম"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-9 w-40 text-xs"
                      />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="h-9 w-48 text-xs"
                      />
                      <div className="relative">
                        <Input
                          type={editPasswordVisible ? "text" : "password"}
                          placeholder="নতুন Password (ঐচ্ছিক)"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          className="h-9 w-48 pr-9 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setEditPasswordVisible((v) => !v)}
                          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                          tabIndex={-1}
                        >
                          {editPasswordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <Button disabled={savingEdit} onClick={() => saveEdit(user)} className="h-9 px-3 text-xs">
                        {savingEdit ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setEditingUserId(null)}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        বাতিল
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

/* =========================
রোল ও পারমিশন ট্যাব - admin/src/features/roles/RolesPermissionsPage.tsx-এর
সমমান, সুপার অ্যাডমিন এন্ডপয়েন্ট দিয়ে (যেগুলো ভেতরে সরাসরি roleService-কেই
কল করে - তাই আচরণ tenant পেজের সাথে হুবহু মেলে)।
========================= */

function RolesTab({ madrasaId, toast }: { madrasaId: number; toast: (msg: string, type?: any) => void }) {
  const [roles, setRoles] = useState<MadrasaRolePermissionItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingRole, setEditingRole] = useState<MadrasaRolePermissionItem | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        listMadrasaRolePermissions(madrasaId),
        listMadrasaPermissionCatalog(madrasaId),
      ]);
      setRoles(normalizeArray(rolesRes));
      setPermissions(normalizeArray(permsRes));
    } catch (err) {
      logger.error("LOAD MADRASA ROLES/PERMISSIONS ERROR:", err);
      toast("রোল/পারমিশন লোড করা যায়নি", "error");
    } finally {
      setLoading(false);
    }
  }, [madrasaId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => groupByModule(permissions), [permissions]);

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return toast("রোলের নাম দিন", "error");
    setCreating(true);
    try {
      await createMadrasaRole(madrasaId, { name_bn: newRoleName.trim() });
      toast("রোল তৈরি হয়েছে", "success");
      setNewRoleName("");
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || "রোল তৈরি করতে সমস্যা হয়েছে", "error");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (role: MadrasaRolePermissionItem) => {
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
    setSaving(true);
    try {
      await updateMadrasaRole(madrasaId, editingRole.id, { permission_keys: Array.from(selectedKeys) });
      toast("পারমিশন সংরক্ষণ করা হয়েছে", "success");
      setEditingRole(null);
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || "সংরক্ষণ করতে সমস্যা হয়েছে", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (role: MadrasaRolePermissionItem) => {
    useConfirmStore.getState().show({
      title: "রোল ডিলিট করুন",
      message: `"${role.name_bn}" রোলটি স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteMadrasaRole(madrasaId, role.id);
          toast("রোল মুছে ফেলা হয়েছে", "success");
          setRoles((prev) => prev.filter((r) => r.id !== role.id));
        } catch (err: any) {
          toast(err?.response?.data?.message || "মুছতে সমস্যা হয়েছে", "error");
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <Section title="নতুন রোল তৈরি করুন">
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
      </Section>

      <Section title="সব রোল">
        {loading ? (
          <SkeletonList items={6} />
        ) : roles.length === 0 ? (
          <EmptyState title="কোনো রোল নেই" />
        ) : (
          <div className="space-y-3">
            {roles.map((role) => {
              const isMuhtamim = (role.key_name || "").toUpperCase() === MUHTAMIM_KEY;
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
                      · {role.user_count} জন স্টাফ
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
                        title={role.user_count > 0 ? "এই রোলে স্টাফ আছে বলে মুছা যাবে না" : "মুছুন"}
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
      </Section>

      <Modal
        open={!!editingRole}
        title={`পারমিশন সেট করুন — ${editingRole?.name_bn || ""}`}
        onClose={() => setEditingRole(null)}
      >
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="flex flex-col gap-3">
            {grouped.map(([moduleName, modulePermissions]) => {
              const moduleKeys = modulePermissions.map((p) => p.keyName || "");
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
                          checked={selectedKeys.has(permission.keyName || "")}
                          onChange={() => toggleKey(permission.keyName || "")}
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
}
