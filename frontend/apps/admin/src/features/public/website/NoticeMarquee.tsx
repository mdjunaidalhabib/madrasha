import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Megaphone } from "lucide-react";
import { withAlpha } from "./colorUtils";

// A fixed amber/yellow highlight — notices read as an alert-style banner
// on any madrasa's theme color, and it always stays visually distinct from
// the nav band above it (which uses the theme's accentSolid).
const NOTICE_BG = "#fbbf24";
const NOTICE_TEXT = "#3f2903";

export default function NoticeMarquee({ text, speed }: { text?: string | null; speed?: number | null }) {
  const items = (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // px distances the (single, non-duplicated) track must travel: from just
  // past the bar's right edge to just past its own left edge, so it always
  // enters/exits fully off-screen regardless of text or bar width - measured
  // via refs rather than assumed, since both vary per madrasa/notice.
  const [travel, setTravel] = useState<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const measure = () => setTravel({ start: container.clientWidth, end: -track.scrollWidth });
    measure();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.join("")]);

  if (!items.length) return null;

  const trackStyle: CSSProperties = travel
    ? ({
        animationDuration: `${speed || 28}s`,
        "--marquee-start": `${travel.start}px`,
        "--marquee-end": `${travel.end}px`,
      } as CSSProperties)
    : { visibility: "hidden" };

  return (
    <div className="overflow-hidden" style={{ backgroundColor: NOTICE_BG }}>
      <div className="mx-auto flex max-w-6xl items-stretch">
        <div
          className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
          style={{ backgroundColor: withAlpha("#000000", 0.12), color: NOTICE_TEXT }}
        >
          <Megaphone size={14} />
          <span className="hidden sm:inline">নোটিশ</span>
        </div>
        <div ref={containerRef} className="relative flex-1 overflow-hidden py-1.5">
          <div
            ref={trackRef}
            className="notice-marquee-track flex w-max items-center gap-24 whitespace-nowrap"
            style={trackStyle}
          >
            {items.map((line, index) => (
              <span key={index} className="inline-flex items-center gap-6 text-xs font-semibold md:text-sm">
                <span style={{ color: NOTICE_TEXT }}>{line}</span>
                {index < items.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="inline-block h-3.5 w-px shrink-0 rounded-full md:h-4"
                    style={{ backgroundColor: withAlpha(NOTICE_TEXT, 0.35) }}
                  />
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
