import { useCallback, useEffect, useState } from "react";

export type ColumnOption<T extends string> = {
  key: T;
  label: string;
};

// localStorage-এ সংরক্ষিত কলাম-দৃশ্যমানতা — প্রতিটি ব্যবহারকারীর ব্রাউজারে
// আলাদাভাবে মনে রাখে কোন কোন কলাম সে দেখতে চায়।
export const useColumnVisibility = <T extends string>(storageKey: string, allKeys: readonly T[]) => {
  const [visible, setVisible] = useState<Set<T>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as T[];
        const validSaved = saved.filter((key) => allKeys.includes(key));
        if (validSaved.length > 0) return new Set(validSaved);
      }
    } catch {
      // corrupted storage — ডিফল্ট (সব কলাম দৃশ্যমান) ব্যবহার হবে
    }
    return new Set(allKeys);
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(visible)));
  }, [storageKey, visible]);

  const toggle = useCallback((key: T) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const reset = useCallback(() => setVisible(new Set(allKeys)), [allKeys]);

  const isVisible = useCallback((key: T) => visible.has(key), [visible]);

  return { visible, toggle, reset, isVisible };
};
