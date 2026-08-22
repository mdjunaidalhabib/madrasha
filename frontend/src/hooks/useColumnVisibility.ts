import { useCallback, useEffect, useMemo, useState } from "react";

export type ColumnOption<T extends string> = {
  key: T;
  label: string;
};

type StoredState<T extends string> = {
  visible: T[];
  order: T[];
};

const isStoredState = <T extends string>(value: unknown): value is StoredState<T> =>
  !!value &&
  typeof value === "object" &&
  Array.isArray((value as StoredState<T>).visible) &&
  Array.isArray((value as StoredState<T>).order);

// localStorage-এ সংরক্ষিত কলাম-দৃশ্যমানতা ও কলামের ক্রম — প্রতিটি ব্যবহারকারীর
// ব্রাউজারে আলাদাভাবে মনে রাখে কোন কোন কলাম সে দেখতে চায় এবং কোন ক্রমে।
// defaultVisibleKeys না দিলে allKeys-ই ডিফল্ট (সব কলাম দৃশ্যমান) হিসেবে কাজ করে —
// যেসব পেজে কলাম সংখ্যা বেশি সেখানে অল্প কিছু কলাম ডিফল্টে দেখিয়ে বাকিগুলো
// ব্যবহারকারীর ইচ্ছামতো চালু করার সুযোগ দেওয়া যায়।
export const useColumnVisibility = <T extends string>(
  storageKey: string,
  allKeys: readonly T[],
  defaultVisibleKeys: readonly T[] = allKeys,
) => {
  const readInitial = (): StoredState<T> => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);

        if (isStoredState<T>(parsed)) {
          const validVisible = parsed.visible.filter((key) => allKeys.includes(key));
          const validOrder = parsed.order.filter((key) => allKeys.includes(key));
          const missingFromOrder = allKeys.filter((key) => !validOrder.includes(key));

          return {
            visible: validVisible.length > 0 ? validVisible : [...defaultVisibleKeys],
            order: [...validOrder, ...missingFromOrder],
          };
        }

        // পুরনো ফরম্যাট — শুধু দৃশ্যমান key-এর একটা অ্যারে (ক্রম ছাড়া)
        if (Array.isArray(parsed)) {
          const validSaved = (parsed as T[]).filter((key) => allKeys.includes(key));
          return {
            visible: validSaved.length > 0 ? validSaved : [...defaultVisibleKeys],
            order: [...allKeys],
          };
        }
      }
    } catch {
      // corrupted storage — ডিফল্ট ব্যবহার হবে
    }

    return { visible: [...defaultVisibleKeys], order: [...allKeys] };
  };

  const [state, setState] = useState<StoredState<T>>(readInitial);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, state]);

  const visible = useMemo(() => new Set(state.visible), [state.visible]);

  const toggle = useCallback((key: T) => {
    setState((prev) => ({
      ...prev,
      visible: prev.visible.includes(key)
        ? prev.visible.filter((k) => k !== key)
        : [...prev.visible, key],
    }));
  }, []);

  const reset = useCallback(() => {
    setState({ visible: [...defaultVisibleKeys], order: [...allKeys] });
  }, [defaultVisibleKeys, allKeys]);

  const isVisible = useCallback((key: T) => visible.has(key), [visible]);

  // কলামটিকে ক্রমের মধ্যে একধাপ আগে (-1) বা পরে (+1) সরায় — সীমানার বাইরে
  // গেলে কিছু করে না।
  const move = useCallback((key: T, direction: -1 | 1) => {
    setState((prev) => {
      const index = prev.order.indexOf(key);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.order.length) return prev;

      const nextOrder = [...prev.order];
      [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
      return { ...prev, order: nextOrder };
    });
  }, []);

  return { visible, order: state.order, toggle, reset, isVisible, move };
};
