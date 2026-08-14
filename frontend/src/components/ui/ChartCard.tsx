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
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} actions={actions} />
      {loading ? (
        <SkeletonChart />
      ) : error ? (
        <p className="flex h-64 items-center justify-center text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : empty ? (
        <p className="flex h-64 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="h-64 w-full">{children}</div>
      )}
    </Card>
  );
}
