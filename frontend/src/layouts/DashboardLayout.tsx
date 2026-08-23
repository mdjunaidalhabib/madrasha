import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import Sidebar from "../components/sidebar/Sidebar";
import Topbar from "../components/topbar/Topbar";
import LockScreen from "../components/lock/LockScreen";
import RouteErrorBoundary from "../components/ui/RouteErrorBoundary";
import Breadcrumbs from "../components/ui/Breadcrumbs";

import { loadSidebar } from "../services/sidebarApi";
import { getMyPlan } from "../services/planApi";
import { useSidebarStore } from "../store/sidebarStore";
import { usePlanStore } from "../store/planStore";
import { useAdminBreadcrumbs } from "../components/sidebar/useAdminBreadcrumbs";
import { logger } from "../utils/logger";

export default function DashboardLayout() {
  const setItems = useSidebarStore((s) => s.setItems);
  const setPlan = usePlanStore((s) => s.setPlan);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const location = useLocation();
  const breadcrumbs = useAdminBreadcrumbs();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await loadSidebar();
        setItems(data);
      } catch (err) {
        logger.error("Sidebar load failed:", err);
      }
    };

    load();
  }, [setItems]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyPlan();
        setPlan(data);
      } catch (err) {
        logger.error("Plan load failed:", err);
      }
    };

    load();
  }, [setPlan]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-56 shadow-xl">
            <Sidebar closeSidebar={() => setMobileSidebar(false)} />
          </div>

          <div
            className="flex-1 bg-black/40"
            onClick={() => setMobileSidebar(false)}
          />
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar openSidebar={() => setMobileSidebar(true)} />

        <main className="flex-1 overflow-y-auto p-4 text-slate-900 dark:text-slate-100">
          <Breadcrumbs items={breadcrumbs} />
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>

      <LockScreen />
    </div>
  );
}
