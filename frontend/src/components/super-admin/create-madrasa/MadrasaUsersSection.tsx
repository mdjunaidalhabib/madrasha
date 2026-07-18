import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Button from "../../ui/Button";
import {
  createMadrasaUser,
  deleteMadrasaUser,
  listMadrasaRoles,
  listMadrasaUsers,
  type MadrasaRoleItem,
  type MadrasaUserItem,
} from "../../../services/superAdminApi";
import { useToastStore } from "../../../store/toastStore";
import { useConfirmStore } from "../../../store/confirmStore";
import { logger } from "../../../utils/logger";

type Props = {
  madrasaId: number;
};

/** This is the madrasa's default/owner role — every madrasa gets one on
 * creation and it must always keep exactly one active account. It is
 * shown as "Required" and can never be deleted from this screen. */
const DEFAULT_PROTECTED_ROLE_KEY = "MUHTAMIM";

const emptyForm = { name: "", email: "", password: "" };
type FormState = typeof emptyForm;

export default function MadrasaUsersSection({ madrasaId }: Props) {
  const { show } = useToastStore();

  const [roles, setRoles] = useState<MadrasaRoleItem[]>([]);
  const [users, setUsers] = useState<MadrasaUserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // One independent add-user form per role, keyed by role id.
  const [forms, setForms] = useState<Record<number, FormState>>({});
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});

  const toggleVisible = (roleId: number) =>
    setVisiblePasswords((prev) => ({ ...prev, [roleId]: !prev[roleId] }));

  const load = async () => {
    setLoading(true);
    try {
      const [rolesRes, usersRes] = await Promise.all([
        listMadrasaRoles(madrasaId),
        listMadrasaUsers(madrasaId),
      ]);

      const roleRows: MadrasaRoleItem[] = rolesRes?.data ?? [];
      const userRows: MadrasaUserItem[] = usersRes?.data ?? [];

      setRoles(roleRows);
      setUsers(userRows);
    } catch (err) {
      logger.error("Failed to load madrasa users/roles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [madrasaId]);

  // Existing user (if any) for each role — a role slot that is already
  // filled never shows the "add user" form again for that role.
  const userByRoleId = useMemo(() => {
    const map = new Map<number, MadrasaUserItem>();
    users.forEach((u) => map.set(u.role_id, u));
    return map;
  }, [users]);

  const updateForm = (roleId: number, key: keyof FormState, value: string) =>
    setForms((prev) => ({
      ...prev,
      [roleId]: { ...(prev[roleId] || emptyForm), [key]: value },
    }));

  const onAddUser = async (role: MadrasaRoleItem) => {
    const form = forms[role.id] || emptyForm;

    if (!form.name.trim()) return show("User নাম দিন", "error");
    if (!form.email.trim()) return show("Email দিন", "error");
    if (form.password.length < 6) return show("Password কমপক্ষে ৬ অক্ষরের হতে হবে", "error");

    setSavingRoleId(role.id);
    try {
      await createMadrasaUser(madrasaId, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: role.id,
      });

      show(`${role.name || role.key} যোগ করা হয়েছে`, "success");
      setForms((prev) => ({ ...prev, [role.id]: emptyForm }));
      await load();
    } catch (err: any) {
      show(err?.response?.data?.message || "User যোগ করা যায়নি", "error");
    } finally {
      setSavingRoleId(null);
    }
  };

  const onDeleteUser = (u: MadrasaUserItem) => {
    // Defense in depth: the backend also rejects this, but there is no
    // reason to even offer the option for the default user in the UI.
    if (u.role_key === DEFAULT_PROTECTED_ROLE_KEY) return;

    useConfirmStore.getState().show({
      title: "Delete User",
      message: `"${u.name}" (${u.email}) কে ডিলিট করতে চান?`,
      confirmText: "Delete",
      danger: true,
      onConfirm: async () => {
        setBusyUserId(u.id);
        try {
          await deleteMadrasaUser(madrasaId, u.id);
          show("User ডিলিট হয়েছে", "success");
          await load();
        } catch (err: any) {
          show(err?.response?.data?.message || "Delete failed", "error");
        } finally {
          setBusyUserId(null);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Users</h3>

      {loading ? (
        <p className="text-sm text-gray-500">Loading users...</p>
      ) : !roles.length ? (
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">No roles found for this madrasa.</p>
        </div>
      ) : (
        roles.map((role) => {
          const isDefault = role.key === DEFAULT_PROTECTED_ROLE_KEY;
          const existingUser = userByRoleId.get(role.id);
          const form = forms[role.id] || emptyForm;
          const isSaving = savingRoleId === role.id;
          const isDeleting = existingUser ? busyUserId === existingUser.id : false;

          return (
            <div key={role.id} className="space-y-3 rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{role.name || role.key}</span>

                {isDefault && (
                  <span className="text-sm font-medium text-green-600">Required</span>
                )}
              </div>

              {existingUser ? (
                /* Role slot already filled — show the existing account instead
                   of a "create new" form, so the same role can never be
                   created twice. */
                <div className="flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{existingUser.name}</span>
                      {existingUser.is_active ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-gray-500">{existingUser.email}</div>
                  </div>

                  {isDefault ? (
                    <span className="self-start text-xs text-gray-400 sm:self-auto">
                      Default user — cannot be deleted
                    </span>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => onDeleteUser(existingUser)}
                      disabled={isDeleting}
                      className="self-start sm:self-auto"
                    >
                      {isDeleting ? "..." : "Delete"}
                    </Button>
                  )}
                </div>
              ) : (
                /* No account yet for this role — offer the add-user form. */
                <div className="space-y-2">
                  <input
                    placeholder="Name"
                    autoComplete="off"
                    value={form.name}
                    onChange={(e) => updateForm(role.id, "name", e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />

                  <input
                    type="email"
                    placeholder="Email"
                    autoComplete="off"
                    value={form.email}
                    onChange={(e) => updateForm(role.id, "email", e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />

                  <div className="relative">
                    <input
                      type={visiblePasswords[role.id] ? "text" : "password"}
                      placeholder="Password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => updateForm(role.id, "password", e.target.value)}
                      className="w-full rounded border px-3 py-2 pr-10"
                    />

                    <button
                      type="button"
                      onClick={() => toggleVisible(role.id)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                      aria-label={visiblePasswords[role.id] ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {visiblePasswords[role.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <Button
                    onClick={() => onAddUser(role)}
                    disabled={isSaving}
                    className="w-full sm:w-auto"
                  >
                    {isSaving ? "Adding..." : `+ Add ${role.name || role.key}`}
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
