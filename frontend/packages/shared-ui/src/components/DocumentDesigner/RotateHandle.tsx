import { useRef } from "react";

export interface RotateHandleProps {
  /** Returns the current on-screen rect of the layer box this handle
   * belongs to - read fresh on every pointerdown since drag/resize can
   * move it between rotations. */
  getRect: () => DOMRect | undefined;
  onRotate: (degrees: number) => void;
}

/**
 * react-rnd has no built-in rotation support, so this is a small, purpose
 * built handle: a circle above the selected layer's box that, while
 * dragged, computes the pointer's angle relative to the box's center and
 * reports it as degrees (0 = upright, clockwise-positive - matches
 * DocumentLayer.rotation's documented convention in types.ts).
 */
const RotateHandle = ({ getRect, onRotate }: RotateHandleProps) => {
  const dragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = getRect();
    if (!rect) return;
    dragging.current = true;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const move = (ev: PointerEvent) => {
      if (!dragging.current) return;
      const angleRad = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
      // atan2 with (0,-1) (straight up) gives -90deg; shift so "up" = 0deg.
      let degrees = angleRad * (180 / Math.PI) + 90;
      degrees = Math.round(((degrees % 360) + 360) % 360);
      onRotate(degrees);
    };

    const up = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="button"
      aria-label="Rotate layer"
      onPointerDown={handlePointerDown}
      style={{
        position: "absolute",
        top: -26,
        left: "50%",
        transform: "translateX(-50%)",
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "#2563eb",
        border: "2px solid #fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        cursor: "grab",
        zIndex: 20,
      }}
    />
  );
};

export default RotateHandle;
