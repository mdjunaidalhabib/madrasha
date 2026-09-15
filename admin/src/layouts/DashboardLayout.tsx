import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import Sidebar from "../components/sidebar/Sidebar";
import Topbar from "../components/topbar/Topbar";
import LockScreen from "../components/lock/LockScreen";
import RouteErrorBoundary from "@madrasha/shared-ui/src/components/ui/RouteErrorBoundary";
import Breadcrumbs from "@madrasha/shared-ui/src/components/ui/Breadcrumbs";
import { Calendar, Clock } from "lucide-react";

import { loadSidebar } from "../services/sidebarApi";
import { getMyPlan } from "../services/planApi";
import { getMyProfile } from "../services/profileApi";
import { useSidebarStore } from "../store/sidebarStore";
import { usePlanStore } from "../store/planStore";
import { useAuthStore } from "../store/authStore";
import { useAdminBreadcrumbs } from "../components/sidebar/useAdminBreadcrumbs";
import { useNowLabels } from "../hooks/useNowLabels";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

export default function DashboardLayout() {
  const setItems = useSidebarStore((s) => s.setItems);
  const setPlan = usePlanStore((s) => s.setPlan);
  const setAccess = useAuthStore((s) => s.setAccess);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const location = useLocation();
  const breadcrumbs = useAdminBreadcrumbs();
  const { date: today, time: nowTime } = useNowLabels();

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
        setItems([]);
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
        updateUser({
          name: profile.name,
          mobile: profile.mobile,
          photo_url: profile.photo_url,
          role_key: profile.role_key,
          role_label: profile.role_label,
        });
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

        <main className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-2 text-slate-900 dark:text-slate-100 md:p-4">
          <div className="flex items-center justify-between gap-2">
            <Breadcrumbs items={breadcrumbs} />
            <div className="mb-4 mr-2 hidden shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 md:mr-4 md:flex">
              <Calendar size={14} className="shrink-0" />
              <span className="truncate">{today}</span>
              <span className="h-3.5 w-px bg-emerald-300 dark:bg-emerald-800" />
              <Clock size={14} className="shrink-0" />
              <span className="tabular-nums">{nowTime}</span>
            </div>
          </div>
          {/* min-h-0 এখানে জরুরি — নাহলে flex আইটেম হিসেবে এই div ডিফল্টে
              নিজের কন্টেন্টের সমান height claim করবে, ফলে ভেতরের পেজ (যেমন
              ছাত্র তালিকা) main-এর প্রকৃত খালি জায়গা জানতে পারবে না। */}
          <div className="flex min-h-0 flex-1 flex-col">
            <RouteErrorBoundary key={location.pathname}>
              <Outlet />
            </RouteErrorBoundary>
          </div>
        </main>
      </div>

      <LockScreen />
    </div>
  );
}
