import type { CSSProperties } from "react";

/**
 * Foundation types for the Professional Document Designer.
 *
 * This module intentionally only defines *data shapes*, not editor behaviour.
 * Drag & drop, resize handles, and zoom controls are future features that
 * will be built on top of this model — nothing here should assume they exist.
 */

/** Every kind of element the designer can eventually place on a canvas. */
export type LayerType =
  | "text"
  | "image"
  | "photo"
  | "qrcode"
  | "barcode"
  | "logo"
  | "signature"
  | "shape";

/** The set of document types the designer is expected to eventually support. */
export type DocumentKind =
  | "id-card"
  | "certificate"
  | "admit-card"
  | "testimonial"
  | "transfer-letter"
  | "fee-receipt"
  | (string & {});

/**
 * A single positioned element on the canvas.
 *
 * This is the reusable "Layer Model" referenced across the designer, the
 * canvas, and every concrete element component. Nothing outside this file
 * should redefine an equivalent shape — extend this one instead.
 */
export interface DocumentLayer<TContent = unknown> {
  id: string;
  type: LayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in degrees, clockwise. */
  rotation: number;
  visible: boolean;
  locked: boolean;
  style?: CSSProperties;
  content?: TContent;
}

/** Convenience constructor so callers never hand-assemble a partial layer. */
export function createLayer<TContent = unknown>(
  partial: Partial<DocumentLayer<TContent>> & Pick<DocumentLayer<TContent>, "id" | "type">
): DocumentLayer<TContent> {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    rotation: 0,
    visible: true,
    locked: false,
    ...partial,
  };
}

/** Common data available to every element renderer. */
export interface DocumentElementProps<TContent = unknown> {
  layer: DocumentLayer<TContent>;
  /** The record (student/teacher/exam row, etc.) driving token substitution. */
  row?: Record<string, any>;
  /** Extra className merged onto the element's root node. */
  className?: string;
}

/** Content shape for `TextElement` — either a literal string or a {{token}} template. */
export interface TextLayerContent {
  text?: string;
  template?: string;
}

/** Content shape for image-like elements (image, photo, logo, signature). */
export interface ImageLayerContent {
  src?: string;
  /** Row field name to resolve the image src from, e.g. "image" or "signature_url". */
  field?: string;
  alt?: string;
  fit?: "cover" | "contain" | "fill";
}

/** Content shape for `QRCodeElement` / `BarcodeElement`. */
export interface CodeLayerContent {
  value?: string;
  field?: string;
}

/** Content shape for `ShapeElement`. */
export interface ShapeLayerContent {
  shape?: "rectangle" | "circle" | "line";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/** Background configuration accepted by the `Canvas`. */
export interface CanvasBackground {
  /** Image URL/base64. Upload UI is out of scope for this foundation. */
  image?: string;
  color?: string;
  fit?: "cover" | "contain" | "fill";
}

/** A single document's worth of layers, ready to hand to `Canvas`/`DocumentPreview`. */
export interface DocumentLayout {
  id: string;
  kind: DocumentKind;
  /** Design-time canvas size in px; actual rendering scales to the container. */
  width: number;
  height: number;
  background?: CanvasBackground;
  layers: DocumentLayer[];
}
