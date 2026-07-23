import type { CSSProperties } from "react";
import type { DocumentElementProps, ImageLayerContent } from "../types";

const fitToObjectFit: Record<NonNullable<ImageLayerContent["fit"]>, CSSProperties["objectFit"]> = {
  cover: "cover",
  contain: "contain",
  fill: "fill",
};

/**
 * Generic image element. `PhotoElement`, `LogoElement`, and `SignatureElement`
 * are thin, semantically-named wrappers around this same rendering path so
 * there is exactly one place that resolves an image src from either a
 * literal `content.src` or a `row[content.field]` value.
 */
const ImageElement = ({ layer, row, className }: DocumentElementProps<ImageLayerContent>) => {
  const content = layer.content;
  const src = content?.src || (content?.field ? row?.[content.field] : undefined);
  const objectFit = fitToObjectFit[content?.fit ?? "cover"];

  if (!src) {
    return (
      <div
        className={className}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}
      >
        <span style={{ fontSize: 10, color: "#94a3b8" }}>{content?.alt || "image"}</span>
      </div>
    );
  }

  return (
    <img
      src={String(src)}
      alt={content?.alt || ""}
      className={className}
      style={{ width: "100%", height: "100%", objectFit }}
    />
  );
};

export default ImageElement;
