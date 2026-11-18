import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, LogIn, Phone, X } from "lucide-react";
import { LanguageSwitcher, useText } from "@madrasha/shared-ui/src/i18n";
import { websiteText } from "./website.text";

export default function PublicMobileMenu({
  open, onClose, name, logo, phone, homeUrl, admissionUrl, guardianLoginUrl,
  accent, onAccent, children,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  logo?: string;
  phone?: string;
  homeUrl: string;
  admissionUrl: string;
  guardianLoginUrl: string;
  accent: string;
  onAccent: string;
  children: ReactNode;
}) {
  const t = useText(websiteText);
  const panel = useRef<HTMLDialogElement>(null);
  const [present, setPresent] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    let animation: Animation | undefined;
    let cancelled = false;
    if (open) {
      if (!dialog.open) dialog.showModal();
      setPresent(true);
    } else if (dialog.open) {
      const finish = () => {
        if (cancelled) return;
        dialog.close();
        setPresent(false);
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
      else {
        animation = dialog.animate(
          [{ translate: "0 0", opacity: 1 }, { translate: "-100% 0", opacity: 0 }],
          { duration: 220, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
        );
        void animation.finished.then(finish).catch(() => {});
      }
    }
    return () => {
      cancelled = true;
      animation?.cancel();
    };
  }, [open]);

  useEffect(() => {
    if (!present) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [present]);

  useEffect(() => {
    if (!present) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => { if (desktop.matches) close.current(); };
    onResize();
    desktop.addEventListener("change", onResize);
    return () => desktop.removeEventListener("change", onResize);
  }, [present]);

  useEffect(() => {
    const dialog = panel.current;
    return () => {
      if (!dialog) return;
      dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={panel}
      id="public-mobile-menu"
      aria-labelledby="public-mobile-menu-title"
      className="public-mobile-menu"
      style={{ "--menu-accent": accent, "--menu-on-accent": onAccent } as CSSProperties}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <div className="public-mobile-menu__content">
        <div className="public-mobile-menu__brand">
          <Link to={homeUrl} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
            <span className="public-mobile-menu__logo">
              {logo ? <img src={logo} alt={t.logo} className="h-full w-full object-cover" /> : <GraduationCap size={27} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <p id="public-mobile-menu-title" className="break-words text-base font-extrabold leading-snug text-slate-900">{name}</p>
              <p className="mt-1 text-xs text-slate-500">{t.officialWebsite}</p>
            </div>
          </Link>
          <button type="button" autoFocus onClick={onClose} aria-label={t.closeMenu} className="public-mobile-menu__close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="public-mobile-menu__scroll">
          <p className="px-3 pb-3 text-xs font-semibold text-slate-400">{t.menu}</p>
          <nav aria-label={t.menu} className="space-y-1">{children}</nav>
        </div>
        <div className="public-mobile-menu__footer">
          <Link to={admissionUrl} onClick={onClose} className="public-mobile-menu__admission">
            <GraduationCap size={19} aria-hidden="true" />
            <span className="flex-1">{t.onlineAdmission}</span>
            <ArrowRight size={17} className="rtl:rotate-180" aria-hidden="true" />
          </Link>
          <Link to={guardianLoginUrl} onClick={onClose} className="public-mobile-menu__login">
            <LogIn size={18} aria-hidden="true" />{t.guardianLogin}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            {phone && <a href={`tel:${phone}`} onClick={onClose} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-600"><Phone size={15} aria-hidden="true" /><span dir="ltr">{phone}</span></a>}
            <LanguageSwitcher dropUp className="ms-auto" />
          </div>
        </div>
      </div>
    </dialog>
  );
}
