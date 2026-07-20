import { useEffect } from "react";
import { useDocumentTemplateStore } from "../../../store/documentTemplateStore";
import { DEFAULT_TRANSFER_LETTER_TEMPLATE, renderTemplateText } from "../../../utils/documentTemplates";

type TransferLetterListProps = {
  rows: Record<string, any>[];
};

const TransferLetterList = ({ rows }: TransferLetterListProps) => {
  const templates = useDocumentTemplateStore((s) => s.templates);
  const fetchTemplates = useDocumentTemplateStore((s) => s.fetchTemplates);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const template = templates?.transfer_letter_template || DEFAULT_TRANSFER_LETTER_TEMPLATE;

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div
          key={`transfer-letter-${row.id || index}`}
          className="print-page-break rounded-xl border-2 border-slate-800 bg-white p-8"
        >
          <div className="text-center">
            <p className="text-sm text-slate-500">بسم الله الرحمن الرحيم</p>
            <h3 className="mt-2 text-2xl font-bold">ছাড়পত্র</h3>
          </div>

          <p className="mt-8 whitespace-pre-line text-lg leading-9 text-slate-800">
            {renderTemplateText(template, row)}
          </p>

          <div className="mt-16 flex justify-between text-sm font-semibold">
            <span>তারিখ: ........................</span>
            <span>প্রধান শিক্ষকের স্বাক্ষর ও সীল</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransferLetterList;
