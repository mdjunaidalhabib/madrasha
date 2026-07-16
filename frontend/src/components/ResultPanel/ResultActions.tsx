interface Props {
  onSave: () => void;
  onReset?: () => void;
  disabled?: boolean;
}

export default function ResultActions({ onSave, onReset, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-3 mt-4">
      <button
        onClick={onSave}
        disabled={disabled}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition disabled:bg-gray-400"
      >
        💾 Save & Auto Process
      </button>

      {onReset && (
        <button
          onClick={onReset}
          disabled={disabled}
          className="bg-red-500 text-white px-5 py-2 rounded-lg shadow hover:bg-red-600 transition disabled:bg-gray-400"
        >
          ♻ Reset
        </button>
      )}
    </div>
  );
}
