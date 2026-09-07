import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500",
  secondary:
    "bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700",
  danger: "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-500",
  ghost: "bg-transparent hover:bg-slate-100 text-slate-800 dark:text-slate-200 dark:hover:bg-slate-800",
};

export default function Button({
  className = "",
  variant = "primary",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        styles[variant],
        className,
      ].join(" ")}
    />
  );
}
