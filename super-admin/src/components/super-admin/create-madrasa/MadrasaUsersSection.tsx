import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import {
  createMadrasaUser,
  deleteMadrasaUser,
  listMadrasaRoles,
  listMadrasaUsers,
  updateMadrasaUserCredentials,
  type MadrasaRoleItem,
  type MadrasaUserItem,
} from "../../../services/superAdminApi";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { commonText, getText, useText } from "@madrasha/shared-ui/src/i18n";
import { createMadrasaText } from "./createMadrasa.text";

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
  const t = useText(createMadrasaText);
  const c = useText(commonText);

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

  // মুহতামিম লক-আউট হলে সুপার অ্যাডমিন এখান থেকে সরাসরি ইমেইল/পাসওয়ার্ড রিসেট
  // করতে পারেন - এটাই একমাত্র জায়গা যেখানে ডিফল্ট (মুহতামিম) ইউজারের ক্রেডেনশিয়াল
  // বদলানো ইচ্ছাকৃতভাবে allowed।
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [credName, setCredName] = useState("");
  const [credEmail, setCredEmail] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credVisible, setCredVisible] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);

  const startEditCredentials = (u: MadrasaUserItem) => {
    setEditingUserId(u.id);
    setCredName(u.name);
    setCredEmail(u.email);
    setCredPassword("");
    setCredVisible(false);
  };

  const cancelEditCredentials = () => setEditingUserId(null);

  const saveCredentials = async (u: MadrasaUserItem) => {
    const name = credName.trim();
    const email = credEmail.trim();
    if (!name) return show(t.errName, "error");
    if (!email) return show(t.errEmail, "error");
    if (credPassword && credPassword.length < 6) {
      return show(t.errPasswordMin, "error");
    }

    setSavingCreds(true);
    try {
      await updateMadrasaUserCredentials(madrasaId, u.id, {
        name,
        email,
        ...(credPassword ? { password: credPassword } : {}),
      });
      show(t.credentialsUpdated, "success");
      setEditingUserId(null);
      await load();
    } catch (err: any) {
      show(err?.response?.data?.message || t.updateFailed, "error");
    } finally {
      setSavingCreds(false);
    }
  };

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

  // এখান থেকে শুধু মুহতামিমের (required, default) অ্যাকাউন্টই বানানো/দেখানো হয় -
  // তালিমাত/হিসাবরক্ষকের মতো অন্য রোলের লগইন এখন মুহতামিম নিজেই তার dynamic
  // Users/Roles সেটিংস থেকে বানান, তাই এখানে আলাদা "+ Add User" কার্ড দেখানো
  // রিডানডেন্ট।
  const visibleRoles = useMemo(
    () => roles.filter((r) => r.key === DEFAULT_PROTECTED_ROLE_KEY),
    [roles],
  );

  const updateForm = (roleId: number, key: keyof FormState, value: string) =>
    setForms((prev) => ({
      ...prev,
      [roleId]: { ...(prev[roleId] || emptyForm), [key]: value },
    }));

  const onAddUser = async (role: MadrasaRoleItem) => {
    const form = forms[role.id] || emptyForm;

    if (!form.name.trim()) return show(t.enterUserName, "error");
    if (!form.email.trim()) return show(t.errEmail, "error");
    if (form.password.length < 6) return show(t.errPasswordMin, "error");

    setSavingRoleId(role.id);
    try {
      await createMadrasaUser(madrasaId, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: role.id,
      });

      show(t.roleAdded(role.name || role.key || ""), "success");
      setForms((prev) => ({ ...prev, [role.id]: emptyForm }));
      await load();
    } catch (err: any) {
      show(err?.response?.data?.message || t.addUserFailed, "error");
    } finally {
      setSavingRoleId(null);
    }
  };

  const onDeleteUser = (u: MadrasaUserItem) => {
    // Defense in depth: the backend also rejects this, but there is no
    // reason to even offer the option for the default user in the UI.
    if (u.role_key === DEFAULT_PROTECTED_ROLE_KEY) return;

    const tx = getText(createMadrasaText);
    useConfirmStore.getState().show({
      title: tx.deleteUserTitle,
      message: tx.deleteUserMessage(u.name, u.email),
      confirmText: getText(commonText).delete,
      danger: true,
      onConfirm: async () => {
        setBusyUserId(u.id);
        try {
          await deleteMadrasaUser(madrasaId, u.id);
          show(tx.userDeleted, "success");
          await load();
        } catch (err: any) {
          show(err?.response?.data?.message || getText(commonText).deleteFailed, "error");
        } finally {
          setBusyUserId(null);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold dark:text-slate-100">{t.users}</h3>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{t.loadingUsers}</p>
      ) : !visibleRoles.length ? (
        <div className="rounded-lg border p-4 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-slate-400">{t.noRoles}</p>
        </div>
      ) : (
        visibleRoles.map((role) => {
          const isDefault = role.key === DEFAULT_PROTECTED_ROLE_KEY;
          const existingUser = userByRoleId.get(role.id);
          const form = forms[role.id] || emptyForm;
          const isSaving = savingRoleId === role.id;
          const isDeleting = existingUser ? busyUserId === existingUser.id : false;

          return (
            <div key={role.id} className="space-y-3 rounded-lg border bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-medium dark:text-slate-200">{role.name || role.key}</span>

                {isDefault && (
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">{t.required}</span>
                )}
              </div>

              {existingUser ? (
                /* Role slot already filled — show the existing account instead
                   of a "create new" form, so the same role can never be
                   created twice. */
                <div className="flex flex-col gap-2 rounded-lg border bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-slate-100">{existingUser.name}</span>
                      {existingUser.is_active ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">
                          {c.active}
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                          {c.inactive}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-gray-500 dark:text-slate-400">{existingUser.email}</div>
                  </div>

                  {isDefault ? (
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {t.defaultUserLocked}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => startEditCredentials(existingUser)}
                        className="whitespace-nowrap"
                      >
                        {t.changeCredentials}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => onDeleteUser(existingUser)}
                      disabled={isDeleting}
                      className="self-start sm:self-auto"
                    >
                      {isDeleting ? "..." : c.delete}
                    </Button>
                  )}
                </div>
              ) : null}

              {existingUser && editingUserId === existingUser.id && (
                <div className="space-y-2 rounded-lg border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <input
                    placeholder={t.name}
                    autoComplete="off"
                    value={credName}
                    onChange={(e) => setCredName(e.target.value)}
                    className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />

                  <input
                    type="email"
                    placeholder={t.email}
                    autoComplete="off"
                    value={credEmail}
                    onChange={(e) => setCredEmail(e.target.value)}
                    className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />

                  <div className="relative">
                    <input
                      type={credVisible ? "text" : "password"}
                      placeholder={t.newPasswordPlaceholder}
                      autoComplete="new-password"
                      value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value)}
                      className="w-full rounded border px-3 py-2 pe-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />

                    <button
                      type="button"
                      onClick={() => setCredVisible((v) => !v)}
                      className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                      aria-label={credVisible ? t.hidePassword : t.showPassword}
                      tabIndex={-1}
                    >
                      {credVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={cancelEditCredentials} disabled={savingCreds}>
                      {c.cancel}
                    </Button>
                    <Button onClick={() => saveCredentials(existingUser)} disabled={savingCreds}>
                      {savingCreds ? c.saving : c.save}
                    </Button>
                  </div>
                </div>
              )}

              {!existingUser && (
                /* No account yet for this role — offer the add-user form. */
                <div className="space-y-2">
                  <input
                    placeholder={t.name}
                    autoComplete="off"
                    value={form.name}
                    onChange={(e) => updateForm(role.id, "name", e.target.value)}
                    className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />

                  <input
                    type="email"
                    placeholder={t.email}
                    autoComplete="off"
                    value={form.email}
                    onChange={(e) => updateForm(role.id, "email", e.target.value)}
                    className="w-full rounded border px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />

                  <div className="relative">
                    <input
                      type={visiblePasswords[role.id] ? "text" : "password"}
                      placeholder={t.password}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => updateForm(role.id, "password", e.target.value)}
                      className="w-full rounded border px-3 py-2 pe-10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />

                    <button
                      type="button"
                      onClick={() => toggleVisible(role.id)}
                      className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                      aria-label={visiblePasswords[role.id] ? t.hidePassword : t.showPassword}
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
                    {isSaving ? t.adding : t.addRole(role.name || role.key || "")}
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
