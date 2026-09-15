import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { logoutSession } from "../../services/profileApi";

/** টপবারের প্রোফাইল ছবি - ক্লিক করলে নাম/রোলসহ একটা কার্ড খোলে, ভেতরে
 * "প্রোফাইল" ও "লগআউট" - দুইটা বাটন। */
export default function ProfileMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const handleLogout = async () => {
    setOpen(false);
    // সার্ভার-সাইড রিভোক শেষ না হতেই রিডাইরেক্ট হলে রিকোয়েস্টটা রেসে হারিয়ে
    // যায় - প্রোফাইলের সেশন লিস্টে পুরনো "active" ডিভাইস রয়ে যায়।
    await logoutSession();
    logout();
  };

  const goToProfile = () => {
    setOpen(false);
    navigate("/settings/profile");
  };

  const avatar = user.photo_url ? (
    <img
      src={user.photo_url}
      alt={user.name}
      className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
    />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
      <User size={16} />
    </span>
  );

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="প্রোফাইল মেনু"
        className="flex items-center justify-center rounded-full transition hover:opacity-80"
      >
        {avatar}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          <div className="flex flex-col items-center gap-2">
            {user.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.name}
                className="h-16 w-16 rounded-full border border-slate-200 object-cover dark:border-slate-700"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <User size={28} />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                {user.name}
              </p>
              {(user.role_label || user.role) && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {user.role_label || user.role}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={goToProfile}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <User size={15} />
              প্রোফাইল
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-600/20 transition hover:bg-rose-500"
            >
              <LogOut size={15} />
              লগআউট
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
