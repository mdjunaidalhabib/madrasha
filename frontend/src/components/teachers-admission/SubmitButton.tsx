import React from "react";

interface Props {
  loading?: boolean;
  text?: string;
  loadingText?: string;
  fullWidth?: boolean;
}

const SubmitButton: React.FC<Props> = ({
  loading = false,
  text = "Submit",
  loadingText = "Submitting...",
  fullWidth = false,
}) => {
  return (
    <div className={`flex ${fullWidth ? "w-full" : "justify-center"}`}>
      <button
        type="submit"
        disabled={loading}
        className={`
          ${fullWidth ? "w-full" : ""}
          bg-blue-600 hover:bg-blue-700
          text-white font-semibold
          px-8 py-3 rounded-lg
          shadow-md
          transition duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
        `}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        )}

        {loading ? loadingText : text}
      </button>
    </div>
  );
};

export default SubmitButton;
