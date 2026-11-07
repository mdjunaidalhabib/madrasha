import { useEffect, useRef } from "react";
import { ArrowRight, GraduationCap, X } from "lucide-react";
import { useLang, useText } from "@madrasha/shared-ui/src/i18n";
import LandingLanguageSwitcher from "./LandingLanguageSwitcher";
import { BRAND_NAME, landingText } from "./landing.text";

export default function LandingMobileMenu({
  open,
  onClose,
  links,
  activeSection,
  adminUrl,
}: {
  open: boolean;
  onClose: () => void;
  links: { href: string; label: string }[];
  activeSection: string;
  adminUrl: string;
}) {
  const t = useText(landingText);
  const lang = useLang();
  const panel = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    let animation: Animation | undefined;
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (open) {
      if (!dialog.open) dialog.showModal();
      if (!reduced)
        animation = dialog.animate(
          [{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }],
          { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
    } else if (dialog.open) {
      if (reduced) dialog.close();
      else {
        animation = dialog.animate(
          [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }],
          { duration: 200, easing: "ease-in", fill: "forwards" },
        );
        void animation.finished
          .then(() => {
            if (!cancelled) dialog.close();
          })
          .catch(() => {});
      }
    }
    return () => {
      cancelled = true;
      animation?.cancel();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const resized = () => {
      if (desktop.matches) close.current();
    };
    desktop.addEventListener("change", resized);
    return () => desktop.removeEventListener("change", resized);
  }, []);

  return (
    <dialog
      ref={panel}
      id="landing-mobile-menu"
      aria-label={t.menuLabel}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
      className="fixed inset-0 m-0 me-auto h-dvh max-h-none w-[min(340px,88vw)] max-w-none overflow-hidden border-0 bg-white p-0 text-slate-900 shadow-2xl outline-none backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <GraduationCap size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xl font-bold">{BRAND_NAME}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{t.menuLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeMenu}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav
          aria-label={t.menuLabel}
          className={`flex-1 space-y-1 overflow-y-auto px-4 py-5 font-medium ${lang === "bn" ? "text-lg" : "text-base"}`}
        >
          {links.map((link) => {
            const active = activeSection === link.href.slice(1);
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={active ? "true" : undefined}
                onClick={onClose}
                className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${active ? "bg-emerald-50 font-semibold text-emerald-700" : "text-slate-600 hover:bg-slate-50 hover:text-emerald-700"}`}
              >
                {link.label}
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className={active ? "text-emerald-600" : "text-slate-300"}
                />
              </a>
            );
          })}
        </nav>
        <div className="shrink-0 space-y-5 border-t border-slate-100 bg-slate-50/60 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
          <a
            href={adminUrl}
            onClick={onClose}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {t.goToAdmin}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-500">{t.languageLabel}</span>
            <LandingLanguageSwitcher />
          </div>
        </div>
      </div>
    </dialog>
  );
}
