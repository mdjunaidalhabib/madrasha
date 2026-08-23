import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useSidebarStore } from "../../store/sidebarStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { matchSidebarPath } from "./sidebarPaths";
import type { BreadcrumbItem } from "../ui/Breadcrumbs";

// Routes that don't have their own sidebar entry (dynamic profile pages,
// the document designer, dashboard before the sidebar API has responded
// yet, unauthorized) get a hand-picked label here instead.
const FALLBACK_LABELS: { test: RegExp; label: string }[] = [
  { test: /^students\/[^/]+$/, label: "শিক্ষার্থী প্রোফাইল" },
  { test: /^ihtemam\/[^/]+$/, label: "শিক্ষক প্রোফাইল" },
  { test: /^talimat\/settings\/documents\/[^/]+\/[^/]+\/edit$/, label: "ডকুমেন্ট ডিজাইনার" },
  { test: /^unauthorized$/, label: "অননুমোদিত প্রবেশ" },
];

/**
 * Derives "হোম > মডিউল > পেজ" for the current admin-panel route from the
 * same sidebar tree data Sidebar.tsx renders links from, so every page
 * covered by the sidebar gets a correct breadcrumb for free - no per-page
 * wiring needed. Routes with no sidebar entry fall back to FALLBACK_LABELS.
 */
export function useAdminBreadcrumbs(): BreadcrumbItem[] {
  const items = useSidebarStore((s) => s.items);
  const location = useLocation();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  return useMemo(() => {
    const prefix = `${adminBase}/`;
    if (!location.pathname.startsWith(prefix)) return [];

    const subpath = location.pathname.slice(prefix.length).replace(/\/+$/, "");
    const home: BreadcrumbItem = { label: "হোম", to: `${adminBase}/dashboard` };
    if (!subpath || subpath === "dashboard") return [home, { label: "ড্যাশবোর্ড" }];

    const match = matchSidebarPath(items, subpath);
    if (match) {
      return match.child
        ? [home, { label: match.module.label }, { label: match.child.label }]
        : [home, { label: match.module.label }];
    }

    for (const rule of FALLBACK_LABELS) {
      if (rule.test.test(subpath)) return [home, { label: rule.label }];
    }

    return [home];
  }, [items, location.pathname, adminBase]);
}
