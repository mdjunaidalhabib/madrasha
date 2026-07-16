import { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

const MODULE_ALIASES: Record<string, string[]> = {
  reports: ["reports", "report"],
  report: ["reports", "report"],

  website: ["website", "website_settings", "website-settings"],
  website_settings: ["website", "website_settings", "website-settings"],
  "website-settings": ["website", "website_settings", "website-settings"],
};

type ModuleGuardProps = {
  module: string;
  children: ReactNode;
};

export default function ModuleGuard({ module, children }: ModuleGuardProps) {
  const modules = useAuthStore((s) => s.modules);
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const allowedKeys = MODULE_ALIASES[module] || [module];

  const hasAccess = allowedKeys.some((key) =>
    modules.some((m: any) => {
      if (typeof m === "string") return m === key;

      return m?.key === key || m?.key_name === key;
    }),
  );

  if (!hasAccess) {
    return <Navigate to={`${adminBase}/dashboard`} replace />;
  }

  return <>{children}</>;
}
