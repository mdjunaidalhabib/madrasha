import { useCallback, useEffect, useState } from "react";
import { roleApi, userAdminApi, type RoleItem, type UserItem } from "../../services/phase3Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyForm = { name: "", email: "", password: "", role_id: "" };

const UsersPage = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

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

  const handleDelete = async (user: UserItem) => {
    try {
      await userAdminApi.remove(user.id);
      useToastStore.getState().show("ইউজার মুছে ফেলা হয়েছে", "success");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">স্টাফ ব্যবস্থাপনা</h1>
          <p className="mt-1 text-sm text-gray-500">
            যারা এই প্যানেলে লগইন করবে তাদের অ্যাকাউন্ট তৈরি ও রোল নির্ধারণ করুন
          </p>
        </div>

        {/* Create user */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">নতুন ইউজার যোগ করুন</h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="text"
              placeholder="নাম"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[160px]"
            />
            <input
              type="email"
              placeholder="ইমেইল"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[180px]"
            />
            <input
              type="password"
              placeholder="পাসওয়ার্ড"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[150px]"
            />
            <select
              value={form.role_id}
              onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[160px]"
            >
              <option value="">রোল নির্বাচন করুন</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name_bn}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              {creating ? "তৈরি হচ্ছে..." : "যোগ করুন"}
            </button>
          </div>
        </div>

        {/* User list */}
        <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">লোড হচ্ছে...</div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">কোনো ইউজার নেই</div>
          ) : (
            <div className="flex flex-col gap-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <span className="font-semibold text-gray-800">{user.name}</span>{" "}
                    <span className="text-gray-500">({user.email})</span>{" "}
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {roleName(user.roleId)}
                    </span>
                    {!user.isActive && (
                      <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-600">
                        নিষ্ক্রিয়
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <select
                      value={user.roleId}
                      onChange={(e) => handleRoleChange(user, Number(e.target.value))}
                      className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none"
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name_bn}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(user)}
                      className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      {user.isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      className="h-8 rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100"
                    >
                      মুছুন
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
