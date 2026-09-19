import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import LetterDocument from "./engine/LetterDocument";
import TemplatedLetter from "./engine/TemplatedLetter";
import { DEFAULT_SANAD_TEMPLATE } from "@madrasha/shared-ui/src/utils/documentTemplates";

type SanadListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  bodyTextOverride?: string;
  // Explicit design chosen from the Reports screen (ReportFilterBar) -
  // positive = DB template, negative = built-in design. Null/undefined =
  // the plain default (ordinary report-style page).
  templateId?: number | null;
};

const SanadList = ({ rows, isFirstPage = true, isLastPage = true, bodyTextOverride, templateId }: SanadListProps) => {
  const template = useDocumentTemplate("sanad_template", DEFAULT_SANAD_TEMPLATE);
  const row = rows[0] || {};

  return (
    <TemplatedLetter
      type="CERTIFICATE"
      templateId={templateId}
      row={row}
      bodyTemplate={template}
      fallback={
        <LetterDocument
          row={row}
          showBismillah
          heading="সনদ পত্র"
          template={template}
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
      }
    />
  );
};

export default SanadList;
