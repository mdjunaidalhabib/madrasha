import React, { useEffect } from "react";

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
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={onClose} // overlay click
    >
      <div
        className={`flex max-h-[90vh] w-full ${maxWidthClassName} flex-col rounded-2xl bg-white shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()} // prevent overlay close
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Close"
              title="Close"
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
