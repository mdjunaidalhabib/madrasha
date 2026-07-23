import { renderTemplateText } from "../../../utils/documentTemplates";
import type { DocumentElementProps, TextLayerContent } from "../types";

/**
 * Renders plain text, or — when `content.template` is set — the same
 * {{token}} substitution used by the existing letter-style documents, so
 * future designer-built documents share the exact token semantics already
 * relied on by Sanad/Testimonial/Transfer Letter.
 */
const TextElement = ({ layer, row, className }: DocumentElementProps<TextLayerContent>) => {
  const content = layer.content;

  if (content?.template) {
    return <div className={className}>{renderTemplateText(content.template, row ?? {})}</div>;
  }

  return <div className={className}>{content?.text ?? ""}</div>;
};

export default TextElement;
