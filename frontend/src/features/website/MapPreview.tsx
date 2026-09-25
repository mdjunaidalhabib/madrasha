import { ExternalLink, MapPin, Navigation } from "lucide-react";

export default function MapPreview({
  href,
  title,
  address,
  label = "ম্যাপে দেখুন",
  className = "",
  compact = false,
}: {
  href: string;
  title?: string;
  address?: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Google Maps-এ লোকেশন দেখুন"
      className={`group relative block overflow-hidden bg-[#f1efe9] ${className}`}
    >
      {/* No Google Maps iframe on the public site (each embed is ~1-2 MB of
          script). A softened, generic OpenStreetMap snapshot (public/images,
          ~64 KB, street names deliberately unreadable so it never implies a
          wrong location) stands in, and the whole card links out. */}
      <img
        src="/images/map-preview.jpg"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
      />
      <span className="absolute left-1/2 top-1/2 h-2 w-5 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-black/25 blur-[1px]" />

      {/* Google-style red pin, its tip sitting on the map centre */}
      <span
        className="absolute left-1/2 top-1/2 origin-bottom -translate-x-1/2 -translate-y-full transition duration-300 group-hover:-translate-y-[108%]"
        style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.3))" }}
      >
        <svg viewBox="0 0 24 36" className={compact ? "h-7 w-5" : "h-11 w-8"} aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 36 12 36s12-15.2 12-24.1C24 5.3 18.6 0 12 0z" fill="#ea4335" />
          <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 36 12 36s12-15.2 12-24.1C24 5.3 18.6 0 12 0z" fill="none" stroke="#b31412" strokeWidth="1" />
          <circle cx="12" cy="12" r="4.2" fill="#a50e0e" />
        </svg>
      </span>

      {/* place card, like the one Google shows on a selected place */}
      {!compact && (title || address) && (
        <span className="absolute left-3 top-3 max-w-[75%] rounded-lg bg-white px-3.5 py-2.5 text-left shadow-md sm:max-w-[60%]">
          {title && <span className="block truncate text-sm font-bold text-slate-900">{title}</span>}
          {address && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{address}</span>}
          <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#1a73e8]">
            <Navigation size={12} />
            দিকনির্দেশনা
          </span>
        </span>
      )}

      {/* zoom control, purely decorative */}
      {!compact && (
        <span className="absolute bottom-16 right-3 flex flex-col overflow-hidden rounded-md bg-white text-lg leading-none text-slate-600 shadow-md">
          <span className="flex h-8 w-8 items-center justify-center border-b border-slate-200">+</span>
          <span className="flex h-8 w-8 items-center justify-center">−</span>
        </span>
      )}

      {/* OpenStreetMap's licence (ODbL) requires this credit on the image */}
      <span
        className={`absolute right-1 rounded bg-white/75 px-1 text-[9px] leading-tight text-slate-600 ${
          compact ? "bottom-8" : "bottom-12"
        }`}
      >
        © OpenStreetMap
      </span>

      <span
        className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-slate-900/80 font-semibold text-white backdrop-blur-sm transition group-hover:bg-slate-900/95 ${
          compact ? "py-1.5 text-xs" : "py-3 text-sm"
        }`}
      >
        <MapPin size={compact ? 13 : 16} />
        {label}
        <ExternalLink size={compact ? 11 : 14} className="opacity-70" />
      </span>
    </a>
  );
}
