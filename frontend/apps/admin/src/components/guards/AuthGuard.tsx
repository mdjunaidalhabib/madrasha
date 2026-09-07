import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function AuthGuard({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const madrasaSlug = useAuthStore((s) => s.madrasaSlug);
  const logout = useAuthStore((s) => s.logout);

  if (!token) return <Navigate to="/login" replace />;

  // A session saved before the login flow required a madrasa code (or one
  // that otherwise lost it) has a token but no madrasaSlug - every request
  // it makes is missing X-Madrasa-Slug and the backend rejects it with a
  // 400 ("Madrasa slug required"), which isn't one of the statuses api.ts's
  // interceptor auto-clears on. Left alone, every widget on the page fires
  // that same broken request and the user just sees a wall of error toasts
  // forever. Catch it here instead, before any child route can fire a
  // single request, and force a clean re-login.
  if (!madrasaSlug) {
    logout();
    return <Navigate to="/login" replace />;
  }

  return children;
}
