import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { SUPER_ADMIN_NAV_ITEMS } from "./SuperAdminSidebar";
import type { BreadcrumbItem } from "../ui/Breadcrumbs";

const HOME: BreadcrumbItem = { label: "হোম", to: "/super-admin/dashboard" };

// Dynamic routes with no sidebar entry of their own.
const FALLBACK_LABELS: { test: RegExp; label: string }[] = [
  { test: /^\/super-admin\/document-templates\/[^/]+\/edit$/, label: "টেমপ্লেট এডিট" },
];

export function useSuperAdminBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();

  return useMemo(() => {
    const path = location.pathname.replace(/\/+$/, "");
    if (path === "/super-admin/dashboard" || path === "/super-admin") {
      return [HOME, { label: "ড্যাশবোর্ড" }];
    }

    const navMatch = SUPER_ADMIN_NAV_ITEMS.find((item) => path === item.to);
    if (navMatch) return [HOME, { label: navMatch.label }];

    for (const rule of FALLBACK_LABELS) {
      if (rule.test.test(path)) return [HOME, { label: rule.label }];
    }

    return [HOME];
  }, [location.pathname]);
}
