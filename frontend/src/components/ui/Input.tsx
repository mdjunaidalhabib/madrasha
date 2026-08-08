import { InputHTMLAttributes } from "react";

export default function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
        className,
      ].join(" ")}
    />
  );
}
