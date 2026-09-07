import type { ReactNode } from "react";
import Canvas from "./Canvas";
import type { DocumentKind, DocumentLayout } from "./types";

export interface DocumentDesignerProps {
  /** Which document this designer instance is configuring — id-card, certificate, etc. */
  kind: DocumentKind;
  layout: DocumentLayout;
  /** Sample record used to preview tokens/photos while designing. */
  previewRow?: Record<string, any>;
  /** Slot for a future left-hand element/layer panel. Not implemented yet. */
  sidebar?: ReactNode;
  /** Slot for a future toolbar (zoom, add layer, etc). Not implemented yet. */
  toolbar?: ReactNode;
  className?: string;
}

/**
 * `DocumentDesigner` is the reusable shell every concrete designer (ID Card
 * designer, Certificate designer, Admit Card designer, ...) will be built
 * from. Today it only wires a `Canvas` into a consistent layout with slots
 * for a future sidebar/toolbar — it does not yet expose any editing UI
 * (no layer list, no property inspector, no drag/drop). Those are follow-up
 * features that plug into this shell without changing its public API.
 */
const DocumentDesigner = ({ kind, layout, previewRow, sidebar, toolbar, className }: DocumentDesignerProps) => {
  return (
    <div className={className} data-document-designer={kind}>
      {toolbar}
      <div style={{ display: "flex", gap: 16 }}>
        {sidebar}
        <Canvas
          width={layout.width}
          height={layout.height}
          background={layout.background}
          layers={layout.layers}
          row={previewRow}
        />
      </div>
    </div>
  );
};

export default DocumentDesigner;
