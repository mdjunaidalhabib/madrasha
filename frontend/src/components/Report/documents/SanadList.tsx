import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import { useLetterDesign } from "./engine/useLetterDesign";
import LetterDocument from "./engine/LetterDocument";
import { DEFAULT_SANAD_TEMPLATE } from "../../../utils/documentTemplates";

type SanadListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  bodyTextOverride?: string;
};

const SanadList = ({
  rows,
  isFirstPage = true,
  isLastPage = true,
  bodyTextOverride,
}: SanadListProps) => {
  const template = useDocumentTemplate("sanad_template", DEFAULT_SANAD_TEMPLATE);
  const { design, backgroundImage } = useLetterDesign();
  const row = rows[0] || {};

  return (
    <LetterDocument
      row={row}
      showBismillah
      heading="সনদ পত্র"
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

export default SanadList;
