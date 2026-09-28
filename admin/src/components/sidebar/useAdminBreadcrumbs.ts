import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSidebarStore } from "../../store/sidebarStore";
import { matchSidebarPath } from "./sidebarPaths";
import type { BreadcrumbItem } from "@madrasha/shared-ui/src/components/ui/Breadcrumbs";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { sidebarText, sidebarModuleLabel, sidebarChildLabel } from "./sidebar.text";

type CrumbKey = Exclude<keyof typeof sidebarText.bn, "modules" | "children" | "childFallback">;

// Routes that don't have their own sidebar entry (dynamic profile pages,
// the document designer, dashboard before the sidebar API has responded
// yet, unauthorized) get hand-picked crumb(s) here instead. Most need just
// one extra crumb after "হোম"; the settings/* pages below need two (since
// only "সাধারণ সেটিংস" (-> settings/profile) and "ওয়েবসাইট সেটিংস" have real
// sidebar entries to match against - see sidebar.service.ts) to keep the
// same "হোম > সেটিংস > X" trail they had back when every settings page was
// its own sidebar accordion child.
const FALLBACK_LABELS: { test: RegExp; labels: CrumbKey[] }[] = [
  { test: /^students\/[^/]+\/edit$/, labels: ["studentProfile", "edit"] },
  // /students/:id and /students/:id/:tab (profile tabs)
  { test: /^students\/photos$/, labels: ["student", "photoUpload"] },
  { test: /^students\/names$/, labels: ["student", "namesThreeLang"] },
  { test: /^students\/(?!admissions\/|photos$|names$)[^/]+(\/[^/]+)?$/, labels: ["studentProfile"] },
  { test: /^teacher_staff\/teacher\/[^/]+$/, labels: ["teacherProfile"] },
  { test: /^teacher_staff\/staff\/[^/]+$/, labels: ["staffProfile"] },
  { test: /^talimat\/settings\/documents\/[^/]+\/[^/]+\/edit$/, labels: ["documentDesigner"] },
  { test: /^unauthorized$/, labels: ["unauthorized"] },
  { test: /^settings\/branding$/, labels: ["settings", "branding"] },
  { test: /^settings\/payment-methods$/, labels: ["settings", "paymentMethods"] },
  { test: /^settings\/users$/, labels: ["settings", "staffManagement"] },
  { test: /^settings\/roles$/, labels: ["settings", "rolesPermissions"] },
  { test: /^settings\/plan$/, labels: ["settings", "plan"] },
  { test: /^settings\/trash$/, labels: ["settings", "trash"] },
  { test: /^settings\/about$/, labels: ["settings", "about"] },
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
  const t = useText(sidebarText);

  return useMemo(() => {
    const prefix = "/";
    if (!location.pathname.startsWith(prefix)) return [];

    const subpath = location.pathname.slice(prefix.length).replace(/\/+$/, "");
    const home: BreadcrumbItem = { label: t.home, to: "/dashboard" };
    if (!subpath || subpath === "dashboard") return [home, { label: t.dashboard }];

    const match = matchSidebarPath(items, subpath);
    if (match) {
      return match.child
        ? [
            home,
            { label: sidebarModuleLabel(t, match.module.key, match.module.label) },
            { label: sidebarChildLabel(t, match.module.key, match.child.key, match.child.label) },
          ]
        : [home, { label: sidebarModuleLabel(t, match.module.key, match.module.label) }];
    }

    for (const rule of FALLBACK_LABELS) {
      if (rule.test.test(subpath)) return [home, ...rule.labels.map((key) => ({ label: t[key] }))];
    }

    return [home];
  }, [items, location.pathname, t]);
}
