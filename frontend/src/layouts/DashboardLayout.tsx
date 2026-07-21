import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

import Sidebar from "../components/sidebar/Sidebar";
import Topbar from "../components/topbar/Topbar";
import LockScreen from "../components/lock/LockScreen";

import { loadSidebar } from "../services/sidebarApi";
import { useSidebarStore } from "../store/sidebarStore";
import { logger } from "../utils/logger";

export default function DashboardLayout() {
  const setItems = useSidebarStore((s) => s.setItems);
  const [mobileSidebar, setMobileSidebar] = useState(false);

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

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-56 bg-white shadow-xl">
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

        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>

      <LockScreen />
    </div>
  );
}
