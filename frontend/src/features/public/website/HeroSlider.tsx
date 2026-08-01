import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { withAlpha } from "./colorUtils";

export type PublicSlide = {
  id?: number;
  title?: string | null;
  subtitle?: string | null;
  image_url: string;
};

const AUTOPLAY_MS = 5500;
const TRANSITION_MS = 900;

// Fixed height per breakpoint so every slide image (whatever its native
// size) fills exactly the same box via object-cover — consistent framing
// on phones, tablets and desktops instead of height following text length.
const HERO_HEIGHT = "h-[380px] sm:h-[440px] md:h-[500px] lg:h-[560px] xl:h-[620px]";

// A different look each time the photo changes — cycled randomly (never
// repeating the same one twice in a row) instead of always the same fade.
const EFFECTS = ["fade", "slide-left", "slide-right", "zoom-in", "zoom-out"] as const;
type Effect = (typeof EFFECTS)[number];

const ENTER_FROM: Record<Effect, string> = {
  fade: "none",
  "slide-left": "translateX(5%)",
  "slide-right": "translateX(-5%)",
  "zoom-in": "scale(1.12)",
  "zoom-out": "scale(0.88)",
};

const LEAVE_TO: Record<Effect, string> = {
  fade: "none",
  "slide-left": "translateX(-5%)",
  "slide-right": "translateX(5%)",
  "zoom-in": "scale(0.92)",
  "zoom-out": "scale(1.08)",
};

type SliderState = {
  active: number;
  prevActive: number | null;
  effect: Effect;
  phase: "start" | "end";
};

function pickEffect(last: Effect): Effect {
  const options = EFFECTS.filter((e) => e !== last);
  return options[Math.floor(Math.random() * options.length)];
}

export default function HeroSlider({
  slides,
  fallbackTitle,
  fallbackSubtitle,
  accentSolid,
  websiteStatus,
}: {
  slides: PublicSlide[];
  fallbackTitle: string;
  fallbackSubtitle: string;
  accentSolid: string;
  websiteStatus?: string;
}) {
  const [state, setState] = useState<SliderState>({
    active: 0,
    prevActive: null,
    effect: "fade",
    phase: "end",
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSlides = slides.length > 0;

  const transitionTo = (compute: (prevActive: number) => number) => {
    setState((s) => {
      if (!slides.length) return s;
      const next = ((compute(s.active) % slides.length) + slides.length) % slides.length;
      if (next === s.active) return s;
      return { active: next, prevActive: s.active, effect: pickEffect(s.effect), phase: "start" };
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
      className={`relative overflow-hidden text-white ${HERO_HEIGHT}`}
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
              transform = atStart ? ENTER_FROM[state.effect] : "none";
              transitionDuration = atStart ? "0ms" : `${TRANSITION_MS}ms`;
            } else if (isLeaving) {
              opacity = atStart ? 1 : 0;
              transform = atStart ? "none" : LEAVE_TO[state.effect];
              transitionDuration = `${TRANSITION_MS}ms`;
            }

            return (
              <div
                key={slide.id ?? slide.image_url}
                className="absolute inset-0 ease-out"
                style={{ opacity, transform, transitionProperty: "opacity, transform", transitionDuration }}
              >
                <img
                  src={slide.image_url}
                  alt={slide.title || "Slide"}
                  className="h-full w-full object-cover"
                  style={{
                    animation:
                      isEntering && !atStart ? "heroKenBurns 9s ease-in-out infinite alternate" : undefined,
                  }}
                />
              </div>
            );
          })}
          {/* Light tint only — just enough for the title/subtitle to stay readable, image stays clear */}
          <div className="absolute inset-0 bg-black/20" />
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

      <div className="relative flex h-full flex-col items-center justify-center px-4 text-center">
        <h1
          key={`title-${state.active}`}
          className="line-clamp-2 max-w-3xl animate-heroFadeUp text-3xl font-extrabold leading-tight md:text-5xl"
          style={{ textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}
        >
          {title}
        </h1>
        <p
          key={`subtitle-${state.active}`}
          className="mx-auto mt-4 line-clamp-2 max-w-2xl animate-heroFadeUp text-sm text-white/90 md:text-base"
          style={{ textShadow: "0 1px 10px rgba(0,0,0,0.5)" }}
        >
          {subtitle}
        </p>

        {websiteStatus === "limited" && (
          <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-2 rounded-xl bg-amber-400/15 px-4 py-3 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/30">
            Limited mode enabled by Super Admin.
          </div>
        )}

        {hasSlides && slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-2">
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
