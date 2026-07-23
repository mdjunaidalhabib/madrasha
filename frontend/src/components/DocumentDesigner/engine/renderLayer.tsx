import type { CSSProperties } from "react";
import {
  TextElement,
  ImageElement,
  PhotoElement,
  QRCodeElement,
  BarcodeElement,
  LogoElement,
  SignatureElement,
  ShapeElement,
} from "../elements";
import type { DocumentLayer } from "../types";

/**
 * Single source of truth mapping a layer's `type` to the element component
 * responsible for rendering it. Both the Canvas (design/preview surface) and
 * any future non-canvas consumer should go through this map instead of
 * re-implementing the switch — this is what "one shared rendering engine"
 * for Talimat and Report documents means in practice.
 */
const ELEMENT_BY_TYPE: Record<DocumentLayer["type"], (props: any) => JSX.Element> = {
  text: TextElement,
  image: ImageElement,
  photo: PhotoElement,
  qrcode: QRCodeElement,
  barcode: BarcodeElement,
  logo: LogoElement,
  signature: SignatureElement,
  shape: ShapeElement,
};

/** Absolute-position styling derived purely from the layer's geometry. */
export function layerPositionStyle(layer: DocumentLayer): CSSProperties {
  return {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    display: layer.visible === false ? "none" : undefined,
    // `locked` has no visual effect at render time — it only matters to the
    // future interactive editor (disabling drag/resize on this layer).
    ...layer.style,
  };
}

export type RenderLayerOptions = {
  row?: Record<string, any>;
  /** When false, renders the bare element without the absolute-position wrapper (flow/legacy usage). */
  positioned?: boolean;
  className?: string;
};

/**
 * Renders one layer using the shared engine. This is the single function
 * every future document (ID Card, Certificate, Admit Card, Testimonial,
 * Transfer Letter, Fee Receipt, ...) should call instead of hand-rolling
 * per-document-type rendering.
 */
export function renderLayer(layer: DocumentLayer, options: RenderLayerOptions = {}) {
  const { row, positioned = true, className } = options;
  const Element = ELEMENT_BY_TYPE[layer.type];

  if (!Element) {
    return null;
  }

  if (!positioned) {
    return <Element key={layer.id} layer={layer} row={row} className={className} />;
  }

  return (
    <div key={layer.id} style={layerPositionStyle(layer)} data-layer-id={layer.id} data-layer-type={layer.type}>
      <Element layer={layer} row={row} className={className} />
    </div>
  );
}
