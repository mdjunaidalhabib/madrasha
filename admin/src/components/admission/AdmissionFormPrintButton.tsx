import { useText } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "./admission.text";
import AdmissionFormDocument from "../Report/documents/AdmissionFormDocument";
import type { ReactNode } from "react";

type Props = {
  row: Record<string, any>;
  madrasaName?: string;
  className?: string;
  icon?: ReactNode;
  disabled?: boolean;
  labelClassName?: string;
  label?: string;
};

/**
 * Drops a "প্রিন্ট ভর্তি ফরম" button next to a student record. The document
 * itself is kept in the DOM at all times but hidden on screen (`hidden
 * print:block`) - on print, index.css's `.print-area` rule makes it the only
 * visible content, so window.print() alone is enough to produce a clean page 
 */
const AdmissionFormPrintButton = ({ row, madrasaName, className, icon, disabled, labelClassName, label }: Props) => {
  const t = useText(admissionText);
  return (
  <>
    <button
      type="button"
      disabled={disabled}
      aria-label={t.printAdmissionForm}
      title={t.printAdmissionForm}
      onClick={() => window.print()}
      className={
        className ||
        "h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      }
    >
      {icon}<span className={labelClassName}>{label || t.printAdmissionForm}</span>
    </button>

    <div className="hidden print:block print-area">
      <AdmissionFormDocument row={row} madrasaName={madrasaName} />
    </div>
  </>
  );
};

export default AdmissionFormPrintButton;
