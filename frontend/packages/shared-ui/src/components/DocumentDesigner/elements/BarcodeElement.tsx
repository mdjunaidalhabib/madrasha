import type { DocumentElementProps, CodeLayerContent } from "../types";

/**
 * Placeholder barcode renderer, mirroring `QRCodeElement`. Actual barcode
 * rendering is a future feature; this reserves the slot in the layer model.
 */
const BarcodeElement = ({ layer, row, className }: DocumentElementProps<CodeLayerContent>) => {
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
      data-layer-type="barcode"
      data-value={value ?? ""}
    >
      {value ? String(value) : "Barcode"}
    </div>
  );
};

export default BarcodeElement;
