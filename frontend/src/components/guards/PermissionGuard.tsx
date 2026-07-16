import { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

export default function PermissionGuard({
  permission,
  children,
  fallbackPath,
}: {
  permission: string;
  children: ReactNode;
  fallbackPath?: string;
}) {
  const permissions = useAuthStore((s) => s.permissions);
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  if (!permissions.includes(permission)) {
    return <Navigate to={fallbackPath || `${adminBase}/unauthorized`} replace />;
  }

  return <>{children}</>;
}
