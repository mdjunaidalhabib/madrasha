import { useToastStore } from "../../store/toastStore";

const typeStyle: Record<string, string> = {
  success: "bg-green-600",
  error: "bg-red-600",
  info: "bg-gray-900",
};

export default function Toaster() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="fixed right-4 top-4 z-[9999] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "min-w-[240px] max-w-[360px] rounded px-4 py-3 text-white shadow",
            typeStyle[t.type],
          ].join(" ")}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-5">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="opacity-80 hover:opacity-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
