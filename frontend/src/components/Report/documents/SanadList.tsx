import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import { useLetterDesign } from "./engine/useLetterDesign";
import LetterDocument from "./engine/LetterDocument";
import { DEFAULT_SANAD_TEMPLATE } from "../../../utils/documentTemplates";

type SanadListProps = {
  rows: Record<string, any>[];
};

const SanadList = ({ rows }: SanadListProps) => {
  const template = useDocumentTemplate("sanad_template", DEFAULT_SANAD_TEMPLATE);
  const { design, backgroundImage } = useLetterDesign();

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <LetterDocument
          key={`sanad-${row.id || index}`}
          row={row}
          showBismillah
          heading="সনদ পত্র"
          template={template}
          design={design}
          backgroundImage={backgroundImage}
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

export default SanadList;
