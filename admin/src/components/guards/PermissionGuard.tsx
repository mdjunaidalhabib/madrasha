import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
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

  if (!hasPermission(user, permissions, permission)) {
    return <Navigate to={fallbackPath || "/unauthorized"} replace />;
  }

  return <>{children}</>;
}
