import React from "react";

const DIGITS_ONLY = /[^0-9]/g;

export function filterToDigits(value: string): string {
  return value.replace(DIGITS_ONLY, "");
}

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ onChange, inputMode, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const filtered = filterToDigits(e.target.value);
      if (filtered !== e.target.value) {
        e.target.value = filtered;
      }
      onChange?.(e);
    };

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode ?? "numeric"}
        onChange={handleChange}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";

export default NumericInput;
