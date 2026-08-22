import { useAuthStore } from "../../store/authStore";
import LockButton from "../lock/LockButton";
import Button from "../ui/Button";
import ThemeToggle from "../ui/ThemeToggle";
import PlanBadge from "./PlanBadge";
import { LogOut } from "lucide-react";

type TopbarProps = {
  openSidebar: () => void;
};

export default function Topbar({ openSidebar }: TopbarProps) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-4 dark:bg-slate-900 dark:border-slate-800">
      {/* Left */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Mobile menu */}
        <button
          onClick={openSidebar}
          className="md:hidden text-xl p-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ☰
        </button>

        {/* User greeting */}
        <div className="text-sm text-slate-600 truncate max-w-[160px] dark:text-slate-300">
          {user ? (
            <>
              <span className="text-slate-400 dark:text-slate-500">Hello,</span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-100">{user.name}</span>
            </>
          ) : (
            ""
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 md:gap-2">
        <PlanBadge />
        <ThemeToggle />
        <LockButton />

        <Button
          variant="danger"
          onClick={logout}
          className="flex items-center justify-center px-2 md:px-3"
        >
          <LogOut size={18} />

          {/* Desktop text */}
          <span className="hidden md:inline ml-1">Logout</span>
        </Button>
      </div>
    </div>
  );
}
