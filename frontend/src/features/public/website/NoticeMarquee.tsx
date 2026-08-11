import { Megaphone } from "lucide-react";
import { withAlpha } from "./colorUtils";

// A fixed amber/yellow highlight — notices read as an alert-style banner
// on any madrasa's theme color, and it always stays visually distinct from
// the nav band above it (which uses the theme's accentSolid).
const NOTICE_BG = "#fbbf24";
const NOTICE_TEXT = "#3f2903";

export default function NoticeMarquee({ text }: { text?: string | null }) {
  const items = (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!items.length) return null;

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
        <div className="relative flex-1 overflow-hidden py-1.5">
          <div className="notice-marquee-track flex w-max items-center gap-10 whitespace-nowrap">
            {[...items, ...items].map((line, index) => (
              <span key={index} className="inline-flex items-center gap-2 text-xs font-semibold md:text-sm">
                <span style={{ color: NOTICE_TEXT }}>{line}</span>
                <span aria-hidden="true" style={{ color: withAlpha(NOTICE_TEXT, 0.45) }}>
                  •
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
