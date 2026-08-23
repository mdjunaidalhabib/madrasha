import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import SuperAdminSidebar from "../components/sidebar/SuperAdminSidebar";
import SuperAdminTopbar from "../components/topbar/SuperAdminTopbar";
import RouteErrorBoundary from "../components/ui/RouteErrorBoundary";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import { useSuperAdminBreadcrumbs } from "../components/sidebar/useSuperAdminBreadcrumbs";

export default function SuperAdminLayout() {
  const token = useAdminAuthStore((s) => s.token);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const location = useLocation();
  const breadcrumbs = useSuperAdminBreadcrumbs();

  if (!token) return <Navigate to="/super-admin/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <SuperAdminSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />
      </div>

      {/* Mobile Sidebar */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-56 shadow-xl">
            <SuperAdminSidebar
              collapsed={false}
              onToggleCollapse={() => {}}
              closeSidebar={() => setMobileSidebar(false)}
            />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileSidebar(false)} />
        </div>
      )}

      {/* Main Layout */}
      <div className="flex min-w-0 flex-1 flex-col">
        <SuperAdminTopbar openSidebar={() => setMobileSidebar(true)} />

        <main className="flex-1 overflow-y-auto p-4 text-slate-900 dark:text-slate-100 md:p-8">
          <Breadcrumbs items={breadcrumbs} />
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
