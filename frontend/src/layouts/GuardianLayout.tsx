import { useEffect, useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import guardianApi from "../services/guardianApi";
import { useGuardianAuthStore } from "../store/guardianAuthStore";
import { getTenantGuardianBase } from "../utils/tenantSlug";
import { useTenantSlug } from "../utils/useTenantSlug";
import RouteErrorBoundary from "@madrasha/shared-ui/src/components/ui/RouteErrorBoundary";
import Breadcrumbs from "@madrasha/shared-ui/src/components/ui/Breadcrumbs";
import { LanguageSwitcher, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "../features/guardian/guardian.text";

// Labels come from guardianText.nav[to].
const NAV_ITEMS = [
  { to: "dashboard" },
  { to: "profile" },
  { to: "attendance" },
  { to: "leave" },
  { to: "results" },
  { to: "exam-routine" },
  { to: "fees" },
  { to: "notices" },
];

export default function GuardianLayout() {
  const t = useText(guardianText);
  const madrasaSlug = useTenantSlug();
  const base = getTenantGuardianBase(madrasaSlug);
  const nav = useNavigate();
  const location = useLocation();

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

  const breadcrumbs = useMemo(() => {
    const home = { label: t.home, to: `${base}/dashboard` };
    if (location.pathname.startsWith(`${base}/results/`)) {
      return [home, { label: t.nav.results, to: `${base}/results` }, { label: t.marksheet }];
    }
    const current = NAV_ITEMS.find((item) => location.pathname === `${base}/${item.to}`);
    if (!current || current.to === "dashboard") return [home, { label: t.nav.dashboard }];
    return [home, { label: t.nav[current.to] }];
  }, [base, location.pathname, t]);

  const handleLogout = () => {
    logout();
    nav(`${base}/login`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">{t.panelTitle}</p>
            <p className="text-xs text-slate-500">{guardian?.name || guardian?.phone}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {children.length > 1 && (
              <select
                aria-label={t.selectChild}
                value={selectedStudentId ?? ""}
                onChange={(e) => selectStudent(Number(e.target.value))}
                className="rounded border px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.nameBn} {child.className ? `(${child.className})` : ""}
                  </option>
                ))}
              </select>
            )}
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {t.logout}
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={`${base}/${item.to}`}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {t.nav[item.to]}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Breadcrumbs items={breadcrumbs} />
        <RouteErrorBoundary key={location.pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </div>
  );
}
