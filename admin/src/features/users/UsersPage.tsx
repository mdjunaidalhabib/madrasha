import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { roleApi, userAdminApi, type RoleItem, type UserItem } from "../../services/phase3Api";
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
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { usersText } from "./users.text";

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyForm = { name: "", email: "", password: "", role_id: "" };
const fieldLabelClass = "mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400";

const UsersPage = () => {
  const t = useText(usersText);
  const c = useText(commonText);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [mobileEditId, setMobileEditId] = useState<number | null>(null);
  const [mobileDraft, setMobileDraft] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([userAdminApi.list(), roleApi.list()]);
      // GET /users returns a raw array (see user.controller.ts), not {success, data}
      const usersData = Array.isArray(usersRes.data) ? usersRes.data : normalizeArray(usersRes);
      setUsers(usersData);
      setRoles(normalizeArray(rolesRes));
    } catch (err) {
      logger.error("LOAD USERS ERROR:", err);
      setUsers([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const roleName = (roleId: number) => roles.find((r) => r.id === roleId)?.name_bn || `#${roleId}`;

  // মুহতামিম রোল এই পেজ থেকে কাউকে দেওয়া যাবে না - প্রতিটি মাদ্রাসার একজনই
  // ডিফল্ট মুহতামিম থাকতে পারেন, সেটা সুপার অ্যাডমিন প্যানেল থেকে নির্ধারিত।
  const assignableRoles = roles.filter((r) => r.key_name !== "MUHTAMIM");

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.role_id) {
      useToastStore.getState().show(t.fillRequired, "error");
      return;
    }
    try {
      setCreating(true);
      await userAdminApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: Number(form.role_id),
      });
      useToastStore.getState().show(t.userCreated, "success");
      setForm(emptyForm);
      setShowPassword(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.createFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (user: UserItem, roleId: number) => {
    try {
      await userAdminApi.update(user.id, { role_id: roleId });
      useToastStore.getState().show(t.roleChanged, "success");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, roleId } : u)));
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.roleChangeFailed;
      useToastStore.getState().show(msg, "error");
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    const nextActive = user.isActive ? false : true;
    try {
      await userAdminApi.update(user.id, { is_active: nextActive });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: nextActive ? 1 : 0 } : u)),
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.updateFailed;
      useToastStore.getState().show(msg, "error");
    }
  };

  const isLocked = (user: UserItem) =>
    Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());

  const handleSaveMobile = async (user: UserItem) => {
    try {
      await userAdminApi.update(user.id, { mobile: mobileDraft.trim() });
      useToastStore.getState().show(t.mobileSaved, "success");
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, mobile: mobileDraft.trim() || null } : u)),
      );
      setMobileEditId(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.mobileSaveFailed;
      useToastStore.getState().show(msg, "error");
    }
  };

  const handleResetPassword = async (user: UserItem) => {
    if (!resetPassword || resetPassword.length < 6) {
      useToastStore.getState().show(t.passwordMin6, "error");
      return;
    }
    try {
      setResetSubmitting(true);
      await userAdminApi.resetPassword(user.id, resetPassword);
      useToastStore.getState().show(t.passwordReset(user.name), "success");
      setResetTargetId(null);
      setResetPassword("");
      setResetShowPassword(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.passwordResetFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleUnlock = async (user: UserItem) => {
    try {
      setUnlockingId(user.id);
      await userAdminApi.unlock(user.id);
      useToastStore.getState().show(t.unlocked(user.name), "success");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, lockedUntil: null } : u)));
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.unlockFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setUnlockingId(null);
    }
  };

  const handleDelete = (user: UserItem) => {
    useConfirmStore.getState().show({
      title: t.deleteTitle,
      message: t.deleteMessage(user.name, user.email),
      confirmText: t.deleteConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          await userAdminApi.remove(user.id);
          useToastStore.getState().show(t.userDeleted, "success");
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
        } catch (err: any) {
          const msg = err?.response?.data?.message || c.deleteFailed;
          useToastStore.getState().show(msg, "error");
        }
      },
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
      />

      <SectionCard title={t.addNewUser}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={fieldLabelClass}>{c.name}</label>
            <Input
              type="text"
              placeholder={t.staffName}
              name="staff-name"
              autoComplete="off"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-10"
            />
          </div>

          <div>
            <label className={fieldLabelClass}>{c.email}</label>
            <Input
              type="email"
              placeholder={t.loginEmail}
              name="staff-email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="h-10"
            />
          </div>

          <div>
            <label className={fieldLabelClass}>{t.password}</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={t.min6Chars}
                name="staff-new-password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="h-10 pe-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-2.5 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className={fieldLabelClass}>{t.role}</label>
            <select
              value={form.role_id}
              onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t.selectRole}</option>
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
            {t.headRoleNote}
          </p>
          <Button disabled={creating} onClick={handleCreate} className="gap-1.5">
            {!creating && <Plus size={15} />}
            {creating ? t.creating : c.add}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t.allUsers}>
        {loading ? (
          <SkeletonList items={6} />
        ) : users.length === 0 ? (
          <EmptyState title={t.noUsers} />
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
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
                      {roleName(user.roleId)}
                    </span>
                    {user.isMuhtamim && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        {t.defaultHead}
                      </span>
                    )}
                    {!user.isActive && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                        {c.inactive}
                      </span>
                    )}
                    {isLocked(user) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                        <Lock size={10} /> {t.locked}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                    {mobileEditId === user.id ? (
                      <>
                        <Input
                          type="text"
                          placeholder={t.mobileNumber}
                          autoComplete="off"
                          value={mobileDraft}
                          onChange={(e) => setMobileDraft(e.target.value)}
                          className="h-7 w-36 text-xs"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveMobile(user)}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {t.save}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileEditId(null)}
                          className="text-gray-400 hover:underline"
                        >
                          {c.cancel}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileEditId(user.id);
                          setMobileDraft(user.mobile || "");
                        }}
                        className="hover:underline"
                      >
                        {user.mobile || t.addMobile}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={user.roleId}
                    onChange={(e) => handleRoleChange(user, Number(e.target.value))}
                    disabled={user.isMuhtamim}
                    title={user.isMuhtamim ? t.superAdminOnly : undefined}
                    className="h-9 rounded-lg border border-gray-300 px-2 text-xs outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
                  >
                    {/* মুহতামিমের নিজের রোলটা তালিকায় না থাকলে select-এ ভুল
                        value দেখাবে, তাই এই একটা ক্ষেত্রেই সেটাকে যোগ করা হচ্ছে। */}
                    {user.isMuhtamim && (
                      <option key={user.roleId} value={user.roleId}>
                        {roleName(user.roleId)}
                      </option>
                    )}
                    {assignableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name_bn}
                      </option>
                    ))}
                  </select>
                  <ToggleSwitch
                    checked={Boolean(user.isActive)}
                    onChange={() => handleToggleActive(user)}
                    disabled={user.isMuhtamim}
                    title={
                      user.isMuhtamim
                        ? t.superAdminOnly
                        : user.isActive
                          ? t.deactivate
                          : t.activate
                    }
                  />
                  {!user.isMuhtamim && isLocked(user) && (
                    <button
                      type="button"
                      onClick={() => handleUnlock(user)}
                      disabled={unlockingId === user.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
                      title={t.unlockAccount}
                    >
                      <Unlock size={14} />
                      {unlockingId === user.id ? t.unlocking : t.unlock}
                    </button>
                  )}
                  {!user.isMuhtamim && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetTargetId(resetTargetId === user.id ? null : user.id);
                        setResetPassword("");
                        setResetShowPassword(false);
                      }}
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                      title={t.resetPassword}
                    >
                      <KeyRound size={16} />
                    </button>
                  )}
                  {!user.isMuhtamim && (
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                      title={c.delete}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {resetTargetId === user.id && (
                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
                  <div className="relative">
                    <Input
                      type={resetShowPassword ? "text" : "password"}
                      placeholder={t.newPasswordMin6}
                      autoComplete="new-password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="h-9 w-56 pe-9 text-xs"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setResetShowPassword((v) => !v)}
                      className="absolute inset-y-0 end-0 flex items-center px-2.5 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                      tabIndex={-1}
                    >
                      {resetShowPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <Button
                    disabled={resetSubmitting}
                    onClick={() => handleResetPassword(user)}
                    className="h-9 px-3 text-xs"
                  >
                    {resetSubmitting ? c.saving : t.setPassword}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setResetTargetId(null)}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    {c.cancel}
                  </button>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default UsersPage;
