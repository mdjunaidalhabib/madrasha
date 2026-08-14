import React, { useCallback, useMemo, useState } from "react";
import { ToastContext, Toast, ToastType } from "./toastContext";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());

    const toastItem: Toast = { id, ...t };
    setItems((prev) => [toastItem, ...prev]);

    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 2800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  function borderClass(type: ToastType) {
    if (type === "success") return "border-emerald-200 dark:border-emerald-900/50";
    if (type === "error") return "border-red-200 dark:border-red-900/50";
    return "border-gray-200 dark:border-slate-700";
  }

  function titleClass(type: ToastType) {
    if (type === "success") return "text-emerald-700 dark:text-emerald-400";
    if (type === "error") return "text-red-700 dark:text-red-400";
    return "text-gray-800 dark:text-slate-200";
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast stack */}
      <div className="fixed right-4 top-4 z-[60] flex w-[360px] max-w-[92vw] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-2xl border bg-white p-3 shadow-lg dark:bg-slate-900",
              borderClass(t.type),
            ].join(" ")}
          >
            {t.title ? (
              <div
                className={["text-sm font-semibold", titleClass(t.type)].join(
                  " ",
                )}
              >
                {t.title}
              </div>
            ) : null}
            <div className="text-sm text-gray-700 dark:text-slate-300">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
