import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type DefaultUser = {
  role: "muhtamim" | "talimat" | "accountant";
  enabled: boolean;
  email: string;
  password: string;
};

type Props = {
  defaultUsers: DefaultUser[];
  setDefaultUsers: React.Dispatch<React.SetStateAction<DefaultUser[]>>;
  errors: Record<string, string>;
};

export default function DefaultUsersSection({ defaultUsers, setDefaultUsers, errors }: Props) {
  const [visibleRoles, setVisibleRoles] = useState<Record<string, boolean>>({});

  const toggleVisible = (role: string) =>
    setVisibleRoles((prev) => ({ ...prev, [role]: !prev[role] }));

  const updateUser = (index: number, field: keyof DefaultUser, value: string | boolean) => {
    const updated = [...defaultUsers];

    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setDefaultUsers(updated);
  };

  const roleLabel = (role: string) => {
    if (role === "muhtamim") return "মুহতামিম";
    if (role === "talimat") return "তালিমাত";
    if (role === "accountant") return "অ্যাকাউন্টেন্ট";
    return role;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Default Users</h3>

      {defaultUsers.map((user, index) => (
        <div key={user.role} className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="font-medium">{roleLabel(user.role)}</span>

            {/* Muhtamim always enabled */}
            {user.role === "muhtamim" ? (
              <span className="text-green-600 text-sm font-medium">Required</span>
            ) : (
              <ToggleSwitch
                checked={user.enabled}
                onChange={() => updateUser(index, "enabled", !user.enabled)}
              />
            )}
          </div>

          <div>
            <input
              type="email"
              placeholder="Email"
              autoComplete="off"
              value={user.email}
              disabled={!user.enabled}
              onChange={(e) => updateUser(index, "email", e.target.value)}
              className="w-full border rounded px-3 py-2"
            />

            {errors[user.role + "_email"] && (
              <p className="text-red-500 text-sm">{errors[user.role + "_email"]}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <input
                type={visibleRoles[user.role] ? "text" : "password"}
                placeholder="Password"
                autoComplete="new-password"
                value={user.password}
                disabled={!user.enabled}
                onChange={(e) => updateUser(index, "password", e.target.value)}
                className="w-full border rounded px-3 py-2 pr-10"
              />

              <button
                type="button"
                onClick={() => toggleVisible(user.role)}
                disabled={!user.enabled}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 disabled:opacity-40"
                aria-label={visibleRoles[user.role] ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {visibleRoles[user.role] ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {errors[user.role + "_password"] && (
              <p className="text-red-500 text-sm">{errors[user.role + "_password"]}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================
Toggle Switch
========================= */

type ToggleSwitchProps = {
  checked: boolean;
  onChange: () => void;
};

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-12 h-6 flex items-center rounded-full p-1 transition ${
        checked ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
          checked ? "translate-x-6" : ""
        }`}
      />
    </button>
  );
}
