import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

// Renders "হোম > মডিউল > পেজ" above the routed page content. Every crumb
// except the last (the current page) links back to that step; the last one
// is plain text since linking to the page you're already on is a no-op.
export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && (
              <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-slate-600" />
            )}
            {isLast || !item.to ? (
              <span
                className={
                  isLast
                    ? "truncate font-semibold text-slate-700 dark:text-slate-200"
                    : "truncate text-slate-400 dark:text-slate-500"
                }
                aria-current={isLast ? "page" : undefined}
              >
                {index === 0 && <Home size={13} className="mr-1 inline -mt-0.5" />}
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                className="flex shrink-0 items-center gap-1 truncate text-slate-400 transition hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
              >
                {index === 0 && <Home size={13} />}
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
