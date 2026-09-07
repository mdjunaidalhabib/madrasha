import { useEffect, useRef, type CSSProperties } from "react";
import { Rnd } from "react-rnd";
import { renderLayer } from "./engine/renderLayer";
import RotateHandle from "./RotateHandle";
import type { CanvasBackground, DocumentLayer, ImageLayerContent } from "./types";

const IMAGE_LIKE_TYPES = new Set(["image", "photo", "logo", "signature"]);

export interface EditableCanvasProps {
  width: number;
  height: number;
  background?: CanvasBackground;
  layers: DocumentLayer[];
  row?: Record<string, any>;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onChangeLayer: (id: string, patch: Partial<DocumentLayer>) => void;
  zoom?: number;
  className?: string;
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
 * The interactive twin of `Canvas.tsx` (which stays a pure read-only render
 * used by print/preview). Renders the exact same layers through the same
 * `renderLayer()` engine, so what the admin designs is guaranteed to match
 * what `DocumentPreview`/print later produce - this component only adds a
 * `<Rnd>` drag/resize wrapper and a rotate handle around each layer.
 */
const EditableCanvas = ({
  width,
  height,
  background,
  layers,
  row,
  selectedLayerId,
  onSelectLayer,
  onChangeLayer,
  zoom = 1,
  className,
}: EditableCanvasProps) => {
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Arrow-key nudge for the selected layer - 1px per press, 10px with Shift
  // held, matching the standard design-tool convention. Skipped while focus
  // is in a text field (name input, text-layer textarea, etc.) so typing
  // arrow keys there doesn't hijack and move the layer instead.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedLayerId) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;

      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || active?.isContentEditable) return;

      const layer = layers.find((l) => l.id === selectedLayerId);
      if (!layer || layer.locked) return;

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else dy = step;

      e.preventDefault();
      const nextX = Math.min(Math.max(layer.x + dx, 0), Math.max(width - layer.width, 0));
      const nextY = Math.min(Math.max(layer.y + dy, 0), Math.max(height - layer.height, 0));
      onChangeLayer(layer.id, { x: nextX, y: nextY });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLayerId, layers, width, height, onChangeLayer]);

  return (
    <div
      className={className}
      data-document-canvas-editable=""
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onSelectLayer(null);
      }}
      style={{
        position: "relative",
        width,
        height,
        transform: zoom !== 1 ? `scale(${zoom})` : undefined,
        transformOrigin: "top left",
        ...backgroundStyle(background),
      }}
    >
      {layers.map((layer) => {
        const selected = layer.id === selectedLayerId;
        if (layer.visible === false && !selected) return null;
        const lockAspectRatio =
          IMAGE_LIKE_TYPES.has(layer.type) && Boolean((layer.content as ImageLayerContent | undefined)?.lockAspectRatio);

        return (
          <Rnd
            key={layer.id}
            size={{ width: layer.width, height: layer.height }}
            position={{ x: layer.x, y: layer.y }}
            disableDragging={layer.locked}
            enableResizing={!layer.locked}
            lockAspectRatio={lockAspectRatio}
            bounds="parent"
            // The whole canvas is CSS-scaled by `zoom` (transform: scale());
            // without telling Rnd about that factor its internal screen-px ->
            // element-coordinate math goes wrong whenever zoom isn't 100%, so
            // dragging/resizing drifts from the pointer - most noticeable on
            // mobile, where the canvas is usually zoomed out to fit the screen.
            scale={zoom}
            // The inner content div used to stopPropagation() its own
            // mousedown to keep the canvas's empty-area deselect handler
            // from firing - but that also blocked this same mousedown from
            // ever reaching react-rnd's own drag-start listener (bound on
            // this ancestor node), so dragging never actually began.
            onDragStart={() => onSelectLayer(layer.id)}
            onDragStop={(_e, d) => onChangeLayer(layer.id, { x: Math.round(d.x), y: Math.round(d.y) })}
            onResizeStop={(_e, _direction, ref, _delta, position) => {
              onChangeLayer(layer.id, {
                width: Math.round(ref.offsetWidth),
                height: Math.round(ref.offsetHeight),
                x: Math.round(position.x),
                y: Math.round(position.y),
              });
            }}
            style={{
              opacity: layer.visible === false ? 0.35 : 1,
              outline: selected ? "2px solid #2563eb" : "1px dashed transparent",
              outlineOffset: 1,
              // Without this, a touch-drag on mobile can be swallowed by the
              // page/canvas-container's own scroll gesture before react-rnd's
              // touch handler gets it, making the layer feel undraggable.
              touchAction: "none",
            }}
          >
            <div
              ref={(el) => {
                boxRefs.current[layer.id] = el;
              }}
              onMouseDown={() => onSelectLayer(layer.id)}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                cursor: layer.locked ? "not-allowed" : "move",
                transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
              }}
            >
              <div
                style={{
                  // Per-layer cosmetic overrides (fontSize/color/fontWeight/
                  // fontFamily/border/borderRadius from the property
                  // inspector) go first so the geometry below always wins if
                  // a key ever collides.
                  ...layer.style,
                  width: "100%",
                  height: "100%",
                  // Kept on its own inner box (not the outer one the rotate
                  // handle is a sibling of) - a circular-photo borderRadius
                  // needs overflow clipped to actually crop the image, but
                  // clipping the outer box would also cut off the handle,
                  // which sits above the box on purpose.
                  overflow: layer.style?.borderRadius ? "hidden" : undefined,
                  // Blocks native text highlighting so a drag attempt on a
                  // text layer can't turn into a text-selection instead.
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              >
                {renderLayer(layer, { row, positioned: false })}
              </div>
              {selected && !layer.locked && (
                <RotateHandle
                  getRect={() => boxRefs.current[layer.id]?.getBoundingClientRect()}
                  onRotate={(degrees) => onChangeLayer(layer.id, { rotation: degrees })}
                />
              )}
            </div>
          </Rnd>
        );
      })}
    </div>
  );
};

export default EditableCanvas;
