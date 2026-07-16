import { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

type RoleGuardProps = {
  roles: string[];
  children: ReactNode;
  fallbackPath?: string;
};

const normalize = (value?: string) =>
  String(value || "")
    .trim()
    .toUpperCase();

export default function RoleGuard({ roles, children, fallbackPath }: RoleGuardProps) {
  const role = useAuthStore((s) => s.user?.role);
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const allowedRoles = roles.map(normalize);
  const hasAccess = allowedRoles.includes(normalize(role));

  if (!hasAccess) {
    return <Navigate to={fallbackPath || `${adminBase}/unauthorized`} replace />;
  }

  return <>{children}</>;
}
