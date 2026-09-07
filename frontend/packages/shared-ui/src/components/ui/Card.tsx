import { ReactNode } from "react";

const PADDING_CLASSES = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

type CardProps = {
  children: ReactNode;
  className?: string;
  padding?: keyof typeof PADDING_CLASSES;
};

export default function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${PADDING_CLASSES[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  nowrap = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  nowrap?: boolean;
}) {
  return (
    <div className="mb-4 grid grid-cols-1 items-start gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
      <h3
        className={`min-w-0 text-lg font-bold text-slate-900 dark:text-slate-100 sm:col-start-1 sm:row-start-1 ${nowrap ? "sm:truncate" : ""}`}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          className={`min-w-0 text-sm text-slate-500 dark:text-slate-400 sm:col-span-2 sm:row-start-2 ${nowrap ? "sm:truncate" : ""}`}
        >
          {subtitle}
        </p>
      )}
      {actions && (
        <div className="flex shrink-0 items-center gap-2 sm:col-start-2 sm:row-start-1">{actions}</div>
      )}
    </div>
  );
}
