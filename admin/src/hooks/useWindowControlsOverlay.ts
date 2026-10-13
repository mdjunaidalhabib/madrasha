import { useEffect, useState } from "react";

type WcoNavigator = Navigator & {
  windowControlsOverlay?: {
    visible: boolean;
    addEventListener: (type: "geometrychange", cb: () => void) => void;
    removeEventListener: (type: "geometrychange", cb: () => void) => void;
  };
};

/**
 * True when the installed desktop app is drawing its own content inside the
 * title bar (Window Controls Overlay). In that mode the OS title bar is gone and
 * our page must paint the green bar itself. False in a normal tab, on mobile, or
 * when the user turned the overlay off from the title-bar toggle.
 */
export function useWindowControlsOverlay(): boolean {
  const read = () => {
    const wco = (navigator as WcoNavigator).windowControlsOverlay;
    return !!wco?.visible;
  };
  const [visible, setVisible] = useState(read);

  useEffect(() => {
    const wco = (navigator as WcoNavigator).windowControlsOverlay;
    if (!wco) return;
    const update = () => setVisible(wco.visible);
    update();
    wco.addEventListener("geometrychange", update);
    return () => wco.removeEventListener("geometrychange", update);
  }, []);

  return visible;
}
