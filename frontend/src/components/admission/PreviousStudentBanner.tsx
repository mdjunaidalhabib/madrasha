interface Props {
  loading: boolean;
  studentName: string;
  previousAcademicYear: string;
  previousClassName: string | null;
  onDismiss: () => void;
}

/**
 * Shown once the admission form finds an existing student with the same
 * NID. Makes it explicit to the office staff that submitting the form will
 * NOT create a duplicate student - it will re-admit this same student into
 * the newly selected academic year (session), carrying their record
 * forward instead of starting a fresh one.
 */
const PreviousStudentBanner: React.FC<Props> = ({
  loading,
  studentName,
  previousAcademicYear,
  previousClassName,
  onDismiss,
}) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-500 text-sm px-4 py-2.5 rounded-lg">
        <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        NID দিয়ে পূর্বের তথ্য খোঁজা হচ্ছে...
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 bg-amber-50 border border-amber-300 text-amber-900 text-sm px-4 py-3 rounded-lg">
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">⚠️</span>
        <div>
          <p className="font-semibold">
            এই NID দিয়ে পূর্বে ভর্তিকৃত একজন শিক্ষার্থী পাওয়া গেছে
            {studentName ? `: ${studentName}` : ""}
          </p>
          <p className="mt-1 text-amber-800">
            পূর্বের সেশন: <span className="font-medium">{previousAcademicYear || "-"}</span>
            {previousClassName ? (
              <>
                {" "}
                | পূর্বের শ্রেণি: <span className="font-medium">{previousClassName}</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-amber-700">
            ফর্মটি স্বয়ংক্রিয়ভাবে পূরণ করা হয়েছে। Submit করলে নতুন শিক্ষার্থী তৈরি হবে না -
            শুধু এই শিক্ষার্থীর সেশন/শ্রেণি আপডেট হয়ে পুনঃভর্তি সম্পন্ন হবে।
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-amber-700 hover:text-amber-900 text-xs font-medium underline"
      >
        নতুন হিসেবে ভর্তি করুন
      </button>
    </div>
  );
};

export default PreviousStudentBanner;
