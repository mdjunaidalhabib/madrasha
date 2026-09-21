import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import LetterDocument from "./engine/LetterDocument";
import TemplatedLetter from "./engine/TemplatedLetter";
import { LETTER_BODY_CLASS, LETTER_HEADING_CLASS, LetterDateLine, LetterSignatureFooter } from "./engine/letterParts";
import { DEFAULT_TRANSFER_LETTER_TEMPLATE } from "@madrasha/shared-ui/src/utils/documentTemplates";

type TransferLetterListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  bodyTextOverride?: string;
  // Explicit design chosen from the Reports screen (ReportFilterBar) -
  // positive = DB template, negative = built-in design. Null/undefined =
  // the plain default (ordinary report-style page).
  templateId?: number | null;
};

const TransferLetterList = ({
  rows,
  isFirstPage = true,
  isLastPage = true,
  bodyTextOverride,
  templateId,
}: TransferLetterListProps) => {
  const template = useDocumentTemplate("transfer_letter_template", DEFAULT_TRANSFER_LETTER_TEMPLATE);
  const row = rows[0] || {};

  return (
    <TemplatedLetter
      type="CLEARANCE_CERTIFICATE"
      templateId={templateId}
      row={row}
      bodyTemplate={template}
      fallback={
        <LetterDocument
          row={row}
          heading="ছাড়পত্র"
          headingClassName={LETTER_HEADING_CLASS}
          bodyClassName={LETTER_BODY_CLASS}
          template={template}
          isFirstPage={isFirstPage}
          isLastPage={isLastPage}
          bodyTextOverride={bodyTextOverride}
          bare
          letterhead
          beforeHeading={<LetterDateLine />}
          footer={<LetterSignatureFooter label="প্রধান শিক্ষকের স্বাক্ষর ও সীল" />}
        />
      }
    />
  );
};

export default TransferLetterList;
