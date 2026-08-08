import { QRCodeSVG } from "qrcode.react";
import type { DocumentElementProps, CodeLayerContent } from "../types";

/**
 * Renders a real QR code (SVG, so it prints correctly through the existing
 * window.print() pipeline - no canvas rasterization needed). The value
 * comes from either a literal `content.value` or a bound `row[content.field]`
 * (e.g. "registration_no"), same resolution rule every other layer uses.
 */
const QRCodeElement = ({ layer, row, className }: DocumentElementProps<CodeLayerContent>) => {
  const content = layer.content;
  const value = content?.value || (content?.field ? row?.[content.field] : undefined);
  const size = Math.max(16, Math.round(Math.min(layer.width, layer.height)) || 64);

  if (!value) {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed #cbd5e1",
          background: "#f8fafc",
          fontSize: 9,
          color: "#94a3b8",
        }}
        data-layer-type="qrcode"
      >
        QR
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
      data-layer-type="qrcode"
      data-value={String(value)}
    >
      <QRCodeSVG value={String(value)} size={size} level="M" style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default QRCodeElement;
