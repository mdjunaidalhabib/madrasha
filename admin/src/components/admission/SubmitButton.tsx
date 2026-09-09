interface Props {
  loading?: boolean;
  isReAdmission?: boolean;
}

const SubmitButton: React.FC<Props> = ({ loading = false, isReAdmission = false }) => {
  return (
    <div className="sticky bottom-0 sm:bottom-4 z-10 flex justify-center rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <button
        type="submit"
        disabled={loading}
        className={`flex items-center gap-2 text-white font-semibold px-8 py-3 rounded-lg shadow-md transition
        ${isReAdmission ? "bg-amber-600" : "bg-blue-600"}
        ${loading ? "opacity-70 cursor-not-allowed" : isReAdmission ? "hover:bg-amber-700" : "hover:bg-blue-700"}`}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        )}

        {loading
          ? "Submitting..."
          : isReAdmission
            ? "সেশন আপডেট করুন (পুনঃভর্তি)"
            : "Submit Admission"}
      </button>
    </div>
  );
};

export default SubmitButton;
