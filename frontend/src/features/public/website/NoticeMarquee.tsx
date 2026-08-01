import { Megaphone } from "lucide-react";

export default function NoticeMarquee({
  text,
  accentSolid,
  onAccent,
}: {
  text?: string | null;
  accentSolid: string;
  onAccent: string;
}) {
  const items = (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!items.length) return null;

  return (
    <div className="overflow-hidden border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-stretch">
        <div
          className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
          style={{ backgroundColor: accentSolid, color: onAccent }}
        >
          <Megaphone size={14} />
          <span className="hidden sm:inline">নোটিশ</span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="notice-marquee-track flex w-max items-center gap-16 whitespace-nowrap py-1.5">
            {[...items, ...items].map((line, index) => (
              <span key={index} className="text-xs font-semibold text-slate-700 md:text-sm">
                {line}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
