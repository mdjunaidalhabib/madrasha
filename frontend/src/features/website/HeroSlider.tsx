import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { withAlpha } from "./colorUtils";
import type { HeroVariant } from "./themes";

export type PublicSlide = {
  id?: number;
  title?: string | null;
  subtitle?: string | null;
  image_url: string;
};

const AUTOPLAY_MS = 5500;
const TRANSITION_MS = 1000;

// Aspect-ratio driven (not a fixed-pixel ladder) so the box always keeps a
// clean, professional proportion as it scales with the 1200px-capped width
// below. Base ratio matches the recommended slide upload size (1600x900,
// 16:9) so an image fits edge-to-edge with no letterbox padding on phones
// and tablets; it only opens up to a wide 21:9 banner on desktop. Paired
// with object-contain (the full photo always visible, never cropped)
// rather than object-cover.
const HERO_ASPECT = "aspect-[16/9] lg:aspect-[21/9]";

// Per-theme hero shape. "classic" is the original; "rounded" (modern) softens
// the bottom corners; "flat" (minimal) is a touch shorter with square edges.
const HERO_VARIANT_CLASS: Record<HeroVariant, string> = {
  classic: HERO_ASPECT,
  rounded: `${HERO_ASPECT} rounded-b-[1.75rem] md:rounded-b-[3rem]`,
  flat: "aspect-[16/9] lg:aspect-[24/9]",
};

// One consistent crossfade + gentle scale-in every time a slide changes —
// a mix of different effects (slide/zoom-in/zoom-out) read as jumpy when
// cycled randomly, so every transition now uses the same calm motion.
type SliderState = {
  active: number;
  prevActive: number | null;
  phase: "start" | "end";
};

