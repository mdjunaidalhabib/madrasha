import type { ReactNode } from "react";
import { renderTemplateText } from "../../../../utils/documentTemplates";

export type LetterDocumentProps = {
  row: Record<string, any>;
  /** Show the bismillah line above the heading. */
  showBismillah?: boolean;
  heading: string;
  headingClassName?: string;
  bodyClassName?: string;
  template: string;
  footer: ReactNode;
  cardClassName?: string;
};

/**
 * Single-document rendering primitive shared by every templated letter-style
 * document (Sanad, Testimonial, Transfer Letter, ...). Encapsulates the card
 * shell, optional bismillah line, heading, token-substituted body text, and
 * a caller-supplied footer, so each concrete document only needs to declare
 * its wording/config differences.
 *
 * Note: the caller (which maps over `rows`) is responsible for putting the
 * React `key` on the <LetterDocument /> element itself, exactly as it did
 * on the outer <div> before this refactor.
 */
const LetterDocument = ({
  row,
  showBismillah = false,
  heading,
  headingClassName = "mt-2 text-2xl font-bold",
  bodyClassName = "mt-8 whitespace-pre-line text-lg leading-9 text-slate-800",
  template,
  footer,
  cardClassName = "print-page-break rounded-xl border-2 border-slate-800 bg-white p-8",
}: LetterDocumentProps) => {
  return (
    <div className={cardClassName}>
      {showBismillah ? (
        <div className="text-center">
          <p className="text-sm text-slate-500">بسم الله الرحمن الرحيم</p>
          <h3 className={headingClassName}>{heading}</h3>
        </div>
      ) : (
        <h3 className={headingClassName}>{heading}</h3>
      )}

      <p className={bodyClassName}>{renderTemplateText(template, row)}</p>

      {footer}
    </div>
  );
};

export default LetterDocument;
