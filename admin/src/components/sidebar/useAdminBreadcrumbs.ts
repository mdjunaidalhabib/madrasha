import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSidebarStore } from "../../store/sidebarStore";
import { matchSidebarPath } from "./sidebarPaths";
import type { BreadcrumbItem } from "@madrasha/shared-ui/src/components/ui/Breadcrumbs";

// Routes that don't have their own sidebar entry (dynamic profile pages,
// the document designer, dashboard before the sidebar API has responded
// yet, unauthorized) get hand-picked crumb(s) here instead. Most need just
// one extra crumb after "হোম"; the settings/* pages below need two (since
// only "সাধারণ সেটিংস" (-> settings/profile) and "ওয়েবসাইট সেটিংস" have real
// sidebar entries to match against - see sidebar.service.ts) to keep the
// same "হোম > সেটিংস > X" trail they had back when every settings page was
// its own sidebar accordion child.
const FALLBACK_LABELS: { test: RegExp; labels: string[] }[] = [
  { test: /^students\/[^/]+$/, labels: ["শিক্ষার্থী প্রোফাইল"] },
  { test: /^teacher_staff\/teacher\/[^/]+$/, labels: ["শিক্ষক প্রোফাইল"] },
  { test: /^teacher_staff\/staff\/[^/]+$/, labels: ["স্টাফ প্রোফাইল"] },
  { test: /^talimat\/settings\/documents\/[^/]+\/[^/]+\/edit$/, labels: ["ডকুমেন্ট ডিজাইনার"] },
  { test: /^unauthorized$/, labels: ["অননুমোদিত প্রবেশ"] },
  { test: /^settings\/branding$/, labels: ["সেটিংস", "প্রতিষ্ঠান ব্র্যান্ডিং"] },
  { test: /^settings\/payment-methods$/, labels: ["সেটিংস", "পেমেন্ট পদ্ধতি"] },
  { test: /^settings\/users$/, labels: ["সেটিংস", "স্টাফ ব্যবস্থাপনা"] },
  { test: /^settings\/roles$/, labels: ["সেটিংস", "রোল ও পারমিশন"] },
  { test: /^settings\/plan$/, labels: ["সেটিংস", "প্ল্যান"] },
  { test: /^settings\/trash$/, labels: ["সেটিংস", "ট্র্যাশ"] },
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

  return useMemo(() => {
    const prefix = "/";
    if (!location.pathname.startsWith(prefix)) return [];

    const subpath = location.pathname.slice(prefix.length).replace(/\/+$/, "");
    const home: BreadcrumbItem = { label: "হোম", to: "/dashboard" };
    if (!subpath || subpath === "dashboard") return [home, { label: "ড্যাশবোর্ড" }];

    const match = matchSidebarPath(items, subpath);
    if (match) {
      return match.child
        ? [home, { label: match.module.label }, { label: match.child.label }]
        : [home, { label: match.module.label }];
    }

    for (const rule of FALLBACK_LABELS) {
      if (rule.test.test(subpath)) return [home, ...rule.labels.map((label) => ({ label }))];
    }

    return [home];
  }, [items, location.pathname]);
}
