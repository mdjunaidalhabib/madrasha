import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { SUPER_ADMIN_NAV_ITEMS } from "./SuperAdminSidebar";
import type { BreadcrumbItem } from "@madrasha/shared-ui/src/components/ui/Breadcrumbs";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { shellText } from "./shell.text";

// Dynamic routes with no sidebar entry of their own.
const FALLBACK_LABELS: { test: RegExp; label: "templateEdit" }[] = [
  { test: /^\/document-templates\/[^/]+\/edit$/, label: "templateEdit" },
];

export function useSuperAdminBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const t = useText(shellText);

  return useMemo(() => {
    const HOME: BreadcrumbItem = { label: t.home, to: "/dashboard" };
    const path = location.pathname.replace(/\/+$/, "");
    if (path === "/dashboard" || path === "/") {
      return [HOME, { label: t.nav.dashboard }];
    }

    const navMatch = SUPER_ADMIN_NAV_ITEMS.find((item) => path === item.to);
    if (navMatch) return [HOME, { label: t.nav[navMatch.label] }];

    for (const rule of FALLBACK_LABELS) {
      if (rule.test.test(path)) return [HOME, { label: t[rule.label] }];
    }

    return [HOME];
  }, [location.pathname, t]);
}
