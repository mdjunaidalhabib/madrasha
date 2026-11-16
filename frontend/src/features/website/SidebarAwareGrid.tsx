import { Children, useCallback, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";

/** Size each row independently so later rows can use space below the sidebar. */
export default function SidebarAwareGrid({
  children,
  kind = "people",
  className = "",
  gridRef,
}: {
  children: ReactNode;
  kind?: "people" | "gallery" | "video";
  className?: string;
  gridRef?: MutableRefObject<HTMLDivElement | null>;
}) {
  const items = Children.toArray(children);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rowSizes, setRowSizes] = useState<number[]>([]);
  const attachRoot = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (gridRef) gridRef.current = node;
  }, [gridRef]);
  const rows: ReactNode[][] = [];
  let offset = 0;
  for (const size of rowSizes) {
    if (offset >= items.length) break;
    rows.push(items.slice(offset, offset + size));
    offset += size;
  }
  if (offset < items.length) rows.push(items.slice(offset));

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      let remaining = items.length;
      const next: number[] = [];
      for (const row of Array.from(root.children)) {
        if (!remaining) break;
        const columns = getComputedStyle(row).gridTemplateColumns.split(" ").length;
        const size = Math.min(Math.max(1, columns), remaining);
        next.push(size);
        remaining -= size;
      }
      const capacity = next[next.length - 1] || 1;
      while (remaining) {
        const size = Math.min(capacity, remaining);
        next.push(size);
        remaining -= size;
      }
      setRowSizes((previous) =>
        previous.length === next.length && previous.every((size, index) => size === next[index])
          ? previous
          : next,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const row of Array.from(root.children)) observer.observe(row);
    const sidebar = root.closest(".public-website-flow")?.querySelector(".public-website-sidebar");
    if (sidebar) observer.observe(sidebar);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [items.length, kind, rowSizes]);

  return (
    <div ref={attachRoot} className={`public-website-${kind}-grid mt-8 ${className}`}>
      {rows.map((row, index) => (
        <div key={index} className="public-website-card-row">
          {row}
        </div>
      ))}
    </div>
  );
}
