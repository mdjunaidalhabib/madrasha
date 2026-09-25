import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink } from "lucide-react";

// Full-screen preview of a brand image. The image sits on a checkerboard so
// transparent PNG logos stay clearly visible; a toggle flips to a plain dark
// backdrop. Closes on Esc, backdrop click, or the ✕ button.
export default function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [checker, setChecker] = useState(true);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{alt}</p>
          {size && (
            <p className="text-xs text-white/60">
              {size.w} × {size.h} px
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setChecker((v) => !v)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            title="পটভূমি পরিবর্তন"
          >
            {checker ? "গাঢ় পটভূমি" : "চেক পটভূমি"}
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            title="নতুন ট্যাবে মূল ছবি খুলুন"
          >
            <ExternalLink size={18} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            title="বন্ধ করুন (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0 sm:p-8 sm:pt-0">
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          onLoad={(e) =>
            setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          style={
            checker
              ? {
                  backgroundColor: "#fff",
                  backgroundImage:
                    "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
                }
              : { backgroundColor: "#111827" }
          }
        />
      </div>
    </div>,
    document.body
  );
}
