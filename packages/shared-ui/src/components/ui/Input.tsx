import { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Red border + red focus ring instead of the default styling - e.g. a
   * required field left empty at submit time. */
  invalid?: boolean;
};

export default function Input({ className = "", invalid = false, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-lg border px-3 py-2 text-sm outline-none",
        invalid
          ? "border-red-500 focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
          : "border-slate-300 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:border-slate-700",
        "dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500",
        className,
      ].join(" ")}
    />
  );
}
