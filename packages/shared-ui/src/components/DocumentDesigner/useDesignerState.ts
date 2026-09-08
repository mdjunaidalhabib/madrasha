import { useCallback, useState } from "react";
import { createLayer } from "./types";
import type { CanvasBackground, DocumentLayer, LayerType } from "./types";

export interface DesignerState {
  width: number;
  height: number;
  background: CanvasBackground | undefined;
  layers: DocumentLayer[];
  selectedLayerId: string | null;
}

const DEFAULT_CONTENT_BY_TYPE: Record<LayerType, unknown> = {
  text: { text: "টেক্সট" },
  image: { alt: "ছবি" },
  photo: { field: "image", fit: "cover" },
  qrcode: { field: "registration_no" },
  barcode: { field: "registration_no" },
  logo: { alt: "লোগো" },
  signature: { alt: "স্বাক্ষর" },
  shape: { shape: "rectangle", fill: "#e2e8f0" },
};

let layerCounter = 0;
const nextLayerId = (type: LayerType) => `${type}-${Date.now()}-${layerCounter++}`;

/**
 * Owns the in-memory editing state (canvas size/background/layers +
 * current selection) shared by both the Super Admin and Tenant designer
 * pages, so layer add/move/resize/rotate/reorder/lock/hide/duplicate/
 * delete logic lives in exactly one place instead of being re-implemented
 * per page. The pages themselves only own persistence (fetch/save-draft/
 * publish via the API) - this hook never talks to the network.
 */
export function useDesignerState(initial: DesignerState) {
  const [state, setState] = useState<DesignerState>(initial);

  const load = useCallback((next: DesignerState) => setState(next), []);

  const selectLayer = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedLayerId: id }));
  }, []);

  const updateLayer = useCallback((id: string, patch: Partial<DocumentLayer>) => {
    setState((s) => ({
      ...s,
      layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const setBackground = useCallback((background: CanvasBackground | undefined) => {
    setState((s) => ({ ...s, background }));
  }, []);

  const setCanvasSize = useCallback((width: number, height: number) => {
    setState((s) => ({ ...s, width, height }));
  }, []);

  const addLayer = useCallback((type: LayerType) => {
    const layer = createLayer({
      id: nextLayerId(type),
      type,
      x: 20,
      y: 20,
      width: type === "text" ? 160 : 80,
      height: type === "text" ? 24 : 80,
      content: DEFAULT_CONTENT_BY_TYPE[type],
    });
    setState((s) => ({ ...s, layers: [...s.layers, layer], selectedLayerId: layer.id }));
    return layer.id;
  }, []);

  const duplicateLayer = useCallback((id: string) => {
    setState((s) => {
      const source = s.layers.find((l) => l.id === id);
      if (!source) return s;
      const copy: DocumentLayer = {
        ...source,
        id: nextLayerId(source.type),
        x: source.x + 12,
        y: source.y + 12,
      };
      return { ...s, layers: [...s.layers, copy], selectedLayerId: copy.id };
    });
  }, []);

  const deleteLayer = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      layers: s.layers.filter((l) => l.id !== id),
      selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
    }));
  }, []);

  const toggleVisible = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      layers: s.layers.map((l) => (l.id === id ? { ...l, visible: l.visible === false } : l)),
    }));
  }, []);

  const toggleLocked = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      layers: s.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
    }));
  }, []);

  /** Layer order = z-order (last item renders on top), matching Canvas.tsx.
   * "Move up" here means "closer to the front", i.e. later in the array. */
  const moveLayer = useCallback((id: string, direction: "up" | "down" | "front" | "back") => {
    setState((s) => {
      const index = s.layers.findIndex((l) => l.id === id);
      if (index === -1) return s;
      const layers = [...s.layers];
      const [layer] = layers.splice(index, 1);

      if (direction === "front") layers.push(layer);
      else if (direction === "back") layers.unshift(layer);
      else if (direction === "up") layers.splice(Math.min(index + 1, layers.length), 0, layer);
      else layers.splice(Math.max(index - 1, 0), 0, layer);

      return { ...s, layers };
    });
  }, []);

  return {
    state,
    load,
    selectLayer,
    updateLayer,
    setBackground,
    setCanvasSize,
    addLayer,
    duplicateLayer,
    deleteLayer,
    toggleVisible,
    toggleLocked,
    moveLayer,
  };
}
