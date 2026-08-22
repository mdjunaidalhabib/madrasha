import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { roleApi, userAdminApi, type RoleItem, type UserItem } from "../../services/phase3Api";
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

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyForm = { name: "", email: "", password: "", role_id: "" };
const fieldLabelClass = "mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400";

const UsersPage = () => {
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
      useToastStore.getState().show("নাম, ইমেইল, পাসওয়ার্ড ও রোল দিন", "error");
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
      useToastStore.getState().show("ইউজার তৈরি হয়েছে", "success");
      setForm(emptyForm);
      setShowPassword(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "ইউজার তৈরি করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (user: UserItem, roleId: number) => {
    try {
      await userAdminApi.update(user.id, { role_id: roleId });
      useToastStore.getState().show("রোল পরিবর্তন করা হয়েছে", "success");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, roleId } : u)));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "রোল পরিবর্তন করতে সমস্যা হয়েছে";
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
      const msg = err?.response?.data?.message || "আপডেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  const isLocked = (user: UserItem) =>
    Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());

  const handleSaveMobile = async (user: UserItem) => {
    try {
      await userAdminApi.update(user.id, { mobile: mobileDraft.trim() });
      useToastStore.getState().show("মোবাইল নম্বর সংরক্ষণ হয়েছে", "success");
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, mobile: mobileDraft.trim() || null } : u)),
      );
      setMobileEditId(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মোবাইল সংরক্ষণ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  const handleResetPassword = async (user: UserItem) => {
    if (!resetPassword || resetPassword.length < 6) {
      useToastStore.getState().show("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", "error");
      return;
    }
    try {
      setResetSubmitting(true);
      await userAdminApi.resetPassword(user.id, resetPassword);
      useToastStore.getState().show(`"${user.name}"-এর পাসওয়ার্ড রিসেট হয়েছে`, "success");
      setResetTargetId(null);
      setResetPassword("");
      setResetShowPassword(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "পাসওয়ার্ড রিসেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleUnlock = async (user: UserItem) => {
    try {
      setUnlockingId(user.id);
      await userAdminApi.unlock(user.id);
      useToastStore.getState().show(`"${user.name}"-এর অ্যাকাউন্ট আনলক হয়েছে`, "success");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, lockedUntil: null } : u)));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "আনলক করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setUnlockingId(null);
    }
  };

  const handleDelete = (user: UserItem) => {
    useConfirmStore.getState().show({
      title: "ইউজার ডিলিট করুন",
      message: `"${user.name}" (${user.email}) কে স্থায়ীভাবে মুছে ফেলতে চান? তিনি আর এই প্যানেলে লগইন করতে পারবেন না।`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await userAdminApi.remove(user.id);
          useToastStore.getState().show("ইউজার মুছে ফেলা হয়েছে", "success");
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
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
        title="স্টাফ ব্যবস্থাপনা"
        subtitle="যারা এই প্যানেলে লগইন করবে তাদের অ্যাকাউন্ট তৈরি ও রোল নির্ধারণ করুন"
      />

      <SectionCard title="নতুন ইউজার যোগ করুন">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={fieldLabelClass}>নাম</label>
            <Input
              type="text"
              placeholder="স্টাফের নাম"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-10"
            />
          </div>

          <div>
            <label className={fieldLabelClass}>ইমেইল</label>
            <Input
              type="email"
              placeholder="লগইন ইমেইল"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="h-10"
            />
          </div>

          <div>
            <label className={fieldLabelClass}>পাসওয়ার্ড</label>
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
                aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className={fieldLabelClass}>রোল</label>
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
            {creating ? "তৈরি হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="সব ইউজার">
        {loading ? (
          <SkeletonList items={6} />
        ) : users.length === 0 ? (
          <EmptyState title="কোনো ইউজার নেই" />
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
                        ডিফল্ট মুহতামিম
                      </span>
                    )}
                    {!user.isActive && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                        নিষ্ক্রিয়
                      </span>
                    )}
                    {isLocked(user) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                        <Lock size={10} /> লকড
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                    {mobileEditId === user.id ? (
                      <>
                        <Input
                          type="text"
                          placeholder="মোবাইল নম্বর"
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
                          সংরক্ষণ
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileEditId(null)}
                          className="text-gray-400 hover:underline"
                        >
                          বাতিল
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
                        {user.mobile || "মোবাইল যোগ করুন"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={user.roleId}
                    onChange={(e) => handleRoleChange(user, Number(e.target.value))}
                    disabled={user.isMuhtamim}
                    title={user.isMuhtamim ? "শুধু সুপার অ্যাডমিন এটি পরিবর্তন করতে পারবেন" : undefined}
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
                        ? "শুধু সুপার অ্যাডমিন এটি পরিবর্তন করতে পারবেন"
                        : user.isActive
                          ? "নিষ্ক্রিয় করুন"
                          : "সক্রিয় করুন"
                    }
                  />
                  {!user.isMuhtamim && isLocked(user) && (
                    <button
                      type="button"
                      onClick={() => handleUnlock(user)}
                      disabled={unlockingId === user.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
                      title="অ্যাকাউন্ট আনলক করুন"
                    >
                      <Unlock size={14} />
                      {unlockingId === user.id ? "আনলক হচ্ছে..." : "আনলক"}
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
                      title="পাসওয়ার্ড রিসেট করুন"
                    >
                      <KeyRound size={16} />
                    </button>
                  )}
                  {!user.isMuhtamim && (
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                      title="মুছুন"
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
                      placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="h-9 w-56 pr-9 text-xs"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setResetShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
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
                    {resetSubmitting ? "সংরক্ষণ হচ্ছে..." : "পাসওয়ার্ড সেট করুন"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setResetTargetId(null)}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    বাতিল
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
