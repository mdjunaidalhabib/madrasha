import type { ReactNode } from "react";
// Routed through the shared Document Designer engine (see
// components/DocumentDesigner) so Talimat's admin-editable templates and
// every printed report/document go through one token-rendering entry point.
// Behaviour is unchanged: this re-exports the exact same implementation.
import { renderTemplateText } from "../../../DocumentDesigner/engine";

export type LetterDesignKey = "classic" | "minimal" | "arch" | "custom";

export type LetterDocumentProps = {
  row: Record<string, any>;
  /** Show the bismillah line above the heading. */
  showBismillah?: boolean;
  heading: string;
  headingClassName?: string;
  bodyClassName?: string;
  template: string;
  footer: ReactNode;
  /** Visual shell/frame style. Defaults to "classic" (the original look). */
  design?: LetterDesignKey;
  /** Only used when design === "custom": a full-page background image. */
  backgroundImage?: string | null;
  /** Heading renders only on the record's first physical page. */
  isFirstPage?: boolean;
  /** Footer renders only on the record's last physical page. */
  isLastPage?: boolean;
  /**
   * When the token-rendered body is too tall for one page, the caller
   * (PaginatedReportPreview's measurement pass) pre-splits it with
   * splitTextToFit and hands back just the slice that belongs on THIS
   * physical page - overriding the full `template` render.
   */
  bodyTextOverride?: string;
};

const ArchCorners = () => (
  <>
    <span className="pointer-events-none absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-[#cdb96f]" />
    <span className="pointer-events-none absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-[#cdb96f]" />
    <span className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-[#cdb96f]" />
    <span className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-[#cdb96f]" />
  </>
);

/**
 * Single-document rendering primitive shared by every templated letter-style
 * document (Sanad, Testimonial, Transfer Letter, ...). Encapsulates the card
 * shell, optional bismillah line, heading, token-substituted body text, and
 * a caller-supplied footer, so each concrete document only needs to declare
 * its wording/config differences.
 *
 * `design` controls only the outer frame/chrome (border, background, corner
 * ornament) — heading/body spacing stays under each caller's control via
 * headingClassName/bodyClassName, since that's a per-document-type layout
 * concern, not a visual-theme concern.
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
  design = "classic",
  backgroundImage,
  isFirstPage = true,
  isLastPage = true,
  bodyTextOverride,
}: LetterDocumentProps) => {
  const bodyText = bodyTextOverride ?? renderTemplateText(template, row);

  const content = (
    <>
      {isFirstPage &&
        (showBismillah ? (
          <div className="report-block-heading text-center">
            <p className="text-sm text-slate-500">بسم الله الرحمن الرحيم</p>
            <h3 className={headingClassName}>{heading}</h3>
          </div>
        ) : (
          <h3 className={`report-block-heading ${headingClassName}`}>{heading}</h3>
        ))}

      <p className={`report-block-body ${bodyClassName}`}>{bodyText}</p>

      {isLastPage && <div className="report-block-signature">{footer}</div>}
    </>
  );

  if (design === "minimal") {
    return (
      <div className="print-page-break rounded-lg border border-slate-300 bg-white">
        <div className="h-1.5 w-full bg-[#1f6f5c]" />
        <div className="p-8">{content}</div>
      </div>
    );
  }

  if (design === "arch") {
    return (
      <div className="print-page-break relative overflow-hidden rounded-lg border-4 border-double border-[#1e5c3f] bg-[#f8f5ec] p-9">
        <ArchCorners />
        {content}
      </div>
    );
  }

  if (design === "custom" && backgroundImage) {
    return (
      <div
        className="print-page-break relative rounded-lg border border-slate-300 bg-slate-100 bg-cover bg-center p-6"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="rounded-md bg-white/85 p-6">{content}</div>
      </div>
    );
  }

  // classic (default) — a certificate-style double frame
  return (
    <div className="print-page-break rounded-xl border-2 border-slate-800 bg-white p-2">
      <div className="rounded-lg border border-amber-300 p-7">{content}</div>
    </div>
  );
};

export default LetterDocument;
