import { type ReactNode, useMemo, useState } from "react";
import { Outlet, NavLink, Navigate, useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import Button from "../components/ui/Button";

import {
  LayoutDashboard,
  School,
  Trash2,
  CreditCard,
  Globe2,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
};

export default function SuperAdminLayout() {
  const token = useAdminAuthStore((s) => s.token);
  const admin = useAdminAuthStore((s) => s.admin);
  const logout = useAdminAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = useMemo(
    () => [
      {
        to: "/super-admin/dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard size={18} />,
        end: true,
      },
      {
        to: "/super-admin/madrasas",
        label: "Madrasas",
        icon: <School size={18} />,
        end: true,
      },
      {
        to: "/super-admin/madrasas/trash",
        label: "Trash",
        icon: <Trash2 size={18} />,
      },
      {
        to: "/super-admin/plans",
        label: "Plans",
        icon: <CreditCard size={18} />,
      },
      {
        to: "/super-admin/websites",
        label: "Websites",
        icon: <Globe2 size={18} />,
      },
    ],
    [],
  );

  if (!token) return <Navigate to="/super-admin/login" replace />;

  const handleLogout = () => {
    logout();
    navigate("/super-admin/login", { replace: true });
  };

  const linkBase =
    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200";

  const renderNav = (onNavigate?: () => void) => (
    <nav className="space-y-2">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              linkBase,
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-700 hover:bg-blue-50 hover:text-blue-700",
              "overflow-hidden",
            ].join(" ")
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={[
                  "absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r transition-all duration-200",
                  isActive ? "bg-white" : "bg-transparent group-hover:bg-blue-200",
                ].join(" ")}
              />

              <span
                className={[
                  "absolute inset-0 opacity-0 transition-opacity duration-200",
                  isActive ? "opacity-10" : "group-hover:opacity-5",
                ].join(" ")}
              />

              <span className="relative z-10 flex items-center gap-3">
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="h-screen bg-gray-100">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="font-bold text-blue-600">Super Admin Panel</div>

        <div className="w-9" />
      </header>

      <div className="flex h-[calc(100vh-56px)] md:h-screen">
        <aside
          className={[
            "hidden flex-col justify-between border-r bg-white p-4 shadow-sm transition-all duration-200 md:flex",
            collapsed ? "w-20" : "w-64",
          ].join(" ")}
        >
          <div>
            <div className="mb-6 flex items-center justify-between">
              {!collapsed ? (
                <h2 className="text-xl font-bold text-blue-600">Super Admin Panel</h2>
              ) : (
                <div className="mx-auto text-lg font-bold text-blue-600">SA</div>
              )}

              <button
                onClick={() => setCollapsed((value) => !value)}
                className="rounded-lg p-2 hover:bg-gray-100"
                aria-label="Toggle sidebar"
              >
                {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
              </button>
            </div>

            {renderNav()}
          </div>

          <div className="space-y-3 border-t pt-4">
            {!collapsed && (
              <div className="text-xs text-gray-500">
                Logged in as
                <div className="mt-1 font-semibold text-gray-700">
                  {admin?.name ?? "Super Admin"}
                </div>
              </div>
            )}

            <Button variant="danger" onClick={handleLogout}>
              {collapsed ? "⎋" : "Logout"}
            </Button>
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />

            <div className="absolute left-0 top-0 flex h-full w-72 flex-col justify-between bg-white p-4 shadow-xl">
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-blue-600">Super Admin Panel</h2>

                  <button
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg p-2 hover:bg-gray-100"
                    aria-label="Close menu"
                  >
                    <X size={20} />
                  </button>
                </div>

                {renderNav(() => setMobileOpen(false))}
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="text-xs text-gray-500">
                  Logged in as
                  <div className="mt-1 font-semibold text-gray-700">
                    {admin?.name ?? "Super Admin"}
                  </div>
                </div>

                <Button
                  variant="danger"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
