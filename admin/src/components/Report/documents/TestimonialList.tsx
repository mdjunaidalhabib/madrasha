import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import LetterDocument from "./engine/LetterDocument";
import TemplatedLetter from "./engine/TemplatedLetter";
import { LETTER_BODY_CLASS, LETTER_HEADING_CLASS, LetterDateLine, LetterSignatureFooter } from "./engine/letterParts";
import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../report.text";
import { documentDefaultsText } from "./documentDefaults.text";

type TestimonialListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  bodyTextOverride?: string;
  // Explicit design chosen from the Reports screen (ReportFilterBar) -
  // positive = DB template, negative = built-in design. Null/undefined =
  // the plain default (ordinary report-style page).
  templateId?: number | null;
};

const TestimonialList = ({
  rows,
  isFirstPage = true,
  isLastPage = true,
  bodyTextOverride,
  templateId,
}: TestimonialListProps) => {
  const template = useDocumentTemplate("testimonial_template", usePrintText(documentDefaultsText).testimonial);
  const t = usePrintText(reportText);
  const row = rows[0] || {};

  return (
    <TemplatedLetter
      type="TESTIMONIAL"
      templateId={templateId}
      row={row}
      bodyTemplate={template}
      fallback={
        <LetterDocument
          row={row}
          heading={t.title.testimonial}
          headingClassName={LETTER_HEADING_CLASS}
          bodyClassName={LETTER_BODY_CLASS}
          template={template}
          isFirstPage={isFirstPage}
          isLastPage={isLastPage}
          bodyTextOverride={bodyTextOverride}
          bare
          letterhead
          beforeHeading={<LetterDateLine />}
          footer={<LetterSignatureFooter label={t.sign.head} />}
        />
      }
    />
  );
};

export default TestimonialList;
