export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-rose-600">
      {" "}
      *
    </span>
  );
}

export function FieldError({ name, message }: { name: string; message?: string }) {
  return message ? (
    <span
      id={`demo-${name}-error`}
      className="mt-1.5 block text-xs font-normal leading-5 text-rose-600"
    >
      {message}
    </span>
  ) : null;
}

export const invalidFieldClass =
  " !border-rose-500 !bg-rose-50 focus:!border-rose-500 focus:!ring-rose-500/15";
