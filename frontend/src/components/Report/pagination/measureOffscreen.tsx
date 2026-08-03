import { useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from "react";

const isEqual = (a: unknown, b: unknown) => {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/**
 * Measures a real, off-screen copy of report content: the caller renders
 * whatever JSX it needs (heading + table + sample rows, a grid of cards, a
 * letter document, ...) into the returned `containerRef`, and this hook
 * calls `measure(container)` once layout has settled, storing the result in
 * state. Re-measures again once `document.fonts.ready` resolves, since
 * Bengali web fonts (Kalpurush/Hind Siliguri/Noto Sans Bengali) can finish
 * loading after the first pass and would otherwise leave the measurement
 * based on fallback-font row heights.
 */
export const useOffscreenMeasurement = <T,>(
  measure: (container: HTMLDivElement) => T | null,
  deps: DependencyList,
): { containerRef: RefObject<HTMLDivElement>; result: T | null } => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<T | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setResult(null);
      return;
    }

    let cancelled = false;
    const runMeasure = () => {
      if (cancelled) return;
      const next = measure(container);
      setResult((prev) => (isEqual(prev, next) ? prev : next));
    };

    runMeasure();

    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(runMeasure).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, result };
};
