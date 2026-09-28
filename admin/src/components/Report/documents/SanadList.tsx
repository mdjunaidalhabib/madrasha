import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import LetterDocument from "./engine/LetterDocument";
import TemplatedLetter from "./engine/TemplatedLetter";
import { LETTER_BODY_CLASS, LETTER_HEADING_CLASS, LetterDateLine, LetterSignatureFooter } from "./engine/letterParts";
import { useIsMadrasa, usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../report.text";
import { documentDefaultsText } from "./documentDefaults.text";

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
  // "সনদ" wording is madrasa-only; other institutions get certificate wording.
  const isMadrasa = useIsMadrasa();
  const defaults = usePrintText(documentDefaultsText);
  const template = useDocumentTemplate("sanad_template", isMadrasa ? defaults.sanad : defaults.certificate);
  const t = usePrintText(reportText);
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
          heading={isMadrasa ? t.title.sanad : t.title.certificate}
          headingClassName={LETTER_HEADING_CLASS}
          bodyClassName={LETTER_BODY_CLASS}
          template={template}
          isFirstPage={isFirstPage}
          isLastPage={isLastPage}
          bodyTextOverride={bodyTextOverride}
          bare
          letterhead
          beforeHeading={<LetterDateLine />}
          footer={<LetterSignatureFooter label={t.sign.headSeal} />}
        />
      }
    />
  );
};

export default SanadList;
