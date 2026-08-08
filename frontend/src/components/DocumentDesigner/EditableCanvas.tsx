import { useRef, type CSSProperties } from "react";
import { Rnd } from "react-rnd";
import { renderLayer } from "./engine/renderLayer";
import RotateHandle from "./RotateHandle";
import type { CanvasBackground, DocumentLayer } from "./types";

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

        return (
          <Rnd
            key={layer.id}
            size={{ width: layer.width, height: layer.height }}
            position={{ x: layer.x, y: layer.y }}
            disableDragging={layer.locked}
            enableResizing={!layer.locked}
            bounds="parent"
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
            }}
          >
            <div
              ref={(el) => {
                boxRefs.current[layer.id] = el;
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelectLayer(layer.id);
              }}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                cursor: layer.locked ? "not-allowed" : "move",
                transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
              }}
            >
              {renderLayer(layer, { row, positioned: false })}
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
