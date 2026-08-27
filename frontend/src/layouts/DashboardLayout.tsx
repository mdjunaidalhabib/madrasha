import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import Sidebar from "../components/sidebar/Sidebar";
import Topbar from "../components/topbar/Topbar";
import LockScreen from "../components/lock/LockScreen";
import RouteErrorBoundary from "../components/ui/RouteErrorBoundary";
import Breadcrumbs from "../components/ui/Breadcrumbs";

import { loadSidebar } from "../services/sidebarApi";
import { getMyPlan } from "../services/planApi";
import { getMyProfile } from "../services/profileApi";
import { useSidebarStore } from "../store/sidebarStore";
import { usePlanStore } from "../store/planStore";
import { useAuthStore } from "../store/authStore";
import { useAdminBreadcrumbs } from "../components/sidebar/useAdminBreadcrumbs";
import { logger } from "../utils/logger";

export default function DashboardLayout() {
  const setItems = useSidebarStore((s) => s.setItems);
  const setPlan = usePlanStore((s) => s.setPlan);
  const setAccess = useAuthStore((s) => s.setAccess);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const location = useLocation();
  const breadcrumbs = useAdminBreadcrumbs();

  useEffect(() => {
    document.body.style.overflow = mobileSidebar ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebar]);

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

  // Re-syncs permissions/modules against the backend on every app load, not
  // just at login - so a sidebar module split (see the ফি ব্যবস্থাপনা split)
  // or a role's permissions being edited reaches an already-logged-in user
  // immediately instead of only after they explicitly log out and back in.
  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getMyProfile();
        setAccess(profile.permissions, profile.modules);
        updateUser({ role_key: profile.role_key, role_label: profile.role_label });
      } catch (err) {
        logger.error("Access refresh failed:", err);
      }
    };

    load();
  }, [setAccess, updateUser]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 md:hidden ${
          mobileSidebar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileSidebar(false)}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 w-56 max-w-[80%] shadow-xl transition-transform duration-300 ease-out md:hidden ${
          mobileSidebar ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar closeSidebar={() => setMobileSidebar(false)} />
      </div>

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
