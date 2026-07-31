import { useEffect } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import guardianApi from "../services/guardianApi";
import { useGuardianAuthStore } from "../store/guardianAuthStore";
import { getTenantGuardianBase } from "../utils/tenantSlug";

const NAV_ITEMS = [
  { to: "dashboard", label: "ড্যাশবোর্ড" },
  { to: "attendance", label: "হাজিরা" },
  { to: "results", label: "ফলাফল" },
  { to: "fees", label: "ফি" },
  { to: "notices", label: "নোটিশ" },
];

export default function GuardianLayout() {
  const { madrasaSlug = "" } = useParams();
  const base = getTenantGuardianBase(madrasaSlug);
  const nav = useNavigate();

  const guardian = useGuardianAuthStore((s) => s.guardian);
  const children = useGuardianAuthStore((s) => s.children);
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const setChildren = useGuardianAuthStore((s) => s.setChildren);
  const selectStudent = useGuardianAuthStore((s) => s.selectStudent);
  const logout = useGuardianAuthStore((s) => s.logout);

  useEffect(() => {
    (async () => {
      const res = await guardianApi.get("/guardian/me/children");
      setChildren(res.data?.data || []);
    })();
  }, [setChildren]);

  const handleLogout = () => {
    logout();
    nav(`${base}/login`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">অভিভাবক প্যানেল</p>
            <p className="text-xs text-slate-500">{guardian?.name || guardian?.phone}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {children.length > 1 && (
              <select
                value={selectedStudentId ?? ""}
                onChange={(e) => selectStudent(Number(e.target.value))}
                className="rounded border px-2 py-1.5 text-sm"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.nameBn} {child.className ? `(${child.className})` : ""}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleLogout}
              className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white"
            >
              লগআউট
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={`${base}/${item.to}`}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                  isActive ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
