import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import { useLetterDesign } from "./engine/useLetterDesign";
import LetterDocument from "./engine/LetterDocument";
import { DEFAULT_TRANSFER_LETTER_TEMPLATE } from "../../../utils/documentTemplates";

type TransferLetterListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  bodyTextOverride?: string;
};

const TransferLetterList = ({
  rows,
  isFirstPage = true,
  isLastPage = true,
  bodyTextOverride,
}: TransferLetterListProps) => {
  const template = useDocumentTemplate("transfer_letter_template", DEFAULT_TRANSFER_LETTER_TEMPLATE);
  const { design, backgroundImage } = useLetterDesign();
  const row = rows[0] || {};

  return (
    <LetterDocument
      row={row}
      showBismillah
      heading="ছাড়পত্র"
      template={template}
      design={design}
      backgroundImage={backgroundImage}
      isFirstPage={isFirstPage}
      isLastPage={isLastPage}
      bodyTextOverride={bodyTextOverride}
      footer={
        <div className="mt-16 flex justify-between text-sm font-semibold">
          <span>তারিখ: ........................</span>
          <span>প্রধান শিক্ষকের স্বাক্ষর ও সীল</span>
        </div>
      }
    />
  );
};

export default TransferLetterList;
