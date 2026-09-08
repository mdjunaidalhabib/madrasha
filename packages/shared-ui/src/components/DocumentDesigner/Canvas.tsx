import type { CSSProperties, ReactNode } from "react";
import { renderLayer } from "./engine/renderLayer";
import type { CanvasBackground, DocumentLayer } from "./types";

export interface CanvasProps {
  /** Design-time canvas size in px. */
  width: number;
  height: number;
  background?: CanvasBackground;
  layers: DocumentLayer[];
  /** Record used to resolve tokens/photo fields for every layer. */
  row?: Record<string, any>;
  /**
   * Current zoom factor. Only affects presentation (CSS transform); the
   * layer coordinates themselves stay in design-time px. This is the hook
   * future zoom controls will drive — no zoom UI is implemented here.
   */
  zoom?: number;
  className?: string;
  /** Extra nodes rendered above the layer stack (e.g. future selection handles/overlays). */
  overlay?: ReactNode;
}

const backgroundStyle = (background?: CanvasBackground): CSSProperties => {
  if (!background) return {};
  return {
    backgroundColor: background.color,
    backgroundImage: background.image ? `url(${background.image})` : undefined,
    backgroundSize: background.fit === "contain" ? "contain" : background.fit === "fill" ? "100% 100%" : "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
};

/**
 * The document canvas: a fixed-size, position:relative surface that stacks a
 * background layer under an ordered list of absolutely-positioned element
 * layers.
 *
 * This is architecture only. It deliberately does NOT implement:
 *  - drag & drop (layers are not draggable yet)
 *  - resize handles
 *  - interactive zoom (the `zoom` prop exists so a future toolbar has
 *    somewhere to plug in, but no UI for it lives here)
 *
 * Those features can be added later by wrapping/enhancing this component
 * without changing how `DocumentDesigner`/`DocumentPreview` consume it.
 */
const Canvas = ({ width, height, background, layers, row, zoom = 1, className, overlay }: CanvasProps) => {
  return (
    <div
      className={className}
      data-document-canvas=""
      style={{
        position: "relative",
        width,
        height,
        transform: zoom !== 1 ? `scale(${zoom})` : undefined,
        transformOrigin: "top left",
        overflow: "hidden",
        ...backgroundStyle(background),
      }}
    >
      {layers.map((layer) => renderLayer(layer, { row }))}
      {overlay}
    </div>
  );
};

export default Canvas;
