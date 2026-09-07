import Canvas from "./Canvas";
import type { DocumentLayout } from "./types";

export interface DocumentPreviewProps {
  layout: DocumentLayout;
  /** The real record (student/teacher/exam row) to render the document for. */
  row: Record<string, any>;
  className?: string;
  zoom?: number;
}

/**
 * Read-only render of a `DocumentLayout` for one record, using the same
 * engine (`Canvas` + `renderLayer`) the designer itself uses. This is the
 * component future print/export flows and list views (ID card batches,
 * certificate batches, etc.) will call once documents are authored through
 * the designer instead of hand-coded per-document components.
 */
const DocumentPreview = ({ layout, row, className, zoom }: DocumentPreviewProps) => {
  return (
    <Canvas
      className={className}
      width={layout.width}
      height={layout.height}
      background={layout.background}
      layers={layout.layers}
      row={row}
      zoom={zoom}
    />
  );
};

export default DocumentPreview;
