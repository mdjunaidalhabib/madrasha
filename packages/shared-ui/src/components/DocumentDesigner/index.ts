/**
 * Foundation of the Professional Document Designer.
 *
 * This module does NOT implement the full designer UI (no drag & drop, no
 * resize handles, no zoom controls, no image upload UI). It provides the
 * reusable pieces future designer features and future document types
 * (ID Card, Certificate, Admit Card, Testimonial, Transfer Letter,
 * Fee Receipt, ...) will be built from:
 *
 *  - `DocumentLayer` / `DocumentLayout` — the reusable layer model
 *  - `Canvas` — background + absolutely-positioned layer stack
 *  - element components (`TextElement`, `ImageElement`, `PhotoElement`,
 *    `QRCodeElement`, `BarcodeElement`, `LogoElement`, `SignatureElement`,
 *    `ShapeElement`) — one shared prop interface (`DocumentElementProps`)
 *  - `renderLayer` — the single engine function that maps a layer to its
 *    element, shared by every consumer (designer, preview, future exports)
 *  - `DocumentDesigner` — reusable shell for a concrete per-document designer
 *  - `DocumentPreview` — read-only render of a layout for one record
 */

export { default as DocumentDesigner } from "./DocumentDesigner";
export type { DocumentDesignerProps } from "./DocumentDesigner";

export { default as DocumentPreview } from "./DocumentPreview";
export type { DocumentPreviewProps } from "./DocumentPreview";

export { default as Canvas } from "./Canvas";
export type { CanvasProps } from "./Canvas";

export * from "./elements";
export * from "./engine";
export * from "./types";
