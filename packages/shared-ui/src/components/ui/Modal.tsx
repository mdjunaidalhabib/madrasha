import React, { useEffect, useRef } from "react";
import { commonText, useText } from "../../i18n";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;

  // optional
  maxWidthClassName?: string; // e.g. "max-w-xl", "max-w-2xl"
  hideCloseButton?: boolean;
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  maxWidthClassName = "max-w-xl",
  hideCloseButton = false,
}: ModalProps) {
  const c = useText(commonText);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) || [],
      ).filter(
        (element) =>
          !element.matches(":disabled") && element.getClientRects().length > 0,
      );
    // Run after autofocus, and prefer the form's own focus target.
    const frame = requestAnimationFrame(() => {
      if (!panel?.contains(document.activeElement))
        (focusable()[0] || panel)?.focus();
    });
    const onKeyDown = (e: KeyboardEvent) => {
      // When dialogs are nested, only the topmost dialog handles keyboard navigation.
      const dialogs = document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"]',
      );
      const topDialog = dialogs[dialogs.length - 1];
      if (topDialog && topDialog !== panel) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          e.preventDefault();
          panel?.focus();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !panel?.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !panel?.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="animate-modalBackdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose} // overlay click
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-modalPanel flex max-h-[90vh] w-full ${maxWidthClassName} flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10`}
        onMouseDown={(e) => e.stopPropagation()} // prevent overlay close
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {title}
          </h3>

          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={c.close}
              title={c.close}
            >
              ✕
            </button>
          )}
        </div>

        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
