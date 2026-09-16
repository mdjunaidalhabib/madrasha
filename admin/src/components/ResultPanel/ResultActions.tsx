interface Props {
  onSave: () => void;
  onReset?: () => void;
  disabled?: boolean;
  /** Extra disable specifically for the Save & Process button, with the
   * reason shown as its hover tooltip - e.g. incomplete entry, or nothing
   * new since the last successful save+process. `undefined`/empty means
   * not disabled for this reason. Doesn't affect Reset, which stays
   * available independent of this. */
  saveDisabledReason?: string;
}

export default function ResultActions({ onSave, onReset, disabled, saveDisabledReason }: Props) {
  const saveDisabled = disabled || Boolean(saveDisabledReason);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onSave}
        disabled={saveDisabled}
        title={!disabled && saveDisabledReason ? saveDisabledReason : undefined}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
      >
        💾 সংরক্ষণ ও প্রসেস করুন
      </button>

      {/* Outline/ghost styling (not a solid red fill) so this destructive,
          rarely-used action doesn't visually compete with the primary Save
          button it sits right next to. */}
      {onReset && (
        <button
          onClick={onReset}
          disabled={disabled}
          className="border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          ♻ রিসেট
        </button>
      )}
    </div>
  );
}
