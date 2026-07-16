import { Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

export default function AuthGuard({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const { madrasaSlug = "" } = useParams();
  if (!token) return <Navigate to={`${getTenantAdminBase(madrasaSlug)}/login`} replace />;
  return children;
}
