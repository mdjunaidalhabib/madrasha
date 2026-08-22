import { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { hasPermission } from "../../utils/permissions";

export default function PermissionGuard({
  permission,
  children,
  fallbackPath,
}: {
  permission: string;
  children: ReactNode;
  fallbackPath?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  if (!hasPermission(user, permissions, permission)) {
    return <Navigate to={fallbackPath || `${adminBase}/unauthorized`} replace />;
  }

  return <>{children}</>;
}