export default function HeroSlider({
  slides,
  fallbackTitle,
  fallbackSubtitle,
  accentSolid,
  variant = "classic",
  websiteStatus,
  actions,
}: {
  slides: PublicSlide[];
  fallbackTitle: string;
  fallbackSubtitle: string;
  accentSolid: string;
  variant?: HeroVariant;
  websiteStatus?: string;
  actions?: ReactNode;
}) {
  const [state, setState] = useState<SliderState>({
    active: 0,
    prevActive: null,
    phase: "end",
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSlides = slides.length > 0;

  // Only the active slide's image downloads on first paint. Every other
  // slide is rendered without a src until it's about to be shown — without
  // this, all slides (however many the admin uploaded) downloaded at once
  // on page load, even though only one is ever visible at a time.
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(() => new Set([0]));
  useEffect(() => {
    if (!slides.length) return;
    const next = (state.active + 1) % slides.length;
    setLoadedIndices((prev) => {
      if (prev.has(state.active) && prev.has(next)) return prev;
      const merged = new Set(prev);
      merged.add(state.active);
      merged.add(next);
      return merged;
    });
  }, [state.active, slides.length]);

  const transitionTo = (compute: (prevActive: number) => number) => {
    setState((s) => {
      if (!slides.length) return s;
      const next = ((compute(s.active) % slides.length) + slides.length) % slides.length;
      if (next === s.active) return s;
      return { active: next, prevActive: s.active, phase: "start" };
    });
  };

  // Two-phase commit: render the incoming slide at its "from" offset with
  // transitions disabled first, then (next frame) flip to the resting
  // position with transitions enabled — otherwise the browser never gets a
  // chance to paint the starting position and nothing appears to animate.
  useEffect(() => {
    if (state.phase !== "start") return;
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        setState((s) => (s.phase === "start" ? { ...s, phase: "end" } : s));
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [state.phase, state.active]);

  useEffect(() => {
    if (!hasSlides || slides.length < 2) return;
    timerRef.current = setInterval(() => {
      transitionTo((i) => i + 1);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSlides, slides.length]);

  const goTo = (index: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    transitionTo(() => index);
    if (slides.length > 1) {
      timerRef.current = setInterval(() => {
        transitionTo((i) => i + 1);
      }, AUTOPLAY_MS);
    }
  };

  const current = hasSlides ? slides[state.active] : null;
  const title = current?.title || fallbackTitle;
  const subtitle = current?.subtitle || fallbackSubtitle;

  return (
    <section
      id="top"
      className={`relative mx-auto mt-1.5 overflow-hidden rounded-xl text-white max-w-[1200px] md:mt-2 ${HERO_VARIANT_CLASS[variant] ?? HERO_ASPECT}`}
      style={{ background: `linear-gradient(135deg, ${accentSolid} 0%, #05070d 85%)` }}
    >
      {hasSlides && (
        <div className="absolute inset-0">
          {slides.map((slide, index) => {
            const isEntering = index === state.active;
            const isLeaving = index === state.prevActive && index !== state.active;
            const atStart = state.phase === "start";

            let opacity = 0;
            let transform = "none";
            let transitionDuration = "0ms";

            if (isEntering) {
              opacity = atStart ? 0 : 1;
              transform = atStart ? "scale(1.04)" : "none";
              transitionDuration = atStart ? "0ms" : `${TRANSITION_MS}ms`;
            } else if (isLeaving) {
              opacity = atStart ? 1 : 0;
              transitionDuration = `${TRANSITION_MS}ms`;
            }

            return (
              <div
                key={slide.id ?? slide.image_url}
                className="absolute inset-0 ease-out"
                style={{ opacity, transform, transitionProperty: "opacity, transform", transitionDuration }}
              >
                {/* Blurred, cropped copy fills the box edge-to-edge behind the
                    real photo — so object-contain below can show the whole
                    image, on any device, without ever leaving bare gaps. */}
                {loadedIndices.has(index) && (
                  <>
                    <img
                      src={slide.image_url}
                      alt=""
                      aria-hidden="true"
                      fetchPriority={index === 0 ? "high" : "auto"}
                      className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
                      style={{
                        animation:
                          isEntering && !atStart
                            ? "heroKenBurns 9s ease-in-out infinite alternate"
                            : undefined,
                      }}
                    />
                    <img
                      src={slide.image_url}
                      alt={slide.title || "Slide"}
                      fetchPriority={index === 0 ? "high" : "auto"}
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  </>
                )}
              </div>
            );
          })}
          {/* Vertical scrim — darkest where the headline sits (bottom) and
              faintly at the top, so text stays readable on any photo while
              the middle of the image stays clear. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/35" />
        </div>
      )}

      {!hasSlides && (
        <>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-black/15" />
          <div
            className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
            style={{ backgroundColor: withAlpha("#ffffff", 0.08) }}
          />
          <div
            className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full blur-3xl"
            style={{ backgroundColor: withAlpha(accentSolid, 0.45) }}
          />
        </>
      )}

      <div className="relative flex h-full flex-col items-center justify-center px-4 pb-10 text-center md:pb-14">
        <h1
          key={`title-${state.active}`}
          className="line-clamp-2 max-w-4xl animate-heroFadeUp text-3xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl"
          style={{ textShadow: "0 2px 18px rgba(0,0,0,0.55)" }}
        >
          {title}
        </h1>
        <span
          aria-hidden="true"
          className="mt-4 hidden h-1 w-16 rounded-full md:block"
          style={{ backgroundColor: withAlpha("#ffffff", 0.85) }}
        />
        <p
          key={`subtitle-${state.active}`}
          className="mx-auto mt-4 line-clamp-2 max-w-2xl animate-heroFadeUp text-sm leading-relaxed text-white/90 md:text-lg"
          style={{ textShadow: "0 1px 10px rgba(0,0,0,0.55)" }}
        >
          {subtitle}
        </p>

        {actions && <div className="mt-8 hidden flex-wrap items-center justify-center gap-3 md:flex">{actions}</div>}

        {websiteStatus === "limited" && (
          <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-2 rounded-xl bg-amber-400/15 px-4 py-3 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/30">
            Limited mode enabled by Super Admin.
          </div>
        )}

        {hasSlides && slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-14 flex items-center justify-center gap-2 md:bottom-16">
            {slides.map((slide, index) => (
              <button
                key={slide.id ?? slide.image_url}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Slide ${index + 1}`}
                className="h-2 rounded-full transition-all"
                style={{
                  width: index === state.active ? 24 : 8,
                  backgroundColor: index === state.active ? "#ffffff" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {hasSlides && slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(state.active - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 md:flex"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => goTo(state.active + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 md:flex"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </section>
  );
}
