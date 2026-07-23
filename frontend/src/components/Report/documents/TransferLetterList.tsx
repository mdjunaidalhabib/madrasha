import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import LetterDocument from "./engine/LetterDocument";
import { DEFAULT_TRANSFER_LETTER_TEMPLATE } from "../../../utils/documentTemplates";

type TransferLetterListProps = {
  rows: Record<string, any>[];
};

const TransferLetterList = ({ rows }: TransferLetterListProps) => {
  const template = useDocumentTemplate("transfer_letter_template", DEFAULT_TRANSFER_LETTER_TEMPLATE);

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <LetterDocument
          key={`transfer-letter-${row.id || index}`}
          row={row}
          showBismillah
          heading="ছাড়পত্র"
          template={template}
          footer={
            <div className="mt-16 flex justify-between text-sm font-semibold">
              <span>তারিখ: ........................</span>
              <span>প্রধান শিক্ষকের স্বাক্ষর ও সীল</span>
            </div>
          }
        />
      ))}
    </div>
  );
};

export default TransferLetterList;
