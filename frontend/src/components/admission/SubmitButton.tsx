interface Props {
  loading?: boolean;
}

const SubmitButton: React.FC<Props> = ({ loading = false }) => {
  return (
    <div className="flex justify-center">
      <button
        type="submit"
        disabled={loading}
        className={`flex items-center gap-2 bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg shadow-md transition
        ${loading ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700"}`}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        )}

        {loading ? "Submitting..." : "Submit Admission"}
      </button>
    </div>
  );
};

export default SubmitButton;
