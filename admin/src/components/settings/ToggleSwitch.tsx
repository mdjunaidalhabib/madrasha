export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  title,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
  /** "sm" for tight list rows (e.g. a table/list row with icon buttons
   * beside it) where the default md size crowds the row. */
  size?: "sm" | "md";
}) {
  const track = size === "sm" ? "h-4 w-7 p-0.5" : "h-6 w-11 p-1";
  const thumb = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const thumbOn = size === "sm" ? "translate-x-3" : "translate-x-5";

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      title={title}
      aria-pressed={checked}
      className={`flex shrink-0 items-center rounded-full transition ${track} ${
        checked ? "bg-blue-600" : "bg-gray-300 dark:bg-slate-700"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`rounded-full bg-white shadow transition-transform ${thumb} ${
          checked ? thumbOn : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function PublishToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
      <ToggleSwitch checked={checked} onChange={onChange} />
      প্রকাশ করুন
    </label>
  );
}
