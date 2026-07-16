import React from "react";

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
            <input
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              value={user.password}
              disabled={!user.enabled}
              onChange={(e) => updateUser(index, "password", e.target.value)}
              className="w-full border rounded px-3 py-2"
            />

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
