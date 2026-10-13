import type { ReactNode } from "react";
import Breadcrumbs, { type BreadcrumbItem } from "../components/ui/Breadcrumbs";
import NavigationController from "./NavigationController";

type Props = {
  breadcrumbs: BreadcrumbItem[];
  /** Extra content on the right of the breadcrumbs (e.g. a date chip). */
  trailing?: ReactNode;
  className?: string;
};

/**
 * Breadcrumb row of every app shell. The Back / Refresh buttons live in each
 * app's top bar (GlobalBackButton / GlobalRefreshButton), YouTube-style, so
 * they stay put while the page scrolls. This row also mounts
 * NavigationController (history trail + unsaved-changes guard) once per shell.
 */
export default function PageNavBar({ breadcrumbs, trailing, className = "" }: Props) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <NavigationController />
      <div className="min-w-0 flex-1">
        <Breadcrumbs items={breadcrumbs} />
      </div>
      {trailing}
    </div>
  );
}
