import { useText } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "./admission.text";

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
  const t = useText(admissionText);
  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-500 text-sm px-4 py-2.5 rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400">
        <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin dark:border-slate-500" />
        {t.lookingUpNid}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 bg-amber-50 border border-amber-300 text-amber-900 text-sm px-4 py-3 rounded-lg dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400">
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">⚠️</span>
        <div>
          <p className="font-semibold">
            {t.previousFound}
            {studentName ? `: ${studentName}` : ""}
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-400">
            {t.previousSession} <span className="font-medium">{previousAcademicYear || "-"}</span>
            {previousClassName ? (
              <>
                {" "}
                | {t.previousClassLabel} <span className="font-medium">{previousClassName}</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            {t.autoFilledNote}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-amber-700 hover:text-amber-900 text-xs font-medium underline dark:text-amber-400 dark:hover:text-amber-300"
      >
        {t.admitAsNew}
      </button>
    </div>
  );
};

export default PreviousStudentBanner;
