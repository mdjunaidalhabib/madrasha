import { Navigate, useParams } from "react-router-dom";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import { getTenantGuardianBase } from "../../utils/tenantSlug";

export default function GuardianAuthGuard({ children }: { children: JSX.Element }) {
  const token = useGuardianAuthStore((s) => s.token);
  const guardian = useGuardianAuthStore((s) => s.guardian);
  const { madrasaSlug = "" } = useParams();
  const base = getTenantGuardianBase(madrasaSlug);

  if (!token) return <Navigate to={`${base}/login`} replace />;
  if (guardian?.mustChangePassword) return <Navigate to={`${base}/change-password`} replace />;

  return children;
}
