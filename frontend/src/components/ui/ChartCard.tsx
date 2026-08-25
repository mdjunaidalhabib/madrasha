import { ReactNode } from "react";
import Card, { CardHeader } from "./Card";
import { SkeletonChart } from "./Skeleton";

type ChartCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
  className?: string;
  /** Tailwind height class for the chart area (and its loading/error/empty
   * placeholders). Defaults to the original fixed "h-64" used everywhere
   * else - pass a smaller class (e.g. "h-48") for a more compact card. */
  height?: string;
};

export default function ChartCard({
  title,
  subtitle,
  actions,
  loading,
  error,
  empty,
  emptyMessage = "কোনো তথ্য পাওয়া যায়নি",
  children,
  className = "",
  height = "h-64",
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} actions={actions} />
      {loading ? (
        <SkeletonChart className={height} />
      ) : error ? (
        <p className={`flex ${height} items-center justify-center text-sm text-rose-600 dark:text-rose-400`}>
          {error}
        </p>
      ) : empty ? (
        <p className={`flex ${height} items-center justify-center text-sm text-slate-400 dark:text-slate-500`}>
          {emptyMessage}
        </p>
      ) : (
        <div className={`${height} w-full`}>{children}</div>
      )}
    </Card>
  );
}
