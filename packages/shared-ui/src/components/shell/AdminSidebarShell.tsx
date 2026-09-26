import { ReactNode } from "react";

type AdminSidebarShellProps = {
  collapsed: boolean;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export default function AdminSidebarShell({
  collapsed,
  header,
  footer,
  children,
}: AdminSidebarShellProps) {
  // h-screen (100vh) রিয়েল মোবাইলে ব্রাউজারের অ্যাড্রেস/টুলবারের নিচের অংশও ধরে,
  // ফলে ফুটার (প্ল্যান/থিম/লগআউট) স্ক্রিনের বাইরে চলে যায় - তাই dvh ব্যবহার।
  return (
    <div
      className={`flex h-screen supports-[height:100dvh]:h-dvh flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {header}
      <nav className="app-sidebar-nav min-h-0 flex-1 space-y-2 overflow-y-auto p-2">{children}</nav>
      {footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">{footer}</div>}
    </div>
  );
}
