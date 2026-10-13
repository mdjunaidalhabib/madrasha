import { Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

import Sidebar from "../components/sidebar/Sidebar";
import Topbar from "../components/topbar/Topbar";
import AppTopBar from "../components/topbar/AppTopBar";
import LockScreen from "../components/lock/LockScreen";
import RouteErrorBoundary from "@madrasha/shared-ui/src/components/ui/RouteErrorBoundary";
import PageNavBar from "@madrasha/shared-ui/src/navigation/PageNavBar";
import { useRefreshStore, useRegisterRefresher } from "@madrasha/shared-ui/src/navigation/refreshStore";
import { Calendar, Clock } from "lucide-react";

import { clearGetCache } from "../services/api";
import { useBrandingStore } from "../store/brandingStore";
import { loadSidebar } from "../services/sidebarApi";
import { getMyPlan } from "../services/planApi";
import { getMyProfile } from "../services/profileApi";
import { useSidebarStore } from "../store/sidebarStore";
import { usePlanStore } from "../store/planStore";
import { useAuthStore } from "../store/authStore";
import { useAdminBreadcrumbs } from "../components/sidebar/useAdminBreadcrumbs";
import { useNowLabels } from "../hooks/useNowLabels";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useLanguageStore } from "@madrasha/shared-ui/src/i18n";

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

  const loadSidebarData = useCallback(async () => {
    try {
      const data = await loadSidebar();
      setItems(data);
    } catch (err) {
      logger.error("Sidebar load failed:", err);
      setItems([]);
    }
  }, [setItems]);

  const loadPlanData = useCallback(async () => {
    try {
      const data = await getMyPlan();
      setPlan(data);
    } catch (err) {
      logger.error("Plan load failed:", err);
    }
  }, [setPlan]);

  // Re-syncs permissions/modules against the backend on every app load, not
  // just at login - so a sidebar module split (see the ফি ব্যবস্থাপনা split)
  // or a role's permissions being edited reaches an already-logged-in user
  // immediately instead of only after they explicitly log out and back in.
  const loadAccessData = useCallback(async () => {
    try {
      const profile = await getMyProfile();
      setAccess(profile.permissions, profile.modules);
      useLanguageStore.getState().setInstitution(profile.institution);
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
  }, [setAccess, updateUser]);

  useEffect(() => {
    void loadSidebarData();
  }, [loadSidebarData]);

  useEffect(() => {
    void loadPlanData();
  }, [loadPlanData]);

  useEffect(() => {
    void loadAccessData();
  }, [loadAccessData]);

  // Global Refresh button: drop the short-lived GET cache FIRST (synchronously,
  // so the remounted page can't read stale data), then re-sync the shell data.
  // Auth token / session are untouched - nothing here logs the user out.
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  useRegisterRefresher(() => {
    clearGetCache();
    return Promise.all([loadSidebarData(), loadPlanData(), loadAccessData(), fetchBranding(true)]);
  });
  const refreshKey = useRefreshStore((s) => s.refreshKey);

  return (
    <div className="flex h-screen supports-[height:100dvh]:h-dvh bg-slate-50 overflow-hidden dark:bg-slate-950">
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
        className={`fixed inset-y-0 start-0 z-50 w-56 max-w-[80%] shadow-xl transition-transform duration-300 ease-out md:hidden ${
          mobileSidebar ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <Sidebar closeSidebar={() => setMobileSidebar(false)} />
      </div>

      {/* Main Layout */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* শুধু ইনস্টল করা অ্যাপে: একদম উপরে Back + Refresh বার (ব্রাউজারে নেই) */}
        <AppTopBar />
        <Topbar openSidebar={() => setMobileSidebar(true)} />

        <main className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-2 text-slate-900 dark:text-slate-100 md:p-4">
          <PageNavBar
            breadcrumbs={breadcrumbs}
            trailing={
              <div className="mb-4 me-2 hidden shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 md:me-4 md:flex">
                <Calendar size={14} className="shrink-0" />
                <span className="truncate">{today}</span>
                <span className="h-3.5 w-px bg-emerald-300 dark:bg-emerald-800" />
                <Clock size={14} className="shrink-0" />
                <span className="tabular-nums">{nowTime}</span>
              </div>
            }
          />
          {/* min-h-0 এখানে জরুরি — নাহলে flex আইটেম হিসেবে এই div ডিফল্টে
              নিজের কন্টেন্টের সমান height claim করবে, ফলে ভেতরের পেজ (যেমন
              ছাত্র তালিকা) main-এর প্রকৃত খালি জায়গা জানতে পারবে না। */}
          <div className="flex min-h-0 flex-1 flex-col">
            <RouteErrorBoundary key={`${location.pathname}:${refreshKey}`}>
              <Outlet />
            </RouteErrorBoundary>
          </div>
        </main>
      </div>

      <LockScreen />
    </div>
  );
}
