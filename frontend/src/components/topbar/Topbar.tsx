import { useAuthStore } from "../../store/authStore";
import LockButton from "../lock/LockButton";
import Button from "../ui/Button";
import { LogOut } from "lucide-react";

type TopbarProps = {
  openSidebar: () => void;
};

export default function Topbar({ openSidebar }: TopbarProps) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="h-14 bg-white shadow flex items-center justify-between px-3 md:px-4">
      {/* Left */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Mobile menu */}
        <button onClick={openSidebar} className="md:hidden text-xl p-1">
          ☰
        </button>

        {/* User greeting */}
        <div className="text-sm text-gray-700 truncate max-w-[160px]">
          {user ? `Hello, ${user.name}` : ""}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 md:gap-2">
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
