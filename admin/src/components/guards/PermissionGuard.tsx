import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";

export default function PermissionGuard({
  permission,
  children,
  fallbackPath,
}: {
  /** A single permission key, or an array of keys where holding ANY one of
   * them is enough (mirrors the backend's requireAnyPermission) - use this
   * for a page whose different actions are gated on different, narrower
   * permissions (e.g. the result workflow page: marks.submit/marks.verify/
   * result.process/result.verify/result.approve/result.publish/result.lock)
   * so a role holding only one of those narrower keys can still open the
   * page instead of being routed to /unauthorized. */
  permission: string | string[];
  children: ReactNode;
  fallbackPath?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  const permitted = Array.isArray(permission)
    ? permission.some((p) => hasPermission(user, permissions, p))
    : hasPermission(user, permissions, permission);

  if (!permitted) {
    return <Navigate to={fallbackPath || "/unauthorized"} replace />;
  }

  return <>{children}</>;
}
