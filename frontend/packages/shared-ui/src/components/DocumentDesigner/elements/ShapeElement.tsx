import type { DocumentElementProps, ShapeLayerContent } from "../types";

/** Simple decorative shape primitive (rectangle, circle, or horizontal line). */
const ShapeElement = ({ layer, className }: DocumentElementProps<ShapeLayerContent>) => {
  const content = layer.content;
  const shape = content?.shape ?? "rectangle";

  const common = {
    width: "100%",
    height: "100%",
    background: content?.fill ?? "transparent",
    border: content?.strokeWidth
      ? `${content.strokeWidth}px solid ${content.stroke ?? "#0f172a"}`
      : content?.stroke
        ? `1px solid ${content.stroke}`
        : undefined,
  } as const;

  if (shape === "circle") {
    return <div className={className} style={{ ...common, borderRadius: "9999px" }} />;
  }

  if (shape === "line") {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          height: content?.strokeWidth ?? 1,
          background: content?.stroke ?? "#0f172a",
        }}
      />
    );
  }

  return <div className={className} style={common} />;
};

export default ShapeElement;
