import { InputHTMLAttributes } from "react";

export default function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded border px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-blue-300 focus:border-blue-400",
        className,
      ].join(" ")}
    />
  );
}
