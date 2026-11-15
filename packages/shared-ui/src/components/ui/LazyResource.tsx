import { useEffect, useState, type ReactNode } from "react";
import DeferredContent from "./DeferredContent";
import { useText } from "../../i18n";

const text = {
  bn: { retry: "প্রিভিউ লোড হয়নি। আবার চেষ্টা করুন" },
  en: { retry: "Preview failed. Try again" },
};

function Resource<T>({
  id,
  load,
  children,
}: {
  id: number;
  load: (id: number) => Promise<T>;
  children: (value: T) => ReactNode;
}) {
  const [value, setValue] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const t = useText(text);
  useEffect(() => {
    let active = true;
    setValue(null);
    setFailed(false);
    void load(id)
      .then((value) => {
        if (active) setValue(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [id, load, attempt]);
  if (failed)
    return (
      <button
        type="button"
        className="flex h-96 w-full items-center justify-center rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800"
        onClick={() => setAttempt((n) => n + 1)}
      >
        {t.retry}
      </button>
    );
  return value ? (
    <>{children(value)}</>
  ) : (
    <div
      className="h-96 animate-pulse rounded-lg bg-slate-50 dark:bg-slate-800"
      aria-busy="true"
    />
  );
}

/** Fetch and render a preview only when its card approaches the viewport. */
export default function LazyResource<T>(props: {
  id: number;
  load: (id: number) => Promise<T>;
  children: (value: T) => ReactNode;
}) {
  return (
    <DeferredContent height="h-96">
      <Resource {...props} />
    </DeferredContent>
  );
}
