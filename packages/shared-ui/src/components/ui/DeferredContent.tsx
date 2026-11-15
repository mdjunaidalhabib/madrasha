import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

/** Reserve space and load expensive UI only as it approaches the viewport. */
export default function DeferredContent({
  children,
  height = "h-64",
  fallback,
}: {
  children: ReactNode;
  height?: string;
  fallback?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const placeholder = fallback ?? (
    <div
      className={`${height} animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800`}
      aria-busy="true"
    />
  );
  return (
    <div ref={ref} className="min-w-0">
      <Suspense fallback={placeholder}>
        {visible ? children : placeholder}
      </Suspense>
    </div>
  );
}
