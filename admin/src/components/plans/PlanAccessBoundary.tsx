import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageLoader from "@madrasha/shared-ui/src/components/ui/PageLoader";
import { LanguageSwitcher, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { useRegisterRefresher } from "@madrasha/shared-ui/src/navigation/refreshStore";
import { getMyPlan, isPlanSuspended } from "../../services/planApi";
import { useAuthStore } from "../../store/authStore";
import { usePlanStore } from "../../store/planStore";
import { planText } from "../../features/admin/settings/settingsPages.text";
import { logoutSession } from "../../services/profileApi";
import PlanBadge from "../topbar/PlanBadge";

const PlanSettingsPage = lazy(() => import("../../features/admin/settings/PlanSettingsPage"));

/** AuthGuard remains outside this boundary. The existing plan route has no extra
 * module/role permission, so this does not grant access to any other route. */
export default function PlanAccessBoundary({ children }: { children: ReactNode }) {
  const plan = usePlanStore((s) => s.plan);
  const block = usePlanStore((s) => s.block);
  const slug = useAuthStore((s) => s.madrasaSlug);
  const userId = useAuthStore((s) => s.user?.id);
  const lang = useLang();
  const t = useText(planText);
  const location = useLocation();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);
  const blocked = block !== null;

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const request = ++sequence.current;
      setRefreshing(true);
      try {
        const result = await getMyPlan({ force: true, signal });
        const current = useAuthStore.getState();
        // A response from a previous login must never populate another tenant's shell.
        if (
          request === sequence.current &&
          !signal?.aborted &&
          current.madrasaSlug === slug &&
          current.user?.id === userId &&
          current.token
        ) {
          usePlanStore.getState().setPlan(result);
          setFailed(false);
        }
      } catch {
        if (request === sequence.current && !signal?.aborted) setFailed(true);
      } finally {
        if (request === sequence.current && !signal?.aborted) setRefreshing(false);
      }
    },
    [slug, userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(controller.signal);
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(controller.signal);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, lang]);
  useEffect(() => {
    if (blocked) void refresh();
  }, [blocked, refresh]);
  useRegisterRefresher(() => refresh());

  const suspended = !!block || (plan !== null && isPlanSuspended(plan));
  useEffect(() => {
    if (suspended && location.pathname !== "/settings/plan")
      navigate("/settings/plan", { replace: true });
  }, [suspended, location.pathname, navigate]);

  if (!plan && !block && !failed) return <PageLoader />;
  if (suspended || (!plan && failed)) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-end gap-3">
          <PlanBadge />
          <LanguageSwitcher />
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refresh()}
            className="rounded-lg border px-3 py-2 text-sm dark:border-slate-600 disabled:opacity-50"
          >
            {refreshing ? t.loading : t.refresh}
          </button>
          <button
            type="button"
            onClick={async () => {
              await logoutSession();
              useAuthStore.getState().logout();
            }}
            className="rounded-lg border px-3 py-2 text-sm dark:border-slate-600"
          >
            {t.logout}
          </button>
        </div>
        {/* DECISION: while suspended render only the authenticated plan view.
          The normal shell, protected pages and their API effects stay unmounted. */}
        <Suspense fallback={<PageLoader />}>
          <PlanSettingsPage suspended onRefresh={() => void refresh()} />
        </Suspense>
      </div>
    );
  }
  return children;
}
