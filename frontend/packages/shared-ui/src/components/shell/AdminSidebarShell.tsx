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
  return (
    <div
      className={`flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {header}
      <nav className="app-sidebar-nav flex-1 space-y-2 overflow-y-auto p-2">{children}</nav>
      {footer}
    </div>
  );
}
