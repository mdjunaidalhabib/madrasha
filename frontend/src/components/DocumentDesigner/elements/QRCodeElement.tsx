import type { DocumentElementProps, CodeLayerContent } from "../types";

/**
 * Placeholder QR code renderer. Wiring up an actual QR-generation library is
 * a future feature — this only guarantees the element has a stable slot in
 * the layer model and the engine so the real implementation can drop in
 * without touching callers.
 */
const QRCodeElement = ({ layer, row, className }: DocumentElementProps<CodeLayerContent>) => {
  const content = layer.content;
  const value = content?.value || (content?.field ? row?.[content.field] : undefined);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid #cbd5e1",
        background: "#f8fafc",
        fontSize: 9,
        color: "#64748b",
        textAlign: "center",
        overflow: "hidden",
        wordBreak: "break-all",
      }}
      data-layer-type="qrcode"
      data-value={value ?? ""}
    >
      {value ? String(value) : "QR"}
    </div>
  );
};

export default QRCodeElement;
