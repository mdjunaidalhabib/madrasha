import AdmissionFormDocument from "../Report/documents/AdmissionFormDocument";

type Props = {
  row: Record<string, any>;
  madrasaName?: string;
  className?: string;
};

/**
 * Drops a "প্রিন্ট ভর্তি ফরম" button next to a student record. The document
 * itself is kept in the DOM at all times but hidden on screen (`hidden
 * print:block`) - on print, index.css's `.print-area` rule makes it the only
 * visible content, so window.print() alone is enough to produce a clean page 
 */
const AdmissionFormPrintButton = ({ row, madrasaName, className }: Props) => (
  <>
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ||
        "h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      }
    >
      প্রিন্ট ভর্তি ফরম
    </button>

    <div className="hidden print:block print-area">
      <AdmissionFormDocument row={row} madrasaName={madrasaName} />
    </div>
  </>
);

export default AdmissionFormPrintButton;
